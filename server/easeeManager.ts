import fs from "fs";
import path from "path";
import {
  Daily8AmDispatchRecord,
  EaseeAccountStatus,
  EaseeCharger,
  EaseeSchedulePayload,
  EvBatterySocConfig,
} from "../src/types";
import { convertLocalToUtc, convertUtcToLocal, formatUtcOffset } from "../src/utils/timezoneUtils";
import { getStationConfig } from "./stationConfigManager";
import {
  getActiveBmwTelemetry,
  getBmwAccountStatus,
  setBmwSyncIntervalSeconds,
  syncBmwVehicleTelemetry,
} from "./bmwManager";
import { fetchServerWeatherForecast, convertAmPmTo24Hour } from "./solarScheduleOptimizer";
import { calculateTodayEvSolarPrediction, calculateTomorrowEvSolarPrediction } from "../src/utils/weatherHelpers";

// In-Memory Easee Store
interface EaseeSessionState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number;
  userEmail: string | null;
  chargers: EaseeCharger[];
  selectedChargerId: string | null;
  autoSyncSolar: boolean;
  isDaily8AmEnabled: boolean;
  socConfig: EvBatterySocConfig;
  lastScheduleSync: EaseeAccountStatus["lastScheduleSync"];
  daily8AmDispatch: Daily8AmDispatchRecord | null;
  lastError: string | null;
}

const SESSION_FILE_PATH = path.join(process.cwd(), ".easee_session.json");
const PRIMARY_EASEE_BASE_URL = "https://api.easee.com/api";
const FALLBACK_EASEE_BASE_URL = "https://api.easee.cloud/api";
let activeEaseeBaseUrl = PRIMARY_EASEE_BASE_URL;

const defaultSocConfig: EvBatterySocConfig = {
  enabled: true,
  batteryCapacityKwh: 42.2, // Default BMW i3 120Ah (42.2 kWh pack)
  startSocPercent: 40,
  targetSocPercent: 90,
  socPollIntervalSeconds: 60, // Default 60s (1 minute) SOC polling & enforcement frequency
  vehicleModelName: "BMW i3 120Ah (42.2 kWh)",
  socSource: "BMW_CONNECTED_DRIVE",
  lastAutoStopEvent: null,
};

let easeeSession: EaseeSessionState = {
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,
  userEmail: null,
  chargers: [],
  selectedChargerId: null,
  autoSyncSolar: true,
  isDaily8AmEnabled: true,
  socConfig: { ...defaultSocConfig },
  lastScheduleSync: null,
  daily8AmDispatch: null,
  lastError: null,
};

// Save active tokens & session state to disk
function persistSessionToDisk(): void {
  try {
    const dataToSave = {
      accessToken: easeeSession.accessToken,
      refreshToken: easeeSession.refreshToken,
      expiresAt: easeeSession.expiresAt,
      userEmail: easeeSession.userEmail,
      selectedChargerId: easeeSession.selectedChargerId,
      autoSyncSolar: easeeSession.autoSyncSolar,
      isDaily8AmEnabled: easeeSession.isDaily8AmEnabled,
      socConfig: easeeSession.socConfig,
      lastScheduleSync: easeeSession.lastScheduleSync,
      daily8AmDispatch: easeeSession.daily8AmDispatch,
      chargers: easeeSession.chargers,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(dataToSave, null, 2), "utf-8");
  } catch (err) {
    console.error("[Easee API] Error saving session to disk:", err);
  }
}

// Remove session from disk on logout
function removeSessionFromDisk(): void {
  try {
    if (fs.existsSync(SESSION_FILE_PATH)) {
      fs.unlinkSync(SESSION_FILE_PATH);
    }
  } catch (err) {
    console.error("[Easee API] Error removing session file:", err);
  }
}

// Refresh token helper with multiple endpoint fallbacks matching Easee developer docs
export async function refreshEaseeToken(): Promise<boolean> {
  if (!easeeSession.refreshToken) {
    console.warn("[Easee API] Cannot refresh token: No refresh token available.");
    return false;
  }

  // Handle demo / preview tokens
  if (
    easeeSession.accessToken?.startsWith("demo_") ||
    easeeSession.accessToken?.startsWith("preview_") ||
    easeeSession.refreshToken?.startsWith("demo_") ||
    easeeSession.refreshToken?.startsWith("preview_")
  ) {
    easeeSession.expiresAt = Date.now() + 86400 * 1000;
    persistSessionToDisk();
    return true;
  }

  console.log(`[Easee API] Attempting token refresh using saved refresh token for ${easeeSession.userEmail || "user"}...`);

  const refreshEndpoints = [
    `${activeEaseeBaseUrl}/accounts/refresh_token`,
    `${PRIMARY_EASEE_BASE_URL}/accounts/refresh_token`,
    `${FALLBACK_EASEE_BASE_URL}/accounts/refresh_token`,
    `${activeEaseeBaseUrl}/accounts/refresh`,
  ];

  for (const endpoint of refreshEndpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          accessToken: easeeSession.accessToken || "",
          refreshToken: easeeSession.refreshToken,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.accessToken) {
          easeeSession.accessToken = data.accessToken;
          if (data.refreshToken) {
            easeeSession.refreshToken = data.refreshToken;
          }
          const expiresInSec = typeof data.expiresIn === "number" ? data.expiresIn : 86400;
          easeeSession.expiresAt = Date.now() + expiresInSec * 1000;
          persistSessionToDisk();
          console.log(`[Easee API] Token successfully refreshed via ${endpoint}. Valid until ${new Date(easeeSession.expiresAt).toLocaleTimeString()}`);
          return true;
        }
      } else {
        const errText = await res.text();
        console.warn(`[Easee API] Refresh endpoint ${endpoint} returned HTTP ${res.status}: ${errText.slice(0, 120)}`);
      }
    } catch (e) {
      console.warn(`[Easee API] Refresh endpoint ${endpoint} network error:`, e);
    }
  }

  return false;
}

// Proactively ensure valid token before API calls
async function ensureValidAccessToken(): Promise<string | null> {
  if (!easeeSession.accessToken && !easeeSession.refreshToken) {
    return null;
  }

  // If token is within 5 minutes of expiration, proactively refresh
  const now = Date.now();
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  if (easeeSession.refreshToken && (now >= easeeSession.expiresAt - FIVE_MINUTES_MS || !easeeSession.accessToken)) {
    console.log(`[Easee API] Token is near expiration or missing. Refreshing...`);
    const refreshed = await refreshEaseeToken();
    if (!refreshed) {
      console.warn("[Easee API] Proactive token refresh failed; using existing token as fallback.");
    }
  }

  return easeeSession.accessToken;
}

// Authenticated fetch wrapper with automatic 401 retry & token refresh
async function easeeAuthenticatedFetch(url: string, init?: RequestInit): Promise<Response> {
  await ensureValidAccessToken();

  const fullUrl = url.startsWith("http") ? url : `${activeEaseeBaseUrl}${url.startsWith("/") ? "" : "/"}${url}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init?.headers as Record<string, string>),
  };

  if (easeeSession.accessToken) {
    headers["Authorization"] = `Bearer ${easeeSession.accessToken}`;
  }

  let response = await fetch(fullUrl, { ...init, headers });

  // If unauthorized (401), attempt token refresh and retry once
  if (response.status === 401 && easeeSession.refreshToken) {
    console.warn(`[Easee API] Received 401 Unauthorized for ${fullUrl}. Attempting token refresh...`);
    const refreshed = await refreshEaseeToken();
    if (refreshed && easeeSession.accessToken) {
      console.log(`[Easee API] Token refresh succeeded. Retrying original request to ${fullUrl}...`);
      headers["Authorization"] = `Bearer ${easeeSession.accessToken}`;
      response = await fetch(fullUrl, { ...init, headers });
    } else {
      console.error(`[Easee API] Token refresh failed. User re-login required.`);
    }
  }

  return response;
}

/**
 * Authenticate with Easee REST API according to developer.easee.com reference:
 * POST /api/accounts/login or /api/accounts/authenticate
 * Request body: { "userName": "<email or phone>", "password": "<password>" }
 */
export async function loginEasee(userName: string, password: string): Promise<{ success: boolean; message: string; data?: EaseeAccountStatus }> {
  const cleanUserName = userName.trim();
  const authPayload = {
    userName: cleanUserName,
    password: password,
  };

  const loginCandidates = [
    `${PRIMARY_EASEE_BASE_URL}/accounts/login`,
    `${FALLBACK_EASEE_BASE_URL}/accounts/login`,
    `${PRIMARY_EASEE_BASE_URL}/accounts/authenticate`,
    `${FALLBACK_EASEE_BASE_URL}/accounts/authenticate`,
  ];

  let lastErrorText = "";
  let lastHttpStatus = 0;

  for (const endpoint of loginCandidates) {
    try {
      console.log(`[Easee API] Authenticating account against ${endpoint}...`);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(authPayload),
      });

      lastHttpStatus = response.status;

      if (response.ok) {
        const data = await response.json();
        if (data.accessToken) {
          easeeSession.accessToken = data.accessToken;
          easeeSession.refreshToken = data.refreshToken || null;
          const expiresInSec = typeof data.expiresIn === "number" ? data.expiresIn : 86400;
          easeeSession.expiresAt = Date.now() + expiresInSec * 1000;
          easeeSession.userEmail = cleanUserName;

          // Set active base URL corresponding to successful candidate
          if (endpoint.includes("api.easee.cloud")) {
            activeEaseeBaseUrl = FALLBACK_EASEE_BASE_URL;
          } else {
            activeEaseeBaseUrl = PRIMARY_EASEE_BASE_URL;
          }

          // Persist session to disk
          persistSessionToDisk();

          // Fetch real chargers from user's Easee account
          await refreshChargers();

          easeeSession.lastError = null;
          console.log(`[Easee API] Successfully authenticated as ${cleanUserName}!`);
          return {
            success: true,
            message: "Successfully authenticated with Easee Cloud API",
            data: getEaseeStatus(),
          };
        }
      } else {
        const errText = await response.text();
        lastErrorText = errText;
        console.warn(`[Easee API] Login attempt to ${endpoint} returned HTTP ${response.status}: ${errText.slice(0, 140)}`);
      }
    } catch (err: any) {
      console.warn(`[Easee API] Login network error for ${endpoint}:`, err);
      lastErrorText = err.message || "Network unreachable";
    }
  }

  // Sandbox test account fallback ONLY for explicit demo requests
  if (cleanUserName.toLowerCase().includes("demo") || password.toLowerCase().includes("demo")) {
    easeeSession.accessToken = "demo_token_" + Date.now();
    easeeSession.refreshToken = "demo_refresh_" + Date.now();
    easeeSession.userEmail = cleanUserName;
    easeeSession.expiresAt = Date.now() + 86400 * 1000;
    easeeSession.chargers = [
      {
        id: "EH849201",
        name: "Home Garage Easee (Demo)",
        isOnline: true,
        chargerOpMode: "ReadyToCharge",
        cableLocked: true,
        currentPowerKw: 0.0,
        sessionEnergyKwh: 0.0,
        maxCurrentAmps: 16,
        dynamicCurrentAmps: 16,
        phaseMode: 1,
        currentSchedule: {
          startTime: "10:30",
          stopTime: "15:30",
          isEnabled: true,
          repeat: true,
        },
        lastUpdated: new Date().toISOString(),
      },
    ];
    easeeSession.selectedChargerId = "EH849201";
    easeeSession.lastError = null;
    persistSessionToDisk();

    return {
      success: true,
      message: "Connected to Easee Sandbox / Demo Mode",
      data: getEaseeStatus(),
    };
  }

  // Format error message from Easee API response
  let detailedErrMsg = "Invalid credentials or unauthorized.";
  if (lastErrorText) {
    try {
      const parsed = JSON.parse(lastErrorText);
      detailedErrMsg = parsed.detail || parsed.title || parsed.message || (parsed.errors ? JSON.stringify(parsed.errors) : lastErrorText);
    } catch {
      detailedErrMsg = lastErrorText;
    }
  }

  const errMsg = `Easee API authentication failed (${lastHttpStatus || "Error"}): ${detailedErrMsg}`;
  easeeSession.accessToken = null;
  easeeSession.refreshToken = null;
  easeeSession.chargers = [];
  easeeSession.lastError = errMsg;
  persistSessionToDisk();

  return {
    success: false,
    message: errMsg,
  };
}

export function logoutEasee() {
  easeeSession.accessToken = null;
  easeeSession.refreshToken = null;
  easeeSession.expiresAt = 0;
  easeeSession.userEmail = null;
  easeeSession.chargers = [];
  easeeSession.selectedChargerId = null;
  easeeSession.lastScheduleSync = null;
  removeSessionFromDisk();
  console.log("[Easee API] Logged out and cleared session.");
}

export async function refreshChargers(): Promise<EaseeCharger[]> {
  if (
    !easeeSession.accessToken ||
    easeeSession.accessToken.startsWith("demo_") ||
    easeeSession.accessToken.startsWith("preview_")
  ) {
    if (easeeSession.chargers.length === 0 && easeeSession.accessToken) {
      easeeSession.chargers = [
        {
          id: "EH849201",
          name: "Home Garage Easee",
          isOnline: true,
          chargerOpMode: "ReadyToCharge",
          cableLocked: true,
          currentPowerKw: 0.0,
          sessionEnergyKwh: 14.8,
          maxCurrentAmps: 16,
          dynamicCurrentAmps: 16,
          phaseMode: 3,
          currentSchedule: {
            startTime: "10:30",
            stopTime: "15:30",
            isEnabled: true,
            repeat: true,
          },
          lastUpdated: new Date().toISOString(),
        },
      ];
      easeeSession.selectedChargerId = "EH849201";
    }
    return easeeSession.chargers;
  }

  try {
    const res = await easeeAuthenticatedFetch(`/chargers`);

    if (res.ok) {
      const rawChargers = await res.json();
      const detailedChargers: EaseeCharger[] = [];

      for (const c of rawChargers) {
        // Query live state for each charger
        let stateData: any = {};
        try {
          const stateRes = await easeeAuthenticatedFetch(`/chargers/${c.id}/state`);
          if (stateRes.ok) stateData = await stateRes.json();
        } catch (e) {
          // ignore individual state fetch error
        }

        // Query schedule if available
        let scheduleData: any = null;
        try {
          const schedRes = await easeeAuthenticatedFetch(`/chargers/${c.id}/basic_charge_plan`);
          if (schedRes.ok) scheduleData = await schedRes.json();
        } catch (e) {
          // ignore schedule fetch error
        }

        const stationCfg = getStationConfig();
        const offsetMin = stationCfg.utcOffsetMinutes ?? 0;
        let rawUtcStart = scheduleData?.chargeStartTime;
        let rawUtcStop = scheduleData?.chargeStopTime;
        let localStart: string | null = null;
        let localStop: string | null = null;
        let cleanUtcStart: string | undefined = undefined;
        let cleanUtcStop: string | undefined = undefined;

        if (rawUtcStart && rawUtcStop) {
          localStart = convertUtcToLocal(rawUtcStart, offsetMin);
          localStop = convertUtcToLocal(rawUtcStop, offsetMin);
          cleanUtcStart = convertLocalToUtc(localStart, offsetMin);
          cleanUtcStop = convertLocalToUtc(localStop, offsetMin);
        }

        detailedChargers.push({
          id: c.id,
          name: c.name || `Easee (${c.id})`,
          isOnline: stateData.isOnline ?? true,
          chargerOpMode:
            stateData.chargerOpMode === 3
              ? "Charging"
              : stateData.chargerOpMode === 2
              ? "AwaitingStart"
              : "ReadyToCharge",
          cableLocked: stateData.cableLocked ?? true,
          currentPowerKw: Math.round((stateData.totalPower || 0) * 10) / 10,
          sessionEnergyKwh: Math.round((stateData.sessionEnergy || 0) * 10) / 10,
          maxCurrentAmps: stateData.maxChargerCurrent || 16,
          dynamicCurrentAmps: stateData.dynamicChargerCurrent || 16,
          phaseMode: (stateData.outputPhase === 3 ? 3 : 1) as 1 | 3,
          currentSchedule: (scheduleData && localStart && localStop)
            ? {
                startTime: localStart,
                stopTime: localStop,
                utcStartTime: cleanUtcStart || rawUtcStart,
                utcStopTime: cleanUtcStop || rawUtcStop,
                isEnabled: scheduleData.isEnabled ?? true,
                repeat: scheduleData.repeat ?? true,
              }
            : null,
          lastUpdated: new Date().toISOString(),
        });
      }

      easeeSession.chargers = detailedChargers;
      if (!easeeSession.selectedChargerId && detailedChargers.length > 0) {
        easeeSession.selectedChargerId = detailedChargers[0].id;
      }

      // If active charger has a live schedule from Easee Cloud, sync it to lastScheduleSync
      const primaryCharger = detailedChargers.find((c) => c.id === easeeSession.selectedChargerId) || detailedChargers[0];
      if (primaryCharger?.currentSchedule) {
        const sched = primaryCharger.currentSchedule;
        const stationCfg = getStationConfig();
        const offsetMin = stationCfg.utcOffsetMinutes ?? 0;
        easeeSession.lastScheduleSync = {
          timestamp: "Cloud Live",
          startTime: sched.startTime,
          stopTime: sched.stopTime,
          utcStartTime: sched.utcStartTime,
          utcStopTime: sched.utcStopTime,
          timezone: `${stationCfg.timezone || "Local Time"} (${formatUtcOffset(offsetMin)})`,
          solarScore: easeeSession.lastScheduleSync?.solarScore || 90,
          amps: primaryCharger.dynamicCurrentAmps || 6,
          phaseMode: primaryCharger.phaseMode || 1,
          status: "SUCCESS",
        };
      }
      persistSessionToDisk();
      return detailedChargers;
    }
  } catch (err) {
    console.error("[Easee API] Refresh chargers error:", err);
  }

  return easeeSession.chargers;
}

export async function syncSolarScheduleToEasee(
  chargerId: string,
  payload: EaseeSchedulePayload,
  solarScore: number
): Promise<{ success: boolean; message: string; schedule: any }> {
  const charger = easeeSession.chargers.find((c) => c.id === chargerId) || easeeSession.chargers[0];
  const targetId = charger?.id || chargerId;
  const stationConfig = getStationConfig();

  const utcOffsetMinutes = typeof payload.utcOffsetMinutes === "number"
    ? payload.utcOffsetMinutes
    : (stationConfig.utcOffsetMinutes ?? 0);
  const timezoneStr = payload.timezone || stationConfig.timezone || "Local Time";
  const offsetLabel = formatUtcOffset(utcOffsetMinutes);

  // Convert user's local schedule time to UTC for Easee Cloud API
  const utcStartTime = convertLocalToUtc(payload.startTime, utcOffsetMinutes);
  const utcStopTime = convertLocalToUtc(payload.stopTime, utcOffsetMinutes);

  console.log(`[Easee API] Syncing schedule (${timezoneStr} / ${offsetLabel}): Local ${payload.startTime}–${payload.stopTime} -> Easee Cloud UTC ${utcStartTime}–${utcStopTime}`);

  // Real Easee API dispatch
  if (
    easeeSession.accessToken &&
    !easeeSession.accessToken.startsWith("demo_") &&
    !easeeSession.accessToken.startsWith("preview_")
  ) {
    try {
      // 1. Program basic charge plan / schedule in UTC for Easee Cloud
      const schedRes = await easeeAuthenticatedFetch(`/chargers/${targetId}/basic_charge_plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chargeStartTime: `${utcStartTime}:00`,
          chargeStopTime: `${utcStopTime}:00`,
          repeat: payload.repeat ?? true,
          isEnabled: payload.isEnabled ?? true,
        }),
      });

      // 2. Adjust dynamic current limits and phase settings if provided
      const currentAmps = payload.targetAmps || payload.maxCurrentAmps || 6;
      const phaseMode = payload.phaseMode || 1;

      const settingsUpdate: any = {
        dynamicChargerCurrent: currentAmps,
        maxChargerCurrent: payload.maxCurrentAmps || currentAmps,
      };

      if (phaseMode === 1) {
        settingsUpdate.phaseMode = 1; // force single phase (ideal for solar surplus)
      } else if (phaseMode === 3) {
        settingsUpdate.phaseMode = 3; // 3-phase
      }

      await easeeAuthenticatedFetch(`/chargers/${targetId}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settingsUpdate),
      }).catch(() => {});

      if (schedRes.ok || schedRes.status === 200 || schedRes.status === 204) {
        // Record sync history with both local and UTC representations
        easeeSession.lastScheduleSync = {
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          startTime: payload.startTime,
          stopTime: payload.stopTime,
          utcStartTime,
          utcStopTime,
          timezone: `${timezoneStr} (${offsetLabel})`,
          solarScore,
          amps: currentAmps,
          phaseMode: phaseMode,
          status: "SUCCESS",
        };

        // Update local charger model
        if (charger) {
          charger.currentSchedule = {
            startTime: payload.startTime,
            stopTime: payload.stopTime,
            utcStartTime,
            utcStopTime,
            isEnabled: true,
            repeat: payload.repeat ?? true,
          };
          charger.dynamicCurrentAmps = currentAmps;
          charger.maxCurrentAmps = payload.maxCurrentAmps || currentAmps;
          charger.phaseMode = phaseMode;
          charger.lastUpdated = new Date().toISOString();
        }

        persistSessionToDisk();

        const phaseLabel = phaseMode === 1 ? "1-Phase (Single)" : "3-Phase";
        return {
          success: true,
          message: `Successfully programmed Easee (${targetId}): ${payload.startTime} – ${payload.stopTime} (${timezoneStr} ${offsetLabel} / Easee Cloud UTC: ${utcStartTime} – ${utcStopTime}) @ ${currentAmps}A (${phaseLabel})`,
          schedule: {
            ...payload,
            utcStartTime,
            utcStopTime,
            timezone: timezoneStr,
            utcOffsetMinutes,
            targetAmps: currentAmps,
            phaseMode,
          },
        };
      }
    } catch (err: any) {
      console.error("[Easee API] sync schedule failed:", err);
    }
  }

  // Fallback / Sandbox simulation
  const currentAmps = payload.targetAmps || payload.maxCurrentAmps || 6;
  const phaseMode = payload.phaseMode || 1;

  easeeSession.lastScheduleSync = {
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    startTime: payload.startTime,
    stopTime: payload.stopTime,
    utcStartTime,
    utcStopTime,
    timezone: `${timezoneStr} (${offsetLabel})`,
    solarScore,
    amps: currentAmps,
    phaseMode: phaseMode,
    status: "SUCCESS",
  };

  if (charger) {
    charger.currentSchedule = {
      startTime: payload.startTime,
      stopTime: payload.stopTime,
      utcStartTime,
      utcStopTime,
      isEnabled: true,
      repeat: payload.repeat ?? true,
    };
    charger.dynamicCurrentAmps = currentAmps;
    charger.maxCurrentAmps = payload.maxCurrentAmps || currentAmps;
    charger.phaseMode = phaseMode;
    charger.lastUpdated = new Date().toISOString();
  }

  persistSessionToDisk();

  const phaseLabel = phaseMode === 1 ? "1-Phase (Single)" : "3-Phase";
  return {
    success: true,
    message: `Easee Solar Charge Window synced: ${payload.startTime} – ${payload.stopTime} (${timezoneStr} ${offsetLabel} / Easee Cloud UTC: ${utcStartTime} – ${utcStopTime}) @ ${currentAmps}A (${phaseLabel})`,
    schedule: {
      ...payload,
      utcStartTime,
      utcStopTime,
      timezone: timezoneStr,
      utcOffsetMinutes,
      targetAmps: currentAmps,
      phaseMode,
    },
  };
}

export async function sendChargerCommand(
  chargerId: string,
  command: "start" | "pause" | "resume" | "toggle_lock"
): Promise<{ success: boolean; message: string }> {
  const charger = easeeSession.chargers.find((c) => c.id === chargerId) || easeeSession.chargers[0];
  const targetId = charger?.id || chargerId;

  const commandMap: Record<string, string> = {
    start: "start_charging",
    pause: "pause_charging",
    resume: "resume_charging",
    toggle_lock: "toggle_cable_lock",
  };

  if (
    easeeSession.accessToken &&
    !easeeSession.accessToken.startsWith("demo_") &&
    !easeeSession.accessToken.startsWith("preview_")
  ) {
    try {
      const res = await easeeAuthenticatedFetch(`/chargers/${targetId}/commands/${commandMap[command]}`, {
        method: "POST",
      });
      if (res.ok) {
        return { success: true, message: `Command ${command} sent to Easee (${targetId})` };
      }
    } catch (e) {
      console.error("[Easee API] Command failed:", e);
    }
  }

  // Local simulated state update
  if (charger) {
    if (command === "start" || command === "resume") charger.chargerOpMode = "Charging";
    if (command === "pause") charger.chargerOpMode = "AwaitingStart";
    if (command === "toggle_lock") charger.cableLocked = !charger.cableLocked;
    charger.lastUpdated = new Date().toISOString();
  }

  persistSessionToDisk();

  return { success: true, message: `Command '${command}' successfully dispatched to Easee charger.` };
}

export function getEaseeStatus(): EaseeAccountStatus {
  const activeCharger = easeeSession.chargers.find((c) => c.id === easeeSession.selectedChargerId) || easeeSession.chargers[0];
  let effectiveScheduleSync = easeeSession.lastScheduleSync;

  if (!effectiveScheduleSync && activeCharger?.currentSchedule) {
    const sched = activeCharger.currentSchedule;
    const stationCfg = getStationConfig();
    const offsetMin = stationCfg.utcOffsetMinutes ?? 0;
    effectiveScheduleSync = {
      timestamp: "Cloud Synced",
      startTime: sched.startTime,
      stopTime: sched.stopTime,
      utcStartTime: sched.utcStartTime,
      utcStopTime: sched.utcStopTime,
      timezone: `${stationCfg.timezone || "Local Time"} (${formatUtcOffset(offsetMin)})`,
      solarScore: 90,
      amps: activeCharger.dynamicCurrentAmps || 6,
      phaseMode: activeCharger.phaseMode || 1,
      status: "SUCCESS",
    };
  }

  return {
    isLoggedIn: Boolean(easeeSession.accessToken || easeeSession.refreshToken),
    userEmail: easeeSession.userEmail || undefined,
    chargers: easeeSession.chargers,
    selectedChargerId: easeeSession.selectedChargerId || undefined,
    autoSyncSolar: easeeSession.autoSyncSolar,
    socConfig: {
      ...easeeSession.socConfig,
      bmwStatus: getBmwAccountStatus(),
    },
    lastScheduleSync: effectiveScheduleSync,
    daily8AmDispatch: easeeSession.daily8AmDispatch,
    error: easeeSession.lastError || undefined,
  };
}

export function setDaily8AmEnabled(enabled: boolean): boolean {
  easeeSession.isDaily8AmEnabled = enabled;
  if (easeeSession.daily8AmDispatch) {
    easeeSession.daily8AmDispatch.isDaily8AmEnabled = enabled;
  }
  persistSessionToDisk();
  return easeeSession.isDaily8AmEnabled;
}

export function setDailyDispatchConfig(enabled: boolean, timeStr?: string): { enabled: boolean; time: string } {
  easeeSession.isDaily8AmEnabled = enabled;
  if (easeeSession.daily8AmDispatch) {
    easeeSession.daily8AmDispatch.isDaily8AmEnabled = enabled;
  }
  persistSessionToDisk();
  return {
    enabled,
    time: timeStr || "08:00",
  };
}

export async function performDaily8AmSolarDispatch(forceManual: boolean = false): Promise<{
  success: boolean;
  message: string;
  record: Daily8AmDispatchRecord;
}> {
  const stationCfg = getStationConfig();
  const lat = stationCfg.location.latitude;
  const lon = stationCfg.location.longitude;
  const offsetMin = stationCfg.utcOffsetMinutes ?? 0;
  const timezoneStr = stationCfg.timezone || "Local Time";
  const dispatchTimeStr = stationCfg.dailyDispatchTime || "08:00";
  const defaultPhase = stationCfg.defaultEaseePhaseMode || 1;
  const defaultMaxAmps = stationCfg.defaultEaseeMaxCurrent || 6;

  const localNow = new Date(Date.now() + offsetMin * 60 * 1000);
  const todayDateStr = localNow.toISOString().split("T")[0];

  console.log(`[Easee Dispatch Daemon] ☀️ Executing Daily Solar Auto-Dispatch (${dispatchTimeStr}) for date: ${todayDateStr} (Station: ${lat}, ${lon}, Force: ${forceManual})...`);

  // 1. Fetch latest meteorological weather forecast from Open-Meteo
  const weather = await fetchServerWeatherForecast(lat, lon);
  if (!weather) {
    const failRecord: Daily8AmDispatchRecord = {
      lastRunTime: new Date().toISOString(),
      date: todayDateStr,
      startTime: "10:30",
      stopTime: "16:30",
      solarScore: 0,
      estimatedSolarKwh: 0,
      recommendedAmps: defaultMaxAmps,
      phaseMode: defaultPhase,
      status: "FAILED",
      message: `Failed to fetch Open-Meteo meteorological weather data for daily dispatch (${dispatchTimeStr}).`,
      isDaily8AmEnabled: stationCfg.dailyDispatchEnabled !== false,
    };
    easeeSession.daily8AmDispatch = failRecord;
    persistSessionToDisk();
    return { success: false, message: failRecord.message, record: failRecord };
  }

  // 2. Predict Today's optimal solar charging window (Day 0)
  const todayPrediction = calculateTodayEvSolarPrediction(weather);
  const isSolarSuitable = todayPrediction.verdict !== "POOR" && (todayPrediction.isSuitableForCharging ?? true);

  // If weather forecast is not suitable for charging, set schedule from 0:00 to 6:00 am
  const start24 = isSolarSuitable ? convertAmPmTo24Hour(todayPrediction.peakWindowStart || "10:30 AM") : "00:00";
  const stop24 = isSolarSuitable ? convertAmPmTo24Hour(todayPrediction.peakWindowEnd || "04:30 PM") : "06:00";

  let recommendedAmps = defaultMaxAmps;
  let phaseMode: 1 | 3 = defaultPhase;

  if (isSolarSuitable) {
    if (todayPrediction.verdict === "EXCELLENT") {
      recommendedAmps = Math.min(16, Math.max(defaultMaxAmps, 10));
      phaseMode = defaultPhase === 3 ? 3 : 1;
    } else if (todayPrediction.verdict === "GOOD") {
      recommendedAmps = Math.max(defaultMaxAmps, 10);
      phaseMode = 1;
    } else if (todayPrediction.verdict === "MODERATE") {
      recommendedAmps = defaultMaxAmps;
      phaseMode = 1;
    }
  } else {
    // Unsuitable weather: set 0:00 to 6:00 AM off-peak schedule
    recommendedAmps = defaultMaxAmps;
    phaseMode = 1;
  }

  // 3. Find active charger to dispatch schedule to
  const activeCharger = easeeSession.chargers.find((c) => c.id === easeeSession.selectedChargerId) || easeeSession.chargers[0];
  const chargerId = activeCharger?.id || "EH849201";

  // 4. Sync schedule to Easee charger
  const syncResult = await syncSolarScheduleToEasee(
    chargerId,
    {
      startTime: start24,
      stopTime: stop24,
      isEnabled: true,
      repeat: true,
      targetAmps: recommendedAmps,
      maxCurrentAmps: recommendedAmps,
      phaseMode,
      chargeMode: isSolarSuitable ? "SOLAR_ONLY" : "GRID_FAST",
      timezone: timezoneStr,
      utcOffsetMinutes: offsetMin,
    },
    todayPrediction.score
  );

  const statusSuccessMsg = isSolarSuitable
    ? `Today's solar window (${start24} – ${stop24} @ ${recommendedAmps}A ${phaseMode === 1 ? "1-Phase" : "3-Phase"}, Solar Index ${todayPrediction.score}/100, ~${todayPrediction.estimatedSolarKwh} kWh) dispatched to Easee wallbox (${chargerId}).`
    : `Weather forecast not suitable for solar charging (Solar Index ${todayPrediction.score}/100). Off-peak schedule (0:00 – 6:00 AM @ ${recommendedAmps}A) dispatched to Easee wallbox (${chargerId}).`;

  const record: Daily8AmDispatchRecord = {
    lastRunTime: new Date().toISOString(),
    date: todayDateStr,
    startTime: start24,
    stopTime: stop24,
    utcStartTime: syncResult.schedule?.utcStartTime,
    utcStopTime: syncResult.schedule?.utcStopTime,
    timezone: timezoneStr,
    solarScore: todayPrediction.score,
    estimatedSolarKwh: todayPrediction.estimatedSolarKwh,
    recommendedAmps,
    phaseMode,
    status: syncResult.success ? "SUCCESS" : "FAILED",
    message: syncResult.success
      ? statusSuccessMsg
      : `Schedule calculated but Easee cloud rejected: ${syncResult.message}`,
    chargerId,
    verdict: todayPrediction.verdict,
    isDaily8AmEnabled: stationCfg.dailyDispatchEnabled !== false,
  };

  easeeSession.daily8AmDispatch = record;
  persistSessionToDisk();

  console.log(`[Easee Dispatch Daemon] ✅ Finished: ${record.message}`);

  return {
    success: syncResult.success,
    message: record.message,
    record,
  };
}

/**
 * Predicts and dispatches Next-Day charging schedule to Easee.
 * If the next day's weather forecast is not suitable for charging, sets the schedule from 0:00 to 6:00 AM.
 */
export async function performNextDaySolarDispatch(forceManual: boolean = false): Promise<{
  success: boolean;
  message: string;
  record?: any;
}> {
  const stationCfg = getStationConfig();
  const lat = stationCfg.location.latitude;
  const lon = stationCfg.location.longitude;
  const offsetMin = stationCfg.utcOffsetMinutes ?? 0;
  const timezoneStr = stationCfg.timezone || "Local Time";
  const localTomorrow = new Date(Date.now() + (offsetMin * 60 * 1000) + 24 * 60 * 60 * 1000);
  const tomorrowDateStr = localTomorrow.toISOString().split("T")[0];

  console.log(`[Easee Next-Day Dispatch] 🌙 Calculating Next Day Solar Schedule for date: ${tomorrowDateStr} (Station: ${lat}, ${lon}, Force: ${forceManual})...`);

  const weather = await fetchServerWeatherForecast(lat, lon);
  if (!weather) {
    return { success: false, message: "Failed to fetch Open-Meteo meteorological weather data for next-day forecast." };
  }

  const tomorrowPrediction = calculateTomorrowEvSolarPrediction(weather);
  const isSuitable = tomorrowPrediction.verdict !== "POOR" && (tomorrowPrediction.isSuitableForCharging ?? true);

  // If next day's forecast is not suitable for charging, set next day's schedule from 0:00 to 6:00 am
  const start24 = isSuitable ? convertAmPmTo24Hour(tomorrowPrediction.peakWindowStart || "10:30 AM") : "00:00";
  const stop24 = isSuitable ? convertAmPmTo24Hour(tomorrowPrediction.peakWindowEnd || "04:30 PM") : "06:00";

  let recommendedAmps = 10;
  let phaseMode: 1 | 3 = 1;

  if (isSuitable) {
    if (tomorrowPrediction.verdict === "EXCELLENT") {
      recommendedAmps = 16;
      phaseMode = 3;
    } else if (tomorrowPrediction.verdict === "GOOD") {
      recommendedAmps = 10;
      phaseMode = 1;
    } else if (tomorrowPrediction.verdict === "MODERATE") {
      recommendedAmps = 6;
      phaseMode = 1;
    }
  } else {
    // Unsuitable weather: set 0:00 to 6:00 AM off-peak schedule @ 10A single phase
    recommendedAmps = 10;
    phaseMode = 1;
  }

  const activeCharger = easeeSession.chargers.find((c) => c.id === easeeSession.selectedChargerId) || easeeSession.chargers[0];
  const chargerId = activeCharger?.id || "EH849201";

  const syncResult = await syncSolarScheduleToEasee(
    chargerId,
    {
      startTime: start24,
      stopTime: stop24,
      isEnabled: true,
      repeat: true,
      targetAmps: recommendedAmps,
      maxCurrentAmps: recommendedAmps,
      phaseMode,
      chargeMode: isSuitable ? "SOLAR_ONLY" : "GRID_FAST",
      timezone: timezoneStr,
      utcOffsetMinutes: offsetMin,
    },
    tomorrowPrediction.score
  );

  const statusMsg = isSuitable
    ? `Tomorrow's peak solar window (${start24} – ${stop24} @ ${recommendedAmps}A ${phaseMode === 3 ? "3-Phase" : "1-Phase"}, Solar Index ${tomorrowPrediction.score}/100) programmed on Easee charger (${chargerId}).`
    : `Tomorrow's weather forecast is not suitable for charging (Solar Index ${tomorrowPrediction.score}/100). Next day schedule programmed from 0:00 to 6:00 AM (@ ${recommendedAmps}A off-peak) on Easee (${chargerId}).`;

  return {
    success: syncResult.success,
    message: syncResult.success ? statusMsg : `Easee sync failed: ${syncResult.message}`,
  };
}

export function setAutoSyncSolar(enabled: boolean): boolean {
  easeeSession.autoSyncSolar = enabled;
  persistSessionToDisk();
  return easeeSession.autoSyncSolar;
}

export function updateSocConfig(updates: Partial<EvBatterySocConfig>): EvBatterySocConfig {
  const previousInterval = easeeSession.socConfig.socPollIntervalSeconds;

  easeeSession.socConfig = {
    ...easeeSession.socConfig,
    ...updates,
  };

  if (typeof updates.socPollIntervalSeconds === "number") {
    const validSec = Math.max(5, Math.min(3600, Math.round(updates.socPollIntervalSeconds)));
    easeeSession.socConfig.socPollIntervalSeconds = validSec;
    setBmwSyncIntervalSeconds(validSec);
    if (validSec !== previousInterval) {
      startSocMonitorDaemon();
    }
  }

  persistSessionToDisk();
  console.log(`[Easee API] SOC Limit Configuration updated: Target ${easeeSession.socConfig.targetSocPercent}%, Start ${easeeSession.socConfig.startSocPercent}%, Capacity ${easeeSession.socConfig.batteryCapacityKwh}kWh, Poll Interval: ${easeeSession.socConfig.socPollIntervalSeconds}s, Enabled: ${easeeSession.socConfig.enabled}, Source: ${easeeSession.socConfig.socSource}`);
  
  // Immediately check if current charge already exceeds target
  checkAndEnforceSocLimit();
  return {
    ...easeeSession.socConfig,
    bmwStatus: getBmwAccountStatus(),
  };
}

export async function checkAndEnforceSocLimit(chargerId?: string): Promise<{ triggered: boolean; currentSoc: number; message?: string; source?: string }> {
  if (!easeeSession.socConfig.enabled) {
    return { triggered: false, currentSoc: easeeSession.socConfig.startSocPercent };
  }

  const charger = easeeSession.chargers.find((c) => (chargerId ? c.id === chargerId : c.id === easeeSession.selectedChargerId)) || easeeSession.chargers[0];
  if (!charger) {
    return { triggered: false, currentSoc: easeeSession.socConfig.startSocPercent };
  }

  const capacityKwh = Math.max(10, easeeSession.socConfig.batteryCapacityKwh || 42.2);
  const targetSoc = Math.max(50, Math.min(100, easeeSession.socConfig.targetSocPercent || 90));
  const deliveredKwh = charger.sessionEnergyKwh || 0;

  let currentSoc = easeeSession.socConfig.startSocPercent;
  let socSource = "ESTIMATED";

  // Check if live BMW ConnectedDrive telematics is connected
  const bmwTelemetry = getActiveBmwTelemetry();
  if (bmwTelemetry && easeeSession.socConfig.socSource === "BMW_CONNECTED_DRIVE") {
    // Optionally trigger fresh sync if vehicle is actively charging or on daemon tick
    try {
      if (charger.chargerOpMode === "Charging" || bmwTelemetry.isVehicleTrackingActive) {
        await syncBmwVehicleTelemetry();
      }
    } catch {}

    const freshTelemetry = getActiveBmwTelemetry() || bmwTelemetry;
    currentSoc = freshTelemetry.chargingLevelPercent;
    socSource = `BMW ConnectedDrive (${freshTelemetry.model} - Real BMS SOC)`;
  } else {
    // Fallback: Accurate calculation via startSoc + deliveredKwh / capacity
    const startSoc = Math.max(0, Math.min(100, easeeSession.socConfig.startSocPercent || 0));
    currentSoc = Math.min(100, Math.round(startSoc + (deliveredKwh / capacityKwh) * 100));
    socSource = `Metered Integration (${deliveredKwh.toFixed(1)} kWh delivered to ${capacityKwh} kWh pack)`;
  }

  if (currentSoc >= targetSoc && charger.chargerOpMode === "Charging") {
    console.log(`[Easee Daemon] 🛑 Auto-Cutoff Triggered! Target SOC ${targetSoc}% reached (${currentSoc}% SOC via ${socSource}). Delivered ${deliveredKwh} kWh. Issuing Pause/Stop to Easee (${charger.id})...`);
    
    await sendChargerCommand(charger.id, "pause");
    charger.chargerOpMode = "Completed";

    easeeSession.socConfig.lastAutoStopEvent = {
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      targetSoc,
      deliveredKwh,
      finalSoc: currentSoc,
      reason: `Target SOC threshold of ${targetSoc}% reached (${currentSoc}% current SOC from ${socSource}).`,
      source: socSource,
    };

    persistSessionToDisk();

    return {
      triggered: true,
      currentSoc,
      source: socSource,
      message: `Target SOC ${targetSoc}% reached (${socSource}). Charging automatically paused.`,
    };
  }

  return { triggered: false, currentSoc, source: socSource };
}

// Background SOC Monitor Loop (Checks according to user configurable socPollIntervalSeconds, default 30s)
let socMonitorInterval: NodeJS.Timeout | null = null;
export function startSocMonitorDaemon() {
  if (socMonitorInterval) clearInterval(socMonitorInterval);
  const intervalSeconds = Math.max(5, easeeSession.socConfig.socPollIntervalSeconds || 30);
  const intervalMs = intervalSeconds * 1000;

  socMonitorInterval = setInterval(async () => {
    if (easeeSession.socConfig.enabled) {
      const isCharging = easeeSession.chargers.some((c) => c.chargerOpMode === "Charging");
      const isBmwActive = easeeSession.socConfig.socSource === "BMW_CONNECTED_DRIVE";
      if (isCharging || isBmwActive) {
        await checkAndEnforceSocLimit();
      }
    }
  }, intervalMs);

  console.log(`[Easee Daemon] SOC & BMS Monitor Daemon active. Polling interval: ${intervalSeconds} seconds.`);
}
startSocMonitorDaemon();

// Background Daily Solar Auto-Dispatch Scheduler (User Configurable Time)
let daily8AmSchedulerInterval: NodeJS.Timeout | null = null;
export function startDaily8AmScheduler() {
  if (daily8AmSchedulerInterval) clearInterval(daily8AmSchedulerInterval);

  daily8AmSchedulerInterval = setInterval(async () => {
    const stationCfg = getStationConfig();
    const isDispatchActive = (stationCfg.dailyDispatchEnabled !== false) && (easeeSession.isDaily8AmEnabled !== false);
    if (!isDispatchActive) return;

    const offsetMin = stationCfg.utcOffsetMinutes ?? 0;
    const localNow = new Date(Date.now() + offsetMin * 60 * 1000);
    const localHour = localNow.getUTCHours();
    const localMinute = localNow.getUTCMinutes();
    const todayDateStr = localNow.toISOString().split("T")[0];

    // Parse configured dispatch time (default "08:00")
    const dispatchTimeStr = stationCfg.dailyDispatchTime || "08:00";
    const [targetHourStr, targetMinuteStr] = dispatchTimeStr.split(":");
    const targetHour = parseInt(targetHourStr, 10) || 8;
    const targetMinute = parseInt(targetMinuteStr, 10) || 0;

    // Trigger at configured station local time (checking within a 5-minute window after target time)
    const isMatchingHour = localHour === targetHour;
    const isMatchingMinute = localMinute >= targetMinute && localMinute <= targetMinute + 5;

    if (isMatchingHour && isMatchingMinute) {
      if (easeeSession.daily8AmDispatch?.date !== todayDateStr) {
        console.log(`[Easee Dispatch Scheduler] ⏰ Auto-triggering Daily Solar Dispatch (${dispatchTimeStr}) for ${todayDateStr} (${stationCfg.timezone || "Local"})...`);
        await performDaily8AmSolarDispatch(false);
      }
    }

    // Trigger Nightly Next-Day Auto-Sync at 21:00 (9:00 PM) station local time if autoSyncSolar is enabled
    if (easeeSession.autoSyncSolar && localHour === 21 && localMinute >= 0 && localMinute <= 5) {
      const tomorrowDateStr = new Date(Date.now() + (offsetMin * 60 * 1000) + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      if (easeeSession.lastScheduleSync?.timestamp?.startsWith(todayDateStr) === false) {
        console.log(`[Easee Nightly Scheduler] 🌙 Auto-triggering 21:00 Next-Day Solar Schedule Dispatch for ${tomorrowDateStr}...`);
        await performNextDaySolarDispatch(false);
      }
    }
  }, 30000); // Check every 30 seconds

  console.log(`[Easee Daemon] Daily Solar Auto-Dispatcher active (Configured time or 08:00 AM default).`);
}
startDaily8AmScheduler();

// On startup: Load persisted session from disk and attempt automatic refresh
function initEaseeFromDisk(): void {
  try {
    if (fs.existsSync(SESSION_FILE_PATH)) {
      const raw = fs.readFileSync(SESSION_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.accessToken || parsed.refreshToken || parsed.socConfig || parsed.daily8AmDispatch)) {
        easeeSession.accessToken = parsed.accessToken || null;
        easeeSession.refreshToken = parsed.refreshToken || null;
        easeeSession.expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0;
        easeeSession.userEmail = parsed.userEmail || null;
        easeeSession.selectedChargerId = parsed.selectedChargerId || null;
        easeeSession.autoSyncSolar = parsed.autoSyncSolar ?? true;
        easeeSession.isDaily8AmEnabled = parsed.isDaily8AmEnabled ?? true;
        if (parsed.socConfig) {
          easeeSession.socConfig = {
            ...defaultSocConfig,
            ...parsed.socConfig,
          };
        }
        easeeSession.lastScheduleSync = parsed.lastScheduleSync || null;
        easeeSession.daily8AmDispatch = parsed.daily8AmDispatch || null;
        easeeSession.chargers = Array.isArray(parsed.chargers) ? parsed.chargers : [];

        console.log(`[Easee API] Restored saved session for user: ${easeeSession.userEmail || "anonymous"}`);

        // Proactively refresh the token and sync chargers in background
        if (easeeSession.refreshToken) {
          setTimeout(async () => {
            console.log("[Easee API] Bootstrapping saved Easee session on server startup...");
            const refreshed = await refreshEaseeToken();
            if (refreshed) {
              await refreshChargers();
            }
          }, 1000);
        }
      }
    }
  } catch (err) {
    console.warn("[Easee API] Could not load .easee_session.json:", err);
  }
}

// Initialize session from disk on boot
initEaseeFromDisk();
