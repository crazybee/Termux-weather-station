import React, { useState, useEffect } from "react";
import {
  Zap,
  Sun,
  BatteryCharging,
  Clock,
  CloudSun,
  ShieldCheck,
  Sparkles,
  Sliders,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Settings2,
  Power,
  Lock,
  Globe,
  RotateCcw,
  Gauge,
  Check,
  Car,
  Play,
  Pause,
  Timer,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { EvSolarPrediction, WeatherData, EaseeAccountStatus, EvBatterySocConfig, ConsolidatedUserConfig } from "../types";
import { convertLocalToUtc, formatUtcOffset, parseTimeTo24H } from "../utils/timezoneUtils";

interface EvSolarChargingCardProps {
  weather: WeatherData;
  prediction: EvSolarPrediction;
  easeeStatus: EaseeAccountStatus | null;
  stationConfig?: ConsolidatedUserConfig | null;
  onUpdateStationConfig?: (partial: Partial<ConsolidatedUserConfig>) => Promise<void>;
  onOpenEaseeModal: () => void;
  onOpenBmwModal?: () => void;
  onSyncSolarSchedule: (
    startTime: string,
    stopTime: string,
    targetAmps: number,
    phaseMode: 1 | 3,
    maxCurrentAmps?: number
  ) => Promise<boolean>;
  onUpdateSocConfig?: (config: Partial<EvBatterySocConfig>) => Promise<boolean>;
  onUpdateBmwTelemetry?: (payload: any) => Promise<boolean>;
  onSyncBmwTelemetry?: () => Promise<boolean>;
  onSendCommand?: (chargerId: string, cmd: "start" | "pause" | "resume" | "toggle_lock") => Promise<void>;
}

const VEHICLE_PRESETS = [
  { name: "BMW i3 120Ah", capacity: 42.2 },
  { name: "BMW i3 94Ah", capacity: 33.2 },
  { name: "BMW i3 60Ah", capacity: 22.0 },
  { name: "BMW i4 / iX1", capacity: 80.7 },
  { name: "Tesla Model Y / 3 Long Range", capacity: 75 },
  { name: "Tesla Model Y / 3 Standard", capacity: 60 },
  { name: "Volkswagen ID.4 / ID.3", capacity: 77 },
  { name: "BYD Atto 3 / Dolphin", capacity: 60.5 },
  { name: "Custom EV Battery", capacity: 42.2 },
];

export const EvSolarChargingCard: React.FC<EvSolarChargingCardProps> = ({
  weather,
  prediction,
  easeeStatus,
  stationConfig,
  onUpdateStationConfig,
  onOpenEaseeModal,
  onOpenBmwModal,
  onSyncSolarSchedule,
  onUpdateSocConfig,
  onUpdateBmwTelemetry,
  onSyncBmwTelemetry,
  onSendCommand,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showBatteryConfig, setShowBatteryConfig] = useState(false);
  const [arraySizeKw, setArraySizeKw] = useState(3.5); // Default ~3.5 kW for 9 solar panels (e.g. 9 x 400W = 3.6kW)
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBmwSyncing, setIsBmwSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [socFeedbackMsg, setSocFeedbackMsg] = useState<string | null>(null);
  const [commandInProgress, setCommandInProgress] = useState<string | null>(null);

  const [isDispatchingNow, setIsDispatchingNow] = useState(false);
  const [showDispatchSettings, setShowDispatchSettings] = useState(false);

  // Calculate location timezone & UTC offset in minutes
  const locationUtcOffsetMinutes =
    typeof weather.utcOffsetSeconds === "number"
      ? Math.round(weather.utcOffsetSeconds / 60)
      : -new Date().getTimezoneOffset();

  const locationTzName = weather.timezone || "Local Time";
  const locationOffsetLabel = formatUtcOffset(locationUtcOffsetMinutes);

  // SOC State Management
  const currentSocConfig: EvBatterySocConfig = easeeStatus?.socConfig || {
    enabled: true,
    batteryCapacityKwh: 75,
    startSocPercent: 40,
    targetSocPercent: 90,
    vehicleModelName: "Standard EV (75 kWh)",
    lastAutoStopEvent: null,
  };

  const [localTargetSoc, setLocalTargetSoc] = useState(currentSocConfig.targetSocPercent || 90);
  const [localStartSoc, setLocalStartSoc] = useState(currentSocConfig.startSocPercent || 40);
  const [localBatteryCap, setLocalBatteryCap] = useState(currentSocConfig.batteryCapacityKwh || 75);
  const [localAutoStopEnabled, setLocalAutoStopEnabled] = useState(currentSocConfig.enabled ?? true);
  const [localPollIntervalSec, setLocalPollIntervalSec] = useState(currentSocConfig.socPollIntervalSeconds || 30);
  const [customPollInput, setCustomPollInput] = useState<number>(currentSocConfig.socPollIntervalSeconds || 30);

  // Sync local SOC states if server status updates
  useEffect(() => {
    if (easeeStatus?.socConfig) {
      setLocalTargetSoc(easeeStatus.socConfig.targetSocPercent);
      setLocalStartSoc(easeeStatus.socConfig.startSocPercent);
      setLocalBatteryCap(easeeStatus.socConfig.batteryCapacityKwh);
      setLocalAutoStopEnabled(easeeStatus.socConfig.enabled);
      if (easeeStatus.socConfig.socPollIntervalSeconds) {
        setLocalPollIntervalSec(easeeStatus.socConfig.socPollIntervalSeconds);
        setCustomPollInput(easeeStatus.socConfig.socPollIntervalSeconds);
      }
    }
  }, [easeeStatus?.socConfig]);

  // Live charger & BMW telemetry
  const activeCharger =
    easeeStatus?.chargers?.find((c) => c.id === easeeStatus.selectedChargerId) ||
    easeeStatus?.chargers?.[0];

  const bmwStatus = currentSocConfig.bmwStatus;
  const isBmwConnected = Boolean(bmwStatus?.isLoggedIn && bmwStatus.vehicles.length > 0);
  const activeBmw = bmwStatus?.vehicles?.find((v) => v.vin === bmwStatus.selectedVin) || bmwStatus?.vehicles?.[0];

  const sessionDeliveredKwh = activeCharger?.sessionEnergyKwh || 0;

  // Real BMS SOC from BMW ConnectedDrive if connected; else calculate from startSoc + sessionDelivered
  const currentEstimatedSoc = isBmwConnected && activeBmw
    ? activeBmw.chargingLevelPercent
    : Math.min(
        100,
        Math.round(localStartSoc + (sessionDeliveredKwh / Math.max(10, localBatteryCap)) * 100)
      );

  const isTargetSocReached = currentEstimatedSoc >= localTargetSoc;
  const isCurrentlyCharging = activeCharger?.chargerOpMode === "Charging";

  const energyNeededKwh = Math.max(
    0,
    Number((((localTargetSoc - currentEstimatedSoc) / 100) * localBatteryCap).toFixed(1))
  );

  // User-configurable Sync Phase & Max Current Options (Defaults from SQLite DB: 1-phase 6A for 9 panels)
  const [syncPhaseMode, setSyncPhaseMode] = useState<1 | 3>(() => {
    if (stationConfig?.defaultEaseePhaseMode === 3) return 3;
    try {
      const saved = localStorage.getItem("easee_sync_phase_mode");
      if (saved === "3") return 3;
    } catch {}
    return 1; // Default single phase (1-phase)
  });

  const [syncMaxAmps, setSyncMaxAmps] = useState<number>(() => {
    if (stationConfig?.defaultEaseeMaxCurrent) return stationConfig.defaultEaseeMaxCurrent;
    try {
      const saved = localStorage.getItem("easee_sync_max_amps");
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num) && num >= 6 && num <= 32) return num;
      }
    } catch {}
    return 6; // Default 6 Amps
  });

  // Sync state when stationConfig loads from SQLite database
  useEffect(() => {
    if (stationConfig?.defaultEaseePhaseMode) {
      setSyncPhaseMode(stationConfig.defaultEaseePhaseMode);
    }
    if (stationConfig?.defaultEaseeMaxCurrent) {
      setSyncMaxAmps(stationConfig.defaultEaseeMaxCurrent);
    }
  }, [stationConfig?.defaultEaseePhaseMode, stationConfig?.defaultEaseeMaxCurrent]);

  // Calculate detected schedule window in 24h format (e.g. "12:30 PM" -> "12:30", "0:00 AM" -> "00:00", "6:00 AM" -> "06:00")
  const isForecastSuitable = prediction.verdict !== "POOR" && (prediction.isSuitableForCharging ?? true);
  const detectedStart24 = parseTimeTo24H(prediction.peakWindowStart, isForecastSuitable ? "10:30" : "00:00");
  const detectedStop24 = parseTimeTo24H(prediction.peakWindowEnd, isForecastSuitable ? "15:30" : "06:00");

  // Determine active schedule from sync state or charger basic_charge_plan
  const activeScheduleInfo = easeeStatus?.lastScheduleSync || (activeCharger?.currentSchedule ? {
    startTime: activeCharger.currentSchedule.startTime,
    stopTime: activeCharger.currentSchedule.stopTime,
    utcStartTime: activeCharger.currentSchedule.utcStartTime,
    utcStopTime: activeCharger.currentSchedule.utcStopTime,
    amps: activeCharger.dynamicCurrentAmps || 6,
    phaseMode: activeCharger.phaseMode || 1,
    timestamp: "Cloud Synced",
    timezone: `${locationTzName} (${locationOffsetLabel})`,
    status: "SUCCESS",
  } : null);

  const [syncStartTime, setSyncStartTime] = useState<string>(() => detectedStart24);
  const [syncStopTime, setSyncStopTime] = useState<string>(() => detectedStop24);
  const [isUserCustomizedTime, setIsUserCustomizedTime] = useState(false);

  // Automatically update schedule times whenever prediction peak window is updated
  useEffect(() => {
    if (!isUserCustomizedTime) {
      setSyncStartTime(detectedStart24);
      setSyncStopTime(detectedStop24);
    }
  }, [detectedStart24, detectedStop24, isUserCustomizedTime]);

  const handleResetToDetectedPeak = () => {
    setIsUserCustomizedTime(false);
    setSyncStartTime(detectedStart24);
    setSyncStopTime(detectedStop24);
  };

  const handleUseActiveSchedule = () => {
    if (activeScheduleInfo) {
      setIsUserCustomizedTime(true);
      setSyncStartTime(activeScheduleInfo.startTime);
      setSyncStopTime(activeScheduleInfo.stopTime);
      if (activeScheduleInfo.phaseMode) setSyncPhaseMode(activeScheduleInfo.phaseMode as 1 | 3);
      if (activeScheduleInfo.amps) setSyncMaxAmps(activeScheduleInfo.amps);
    }
  };

  // Persist phase & current preferences in SQLite DB & localStorage
  const handlePhaseChange = (phase: 1 | 3) => {
    setSyncPhaseMode(phase);
    try {
      localStorage.setItem("easee_sync_phase_mode", String(phase));
    } catch {}
    if (onUpdateStationConfig) {
      onUpdateStationConfig({ defaultEaseePhaseMode: phase }).catch(() => {});
    } else {
      fetch("/api/station/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultEaseePhaseMode: phase }),
      }).catch(() => {});
    }
  };

  const handleMaxAmpsChange = (amps: number) => {
    setSyncMaxAmps(amps);
    try {
      localStorage.setItem("easee_sync_max_amps", String(amps));
    } catch {}
    if (onUpdateStationConfig) {
      onUpdateStationConfig({ defaultEaseeMaxCurrent: amps }).catch(() => {});
    } else {
      fetch("/api/station/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultEaseeMaxCurrent: amps }),
      }).catch(() => {});
    }
  };

  // Save SOC settings to backend
  const handleSaveSocThreshold = async (
    newTarget?: number,
    newStart?: number,
    newCap?: number,
    newEnabled?: boolean,
    modelName?: string
  ) => {
    const target = newTarget ?? localTargetSoc;
    const start = newStart ?? localStartSoc;
    const cap = newCap ?? localBatteryCap;
    const enabled = newEnabled ?? localAutoStopEnabled;

    if (newTarget !== undefined) setLocalTargetSoc(newTarget);
    if (newStart !== undefined) setLocalStartSoc(newStart);
    if (newCap !== undefined) setLocalBatteryCap(cap);
    if (newEnabled !== undefined) setLocalAutoStopEnabled(enabled);

    if (onUpdateSocConfig) {
      const ok = await onUpdateSocConfig({
        targetSocPercent: target,
        startSocPercent: start,
        batteryCapacityKwh: cap,
        enabled,
        ...(modelName ? { vehicleModelName: modelName } : {}),
      });
      if (ok) {
        setSocFeedbackMsg(`Target SOC Threshold updated to ${target}% (${enabled ? "Auto-Stop Active" : "Disabled"}).`);
        setTimeout(() => setSocFeedbackMsg(null), 5000);
      }
    }
  };

  const handleSaveSocInterval = async (sec: number) => {
    const validSec = Math.max(5, Math.min(3600, Math.round(sec) || 30));
    setLocalPollIntervalSec(validSec);
    setCustomPollInput(validSec);
    if (onUpdateSocConfig) {
      const ok = await onUpdateSocConfig({
        socPollIntervalSeconds: validSec,
      });
      if (ok) {
        setSocFeedbackMsg(`SOC Update Frequency set to ${validSec}s (Polling Every ${validSec} Seconds).`);
        setTimeout(() => setSocFeedbackMsg(null), 4000);
      }
    }
  };

  const handleQuickCommand = async (cmd: "start" | "pause" | "resume") => {
    if (!activeCharger || !onSendCommand) return;
    setCommandInProgress(cmd);
    try {
      await onSendCommand(activeCharger.id, cmd);
    } finally {
      setCommandInProgress(null);
    }
  };
  const tomorrowDateFormatted = (() => {
    try {
      const tomorrow = weather.daily[1]?.date;
      if (!tomorrow) return "Tomorrow";
      return new Date(tomorrow).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Tomorrow";
    }
  })();

  // Scaled production based on custom solar capacity (e.g. 9 panels * 400W = ~3.6kW)
  const scaledGenerationKwh = Math.round(
    ((prediction.estimatedSolarKwh * (arraySizeKw / 6.5))) * 10
  ) / 10;

  // Typical EV battery capacity (e.g. 60kWh standard range) -> % charged from solar
  const evChargePct = Math.min(100, Math.round((scaledGenerationKwh / 58) * 100));
  const addedKmRange = Math.round(scaledGenerationKwh * 5.8); // ~5.8 km per kWh for average EV

  const isFavorable = prediction.verdict === "EXCELLENT" || prediction.verdict === "GOOD";

  // Calculate approximate charging power in kW
  // 1-phase: 230V * Amps = W (e.g. 230V * 6A = ~1.38 kW)
  // 3-phase: 230V * 1.732 * Amps = W (e.g. 400V * 1.732 * 6A = ~4.14 kW)
  const estimatedChargingPowerKw =
    syncPhaseMode === 1
      ? Math.round((230 * syncMaxAmps) / 10) / 100
      : Math.round((230 * 3 * syncMaxAmps) / 10) / 100;

  // UTC times that are dispatched to Easee Cloud
  const cloudUtcStartTime = convertLocalToUtc(syncStartTime, locationUtcOffsetMinutes);
  const cloudUtcStopTime = convertLocalToUtc(syncStopTime, locationUtcOffsetMinutes);

  const handleOneClickSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMessage(null);
    try {
      const success = await onSyncSolarSchedule(
        syncStartTime,
        syncStopTime,
        syncMaxAmps,
        syncPhaseMode,
        syncMaxAmps
      );
      if (success) {
        const phaseName = syncPhaseMode === 1 ? "1-Phase (Single)" : "3-Phase";
        setSyncSuccessMessage(
          `Successfully programmed Easee: ${syncStartTime} – ${syncStopTime} (${weather.city || "Local"} ${locationOffsetLabel} / Cloud UTC: ${cloudUtcStartTime} – ${cloudUtcStopTime}) @ ${syncMaxAmps}A (${phaseName} ~${estimatedChargingPowerKw}kW).`
        );
        setTimeout(() => setSyncSuccessMessage(null), 9000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      id="ev-solar-charging-forecast"
      className="relative rounded-2xl glass-card border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 shadow-xl overflow-hidden transition-all text-slate-800 dark:text-slate-100"
    >
      {/* Decorative radial glows */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/10 dark:bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-amber-500/10 dark:bg-amber-500/5 blur-3xl" />

      {/* Top Banner Accent */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${
          prediction.verdict === "EXCELLENT"
            ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"
            : prediction.verdict === "GOOD"
            ? "bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-500"
            : prediction.verdict === "MODERATE"
            ? "bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500"
            : "bg-gradient-to-r from-rose-500 via-pink-400 to-rose-500"
        }`}
      />

      {/* Header */}
      <div className="relative flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-2xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Tomorrow's Solar &amp; EV Charging Advisor
                </h3>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono shadow-2xs">
                  Easee Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {tomorrowDateFormatted} • Meteorological Solar Generation &amp; Charger Smart Advice
              </p>
            </div>
          </div>
        </div>

        {/* Prediction Badge */}
        <div className="flex items-center gap-2">
          <div
            className={`px-4 py-1.5 rounded-xl font-extrabold text-xs tracking-wider shadow-md flex items-center gap-2 font-mono ${
              prediction.verdict === "EXCELLENT"
                ? "bg-emerald-600 text-white shadow-emerald-500/20"
                : prediction.verdict === "GOOD"
                ? "bg-teal-600 text-white shadow-teal-500/20"
                : prediction.verdict === "MODERATE"
                ? "bg-amber-600 text-white shadow-amber-500/20"
                : "bg-rose-600 text-white shadow-rose-500/20"
            }`}
          >
            <Sun className="w-4 h-4" />
            <span>
              {prediction.verdict === "EXCELLENT" && "EXCELLENT FOR SOLAR CHARGING"}
              {prediction.verdict === "GOOD" && "GOOD SOLAR CHARGING DAY"}
              {prediction.verdict === "MODERATE" && "MODERATE / BLENDED CHARGE"}
              {prediction.verdict === "POOR" && "POOR SOLAR - CHARGE OFF-PEAK"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Alert Box / Verdict */}
      <div
        className={`relative rounded-2xl p-5 mb-6 border backdrop-blur-md ${
          isFavorable
            ? "bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
            : prediction.verdict === "MODERATE"
            ? "bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
            : "bg-rose-500/10 dark:bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sm">
              {isFavorable ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              )}
              <span className="text-slate-900 dark:text-white font-extrabold">{prediction.summary}</span>
            </div>
            <p className="text-xs opacity-90 leading-relaxed font-medium">
              <b>Easee Charger Setting:</b> {prediction.easeeRecommendation}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200/50 dark:border-slate-700/50">
            <div className="text-center px-3.5 py-2 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs backdrop-blur-md">
              <div className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-bold tracking-wider">
                Solar Index
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                {prediction.score}
                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">/100</span>
              </div>
            </div>
            <div className="text-center px-3.5 py-2 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 shadow-2xs backdrop-blur-md">
              <div className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-bold tracking-wider">
                {isForecastSuitable ? "Peak Window" : "Night Charging"}
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono whitespace-nowrap">
                {isForecastSuitable ? `${prediction.peakWindowStart} - ${prediction.peakWindowEnd}` : "0:00 AM - 6:00 AM"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* DIRECT EASEE ONE-CLICK SYNC & HARDWARE CONTROL HUB */}
      {/* ========================================================= */}
      <div className="mb-5 p-4 sm:p-5 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h4 className="font-bold text-sm text-white">Easee Cloud Schedule Automation</h4>
              {easeeStatus?.isLoggedIn ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  {activeCharger?.name || "Connected"} ({activeCharger?.id || "EH849201"})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  Not Linked
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {easeeStatus?.isLoggedIn
                ? isForecastSuitable
                  ? `Ready to program tomorrow's ${syncStartTime} – ${syncStopTime} solar window directly to your Easee wallbox.`
                  : `Tomorrow's weather is not suitable for solar charging. Next day schedule is configured from 0:00 to 6:00 AM (overnight off-peak).`
                : "Connect your Easee account to automatically program charging schedules and avoid manual phone operation."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto shrink-0">
            {easeeStatus?.isLoggedIn ? (
              <>
                <button
                  id="btn-one-click-sync-easee"
                  disabled={isSyncing}
                  onClick={handleOneClickSync}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 disabled:opacity-50"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Syncing to Easee...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-slate-950" />
                      <span>
                        {isForecastSuitable ? "1-Click Sync Solar Schedule" : "1-Click Sync Schedule (0:00 – 6:00 AM)"}
                      </span>
                    </>
                  )}
                </button>

                <button
                  onClick={onOpenEaseeModal}
                  title="Configure Easee Charger Settings"
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={onOpenEaseeModal}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition-transform active:scale-95"
              >
                <Zap className="w-4 h-4" />
                <span>Connect Easee Charger</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync Parameters Customizer (Phase & Amperage selector) */}
        <div className="mt-4 pt-3.5 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-300">Charging Hardware Constraints &amp; Defaults:</span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded flex items-center gap-1">
              <span>SQLite Consolidated:</span>
              <span className="font-bold text-white">{syncPhaseMode}-Phase • {syncMaxAmps}A</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Phase Mode Selection */}
          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">Phase Mode:</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                {syncPhaseMode === 1 ? "1-Phase (Solar Surplus)" : "3-Phase (High Power)"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handlePhaseChange(1)}
                className={`py-1.5 px-2 rounded-md font-mono text-xs font-bold text-center transition-colors ${
                  syncPhaseMode === 1
                    ? "bg-emerald-500 text-slate-950 shadow-xs"
                    : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
                }`}
              >
                1-Phase (Single)
              </button>
              <button
                type="button"
                onClick={() => handlePhaseChange(3)}
                className={`py-1.5 px-2 rounded-md font-mono text-xs font-bold text-center transition-colors ${
                  syncPhaseMode === 3
                    ? "bg-emerald-500 text-slate-950 shadow-xs"
                    : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
                }`}
              >
                3-Phase
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              {syncPhaseMode === 1
                ? "Locks to 1-phase (min 1.4kW), ideal for 9 solar panels."
                : "Requires 4.1kW minimum surplus (3x 6A)."}
            </p>
          </div>

          {/* Max Current Selection */}
          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">Max Current:</span>
              <span className="text-[10px] font-mono text-amber-300 font-bold">
                {syncMaxAmps}A (~{estimatedChargingPowerKw} kW)
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[6, 8, 10, 13, 16].map((amp) => (
                <button
                  key={amp}
                  type="button"
                  onClick={() => handleMaxAmpsChange(amp)}
                  className={`flex-1 py-1 px-1.5 rounded-md font-mono text-xs font-bold text-center transition-colors ${
                    syncMaxAmps === amp
                      ? "bg-amber-400 text-slate-950 shadow-xs"
                      : "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {amp}A
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">
              6A on 1-phase uses ~1.38 kW matching typical 9-panel yield.
            </p>
          </div>

          {/* Schedule Window Times */}
          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">Target Time Window:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeScheduleInfo && (syncStartTime !== activeScheduleInfo.startTime || syncStopTime !== activeScheduleInfo.stopTime) && (
                  <button
                    type="button"
                    onClick={handleUseActiveSchedule}
                    className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 underline transition-colors"
                    title={`Load active charger schedule (${activeScheduleInfo.startTime} – ${activeScheduleInfo.stopTime})`}
                  >
                    <span>Load Active ({activeScheduleInfo.startTime}–{activeScheduleInfo.stopTime})</span>
                  </button>
                )}
                {isUserCustomizedTime && (
                  <button
                    type="button"
                    onClick={handleResetToDetectedPeak}
                    className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 underline transition-colors"
                    title={`Reset to detected schedule window (${detectedStart24} – ${detectedStop24})`}
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>{isForecastSuitable ? "Reset Solar Peak" : "Reset to 0:00–6:00 AM"}</span>
                  </button>
                )}
                <span className="text-[10px] font-mono text-blue-400 font-bold flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {locationOffsetLabel}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="text-[9px] uppercase font-mono text-slate-400 block mb-0.5">
                  Local Start
                </label>
                <input
                  type="time"
                  value={syncStartTime}
                  onChange={(e) => {
                    setIsUserCustomizedTime(true);
                    setSyncStartTime(e.target.value);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white text-center focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-mono text-slate-400 block mb-0.5">
                  Local Stop
                </label>
                <input
                  type="time"
                  value={syncStopTime}
                  onChange={(e) => {
                    setIsUserCustomizedTime(true);
                    setSyncStopTime(e.target.value);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white text-center focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="truncate">
                Local: {syncStartTime} – {syncStopTime}
                {!isUserCustomizedTime && (
                  <span className={`ml-1 font-semibold ${isForecastSuitable ? "text-emerald-400" : "text-amber-400"}`}>
                    {isForecastSuitable ? "(Peak Forecast)" : "(0:00–6:00 AM Fallback)"}
                  </span>
                )}
              </span>
              <span className="text-emerald-400 font-semibold shrink-0 ml-1" title={`Converted to UTC for Easee Cloud API (${locationTzName})`}>
                Easee UTC: {cloudUtcStartTime} – {cloudUtcStopTime}
              </span>
            </div>
          </div>
        </div>
        </div>

        {/* Sync Success Feedback Banner */}
        {syncSuccessMessage && (
          <div className="mt-3 p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncSuccessMessage}</span>
          </div>
        )}

        {/* Active Schedule Info */}
        {activeScheduleInfo && !syncSuccessMessage && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2 font-mono flex-wrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>
                Active Easee Schedule: <strong className="text-emerald-300">{activeScheduleInfo.startTime} – {activeScheduleInfo.stopTime}</strong> (Local {locationOffsetLabel})
                {activeScheduleInfo.utcStartTime && (
                  <span className="text-slate-500 ml-1">
                    [Cloud UTC: {activeScheduleInfo.utcStartTime}–{activeScheduleInfo.utcStopTime}]
                  </span>
                )}
                {" "}@ {activeScheduleInfo.amps}A ({activeScheduleInfo.phaseMode === 3 ? "3-Phase" : "1-Phase"})
              </span>
            </div>
            <div className="text-slate-500 font-mono text-[10px]">
              {activeScheduleInfo.timestamp ? `Last synced: ${activeScheduleInfo.timestamp}` : "Cloud Live"}
            </div>
          </div>
        )}

        {/* Daily Solar Auto-Dispatch Status Strip & Customization */}
        {(() => {
          const dispatchTime = stationConfig?.dailyDispatchTime || "08:00";
          const isDispatchEnabled = stationConfig?.dailyDispatchEnabled !== false;
          return (
            <div className="mt-3 pt-3 border-t border-slate-800/80 bg-slate-950/50 p-3.5 rounded-lg flex flex-col gap-3 text-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex h-2 w-2 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDispatchEnabled ? "bg-amber-400" : "bg-slate-500"} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isDispatchEnabled ? "bg-amber-500" : "bg-slate-600"}`}></span>
                    </span>
                    <span className="font-bold text-slate-200">
                      Daily Solar Auto-Dispatch ({dispatchTime}):
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      isDispatchEnabled
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}>
                      {isDispatchEnabled ? "Daemon Active" : "Disabled"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      SQLite 3 Persisted
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {easeeStatus?.daily8AmDispatch
                      ? `Last ran for ${easeeStatus.daily8AmDispatch.date}: ${easeeStatus.daily8AmDispatch.message}`
                      : `Automatically retrieves morning solar forecast daily at ${dispatchTime} and programs today's peak window to Easee.`}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowDispatchSettings(!showDispatchSettings)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-[11px] flex items-center gap-1.5 transition-colors"
                    title="Customize daily dispatch schedule time and parameters"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{showDispatchSettings ? "Hide Settings" : "Configure Time"}</span>
                  </button>

                  <button
                    id="btn-trigger-daily-solar-dispatch"
                    disabled={isDispatchingNow}
                    onClick={async () => {
                      try {
                        setIsDispatchingNow(true);
                        const token = localStorage.getItem("station_admin_token") || "";
                        const res = await fetch("/api/easee/trigger-daily-dispatch", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                        });
                        const data = await res.json();
                        if (data.success) {
                          setSyncSuccessMessage(data.message || `Daily ${dispatchTime} solar dispatch triggered successfully!`);
                          setTimeout(() => setSyncSuccessMessage(null), 9000);
                        } else {
                          alert(data.message || "Failed to trigger dispatch. Make sure you are authenticated as admin.");
                        }
                      } catch (e: any) {
                        alert(`Trigger error: ${e.message}`);
                      } finally {
                        setIsDispatchingNow(false);
                      }
                    }}
                    title={`Test run ${dispatchTime} automated solar forecast calculation and Easee schedule dispatch right now`}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isDispatchingNow ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sun className="w-3.5 h-3.5" />
                    )}
                    <span>{isDispatchingNow ? "Dispatching..." : "Run Dispatch Now"}</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Dispatch Settings Panel */}
              {showDispatchSettings && (
                <div className="mt-2 pt-3 border-t border-slate-800/80 bg-slate-900/60 p-3 rounded-lg flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-slate-300 text-xs font-semibold">Dispatch Time:</label>
                      <input
                        type="time"
                        value={dispatchTime}
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (val && /^([01]\d|2[0-3]):[0-5]\d$/.test(val)) {
                            await onUpdateStationConfig?.({ dailyDispatchTime: val });
                          }
                        }}
                        className="bg-slate-950 border border-slate-700 text-slate-100 px-2.5 py-1 rounded text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-slate-300 text-xs font-semibold">Enable Auto-Dispatch:</label>
                      <button
                        type="button"
                        onClick={async () => {
                          await onUpdateStationConfig?.({ dailyDispatchEnabled: !isDispatchEnabled });
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                          isDispatchEnabled
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                        }`}
                      >
                        {isDispatchEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[11px] text-slate-400">Quick Presets:</span>
                    {["06:00", "07:00", "07:30", "08:00", "08:30", "09:00"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={async () => {
                          await onUpdateStationConfig?.({ dailyDispatchTime: preset });
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                          dispatchTime === preset
                            ? "bg-amber-500 text-slate-950 font-bold"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <Sun className="w-3.5 h-3.5 text-amber-500" /> Est. PV Generation
          </div>
          <div className="text-base font-bold text-slate-900 font-mono">
            ~{scaledGenerationKwh}{" "}
            <span className="text-xs font-normal text-slate-500 font-sans">kWh</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Based on {arraySizeKw} kW array
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" /> Added EV Range
          </div>
          <div className="text-base font-bold text-slate-900 font-mono">
            +{addedKmRange}{" "}
            <span className="text-xs font-normal text-slate-500 font-sans">km</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            ~{evChargePct}% of {localBatteryCap}kWh battery
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <CloudSun className="w-3.5 h-3.5 text-blue-500" /> Avg Cloud Cover
          </div>
          <div className="text-base font-bold text-slate-900 font-mono">
            {prediction.cloudCoverageAvg}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {prediction.cloudCoverageAvg < 25 ? "Clear Sky" : prediction.cloudCoverageAvg < 60 ? "Scattered" : "Overcast"}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
            <Clock className="w-3.5 h-3.5 text-indigo-500" /> Peak Sun Hours
          </div>
          <div className="text-base font-bold text-slate-900 font-mono">
            {prediction.solarHours}{" "}
            <span className="text-xs font-normal text-slate-500 font-sans">hours</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            UV &gt;= 3 with clear sky
          </div>
        </div>
      </div>

      {/* EV Battery State & Automatic SOC Cutoff Hub */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">EV Battery Target SOC &amp; Auto-Cutoff Guard</h4>
                {localAutoStopEnabled ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Auto-Stop Active ({localTargetSoc}% SOC)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    Auto-Stop Inactive
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Automatically dispatches stop/pause command to Easee charger when battery reaches your target threshold.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenBmwModal && (
              <button
                type="button"
                onClick={onOpenBmwModal}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                  isBmwConnected
                    ? "bg-blue-900/60 border-blue-500/60 text-blue-200 hover:bg-blue-850"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
                title={isBmwConnected ? "BMW ConnectedDrive Active" : "Connect BMW ID to read live SOC"}
              >
                <Car className="w-3.5 h-3.5 text-blue-400" />
                <span>{isBmwConnected ? `BMW i3 (${activeBmw?.chargingLevelPercent}% SOC)` : "Connect BMW ID"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowBatteryConfig(!showBatteryConfig)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentSocConfig.vehicleModelName || "Vehicle Settings"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveSocThreshold(undefined, undefined, undefined, !localAutoStopEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs ${
                localAutoStopEnabled
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{localAutoStopEnabled ? "Enabled" : "Disabled"}</span>
            </button>
          </div>
        </div>

        {/* BMW Backend Fetch Error Banner */}
        {bmwStatus?.error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex flex-wrap items-center justify-between gap-2.5 font-mono shadow-xs">
            <div className="flex items-start gap-2 max-w-xl">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-300">BMW ConnectedDrive Sync Error</div>
                <div className="text-[11px] text-rose-300/90 mt-0.5 break-all">{bmwStatus.error}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={isBmwSyncing}
                onClick={async () => {
                  setIsBmwSyncing(true);
                  try {
                    if (onSyncBmwTelemetry) await onSyncBmwTelemetry();
                    else await fetch("/api/bmw/sync", { method: "POST" });
                  } finally {
                    setIsBmwSyncing(false);
                  }
                }}
                className="px-2.5 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white text-[11px] font-sans font-medium transition-colors disabled:opacity-50"
              >
                {isBmwSyncing ? "Retrying..." : "Retry Fetch"}
              </button>
              {onOpenBmwModal && (
                <button
                  type="button"
                  onClick={onOpenBmwModal}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-sans font-medium transition-colors"
                >
                  BMW Login
                </button>
              )}
            </div>
          </div>
        )}

        {/* Easee Cloud Error Banner */}
        {easeeStatus?.error && (
          <div className="mb-4 p-3 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-2.5 font-mono shadow-xs">
            <div className="flex items-start gap-2 max-w-xl">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-300">Easee Cloud Error</div>
                <div className="text-[11px] text-amber-300/90 mt-0.5 break-all">{easeeStatus.error}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch("/api/easee/chargers");
                  } catch {}
                }}
                className="px-2.5 py-1 rounded bg-amber-800 hover:bg-amber-700 text-white text-[11px] font-sans font-medium transition-colors"
              >
                Retry Easee
              </button>
              {onOpenEaseeModal && (
                <button
                  type="button"
                  onClick={onOpenEaseeModal}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-sans font-medium transition-colors"
                >
                  Easee Login
                </button>
              )}
            </div>
          </div>
        )}

        {/* Feedback / Toast Notification */}
        {socFeedbackMsg && (
          <div className="mb-3 p-2.5 rounded-lg bg-blue-950/80 border border-blue-800/80 text-blue-200 text-xs font-mono flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>{socFeedbackMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSocFeedbackMsg(null)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Battery Vehicle Preset Selector (Collapsible) */}
        {showBatteryConfig && (
          <div className="mb-4 p-3.5 rounded-lg bg-slate-800/90 border border-slate-700 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-blue-400" /> Select Vehicle &amp; Battery Pack Capacity
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {localBatteryCap} kWh Pack
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {VEHICLE_PRESETS.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => handleSaveSocThreshold(undefined, undefined, v.capacity, undefined, v.name)}
                  className={`p-2 rounded-lg text-left text-xs transition-colors border ${
                    localBatteryCap === v.capacity && currentSocConfig.vehicleModelName === v.name
                      ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-200"
                      : "bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <div className="font-semibold truncate">{v.name}</div>
                  <div className="text-[10px] font-mono text-slate-400">{v.capacity} kWh</div>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Custom Pack Size:</span>
                <input
                  type="number"
                  min={10}
                  max={200}
                  step={0.5}
                  value={localBatteryCap}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      setLocalBatteryCap(val);
                    }
                  }}
                  onBlur={() => handleSaveSocThreshold(undefined, undefined, localBatteryCap, undefined, "Custom EV")}
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white text-center focus:outline-hidden focus:border-emerald-500"
                />
                <span className="text-xs font-mono text-slate-400">kWh</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Initial Plug-in SOC:</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={localStartSoc}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 0 && val <= 100) {
                      setLocalStartSoc(val);
                    }
                  }}
                  onBlur={() => handleSaveSocThreshold(undefined, localStartSoc)}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white text-center focus:outline-hidden focus:border-emerald-500"
                />
                <span className="text-xs font-mono text-slate-400">%</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Battery SOC Visualizer Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">State of Charge:</span>
              <span className="font-mono font-bold text-white text-sm">
                {currentEstimatedSoc}% SOC
              </span>
              {isBmwConnected ? (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  BMW ConnectedDrive (Live BMS)
                </span>
              ) : sessionDeliveredKwh > 0 ? (
                <span className="text-[10px] font-mono text-emerald-400">
                  (+{sessionDeliveredKwh.toFixed(1)} kWh delivered)
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Cutoff Target:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {localTargetSoc}% SOC
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ({energyNeededKwh} kWh remaining)
              </span>
            </div>
          </div>

          {/* Battery Shell Visual */}
          <div className="relative w-full h-8 bg-slate-950 rounded-lg border-2 border-slate-700 p-0.5 overflow-hidden flex items-center shadow-inner">
            {/* Initial Charge Level Segment */}
            <div
              style={{ width: `${Math.min(100, localStartSoc)}%` }}
              className="h-full bg-slate-600 rounded-l-xs transition-all duration-500"
              title={`Plug-in Initial Charge: ${localStartSoc}%`}
            />

            {/* Session Added Energy Segment */}
            {currentEstimatedSoc > localStartSoc && (
              <div
                style={{ width: `${Math.min(100 - localStartSoc, currentEstimatedSoc - localStartSoc)}%` }}
                className={`h-full bg-emerald-500 transition-all duration-500 ${
                  isCurrentlyCharging ? "animate-pulse" : ""
                }`}
                title={`Added from this session: +${(currentEstimatedSoc - localStartSoc)}% (${sessionDeliveredKwh} kWh)`}
              />
            )}

            {/* Target Cutoff Marker Line */}
            <div
              style={{ left: `${localTargetSoc}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 shadow-[0_0_8px_rgba(251,191,36,0.8)] pointer-events-none"
            >
              <div className="absolute -top-5 -translate-x-1/2 bg-amber-400 text-slate-950 text-[9px] font-mono font-bold px-1 rounded-xs">
                {localTargetSoc}% STOP
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>0% (Empty)</span>
            <span className="text-slate-400">Plug-in: {localStartSoc}%</span>
            <span className="text-emerald-400 font-bold">Now: {currentEstimatedSoc}%</span>
            <span className="text-amber-400 font-bold">Target: {localTargetSoc}%</span>
            <span>100% (Full)</span>
          </div>

          {/* Quick Real-Time SOC Calibrator & Cloud Sync Toolbar */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-blue-400" />
                  <span>{activeBmw?.model || currentSocConfig.vehicleModelName || "BMW i3 120Ah"}:</span>
                </span>
                <span className="font-mono font-bold text-white text-xs bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {currentEstimatedSoc}% SOC
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  {activeBmw?.remainingRangeKm !== undefined ? `${activeBmw.remainingRangeKm} km range` : `${Math.round(currentEstimatedSoc * 2.5)} km range`}
                </span>
                {activeBmw?.lastUpdated && (
                  <span className="text-[10px] font-mono text-slate-500">
                    Synced: {activeBmw.lastUpdated}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* On-Demand BMW BMS Telemetry Fetch Button */}
                <button
                  type="button"
                  disabled={isBmwSyncing}
                  onClick={async () => {
                    setIsBmwSyncing(true);
                    try {
                      const res = await fetch("/api/bmw/sync", { method: "POST" });
                      const data = await res.json().catch(() => ({}));
                      if (data.success) {
                        setSocFeedbackMsg("Live vehicle BMS telemetry successfully fetched from BMW backend!");
                        if (onSyncBmwTelemetry) await onSyncBmwTelemetry();
                      } else {
                        setSocFeedbackMsg(`BMW Fetch Error: ${data.error || data.message || "Failed to fetch live vehicle telemetry."}`);
                      }
                    } catch (e: any) {
                      setSocFeedbackMsg(`Connection Error: ${e.message || "Failed to reach BMW backend"}`);
                    } finally {
                      setIsBmwSyncing(false);
                      setTimeout(() => setSocFeedbackMsg(null), 5000);
                    }
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-600/90 hover:bg-blue-600 text-white flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                  title="Query live battery SOC directly from BMW backend now"
                >
                  <RefreshCw className={`w-3 h-3 ${isBmwSyncing ? "animate-spin" : ""}`} />
                  <span>{isBmwSyncing ? "Querying BMW..." : "Fetch from BMW Now"}</span>
                </button>

                {onOpenBmwModal && (
                  <button
                    type="button"
                    onClick={onOpenBmwModal}
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium flex items-center gap-1"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>BMW Settings</span>
                  </button>
                )}
              </div>
            </div>

            {/* Cadence info & Quick Calibrate bar */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <Timer className="w-3 h-3 text-blue-400" />
                  Auto-checking BMW backend every 1 min (60s)
                </span>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-500">Quick set SOC:</span>
                {[70, 80, 85, 90, 93, 95, 100].map((socVal) => (
                  <button
                    key={socVal}
                    type="button"
                    onClick={async () => {
                      if (onUpdateBmwTelemetry) {
                        await onUpdateBmwTelemetry({ chargingLevelPercent: socVal, remainingRangeKm: Math.round(socVal * 2.5) });
                      } else {
                        handleSaveSocThreshold(undefined, socVal);
                      }
                      setSocFeedbackMsg(`Battery SOC calibrated to ${socVal}%.`);
                      setTimeout(() => setSocFeedbackMsg(null), 3000);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors border ${
                      currentEstimatedSoc === socVal
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-slate-900 border-slate-700/80 text-slate-300 hover:border-blue-400 hover:text-white"
                    }`}
                    title={`Set current battery level to ${socVal}%`}
                  >
                    {socVal}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Target Threshold Buttons & Slider */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-950/60 p-3 rounded-lg border border-slate-800">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Target Threshold:</span>
              <span className="text-xs font-mono font-bold text-emerald-300">{localTargetSoc}%</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[80, 85, 90, 95, 100].map((soc) => (
                <button
                  key={soc}
                  type="button"
                  onClick={() => handleSaveSocThreshold(soc)}
                  className={`flex-1 py-1 px-1 rounded-md font-mono text-xs font-bold text-center transition-colors ${
                    localTargetSoc === soc
                      ? "bg-emerald-500 text-slate-950 shadow-xs"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700/60"
                  }`}
                >
                  {soc}%
                  {soc === 80 && <span className="block text-[8px] font-normal text-slate-400">Daily</span>}
                  {soc === 90 && <span className="block text-[8px] font-normal text-slate-900 font-semibold">Recommended</span>}
                  {soc === 100 && <span className="block text-[8px] font-normal text-slate-400">Roadtrip</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Adjust Cutoff Threshold:</span>
              <span className="font-mono text-emerald-400 font-bold">{localTargetSoc}% SOC</span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={localTargetSoc}
              onChange={(e) => setLocalTargetSoc(parseInt(e.target.value, 10))}
              onMouseUp={() => handleSaveSocThreshold(localTargetSoc)}
              onTouchEnd={() => handleSaveSocThreshold(localTargetSoc)}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>50% Min</span>
              <span className="text-emerald-300 font-medium">Daily Battery Health: 80%–90%</span>
              <span>100% Max</span>
            </div>
          </div>
        </div>

        {/* SOC Telemetry Polling Frequency Toolbar */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-blue-400" />
              <span>SOC Polling Frequency:</span>
            </span>
            <div className="flex items-center gap-1">
              {[
                { label: "15s", sec: 15, tag: "Turbo" },
                { label: "30s", sec: 30, tag: "Default" },
                { label: "60s", sec: 60, tag: "1m" },
                { label: "120s", sec: 120, tag: "2m" },
                { label: "300s", sec: 300, tag: "5m" },
              ].map(({ label, sec, tag }) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleSaveSocInterval(sec)}
                  className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all border ${
                    localPollIntervalSec === sec
                      ? "bg-blue-600 border-blue-500 text-white shadow-xs"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                  }`}
                  title={`Poll SOC every ${sec} seconds`}
                >
                  {label}
                  {tag === "Default" && <span className="ml-1 text-[8px] opacity-80">(默认)</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] text-slate-500 font-mono">Custom:</span>
            <input
              type="number"
              min={5}
              max={3600}
              value={customPollInput}
              onChange={(e) => setCustomPollInput(Math.max(5, Math.min(3600, parseInt(e.target.value, 10) || 30)))}
              className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold border border-slate-700 rounded bg-slate-900 text-white text-center"
            />
            <span className="text-[10px] text-slate-400 font-mono">s</span>
            <button
              type="button"
              onClick={() => handleSaveSocInterval(customPollInput)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700"
            >
              Set
            </button>
          </div>
        </div>

        {/* Live Status & Hardware Quick Controls */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {isTargetSocReached ? (
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Target {localTargetSoc}% SOC Reached! Charging halted to protect battery.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {localAutoStopEnabled
                  ? `Guard active: Will automatically stop charging when battery reaches ${localTargetSoc}%.`
                  : "Auto-Stop is turned off. Charger will follow regular Easee schedule."}
              </span>
            </div>
          )}

          {activeCharger && onSendCommand && (
            <div className="flex items-center gap-2">
              {isCurrentlyCharging ? (
                <button
                  type="button"
                  disabled={Boolean(commandInProgress)}
                  onClick={() => handleQuickCommand("pause")}
                  className="px-2.5 py-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Pause className="w-3 h-3" />
                  <span>Pause Charger</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={Boolean(commandInProgress)}
                  onClick={() => handleQuickCommand("resume")}
                  className="px-2.5 py-1 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                >
                  <Play className="w-3 h-3" />
                  <span>Resume Charger</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* SOC Feedback Banner */}
        {socFeedbackMsg && (
          <div className="mt-2.5 p-2 rounded bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{socFeedbackMsg}</span>
          </div>
        )}

        {/* Last Auto Stop Log Event */}
        {currentSocConfig.lastAutoStopEvent && (
          <div className="mt-2 text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>
              Last Auto-Stop Event: {currentSocConfig.lastAutoStopEvent.timestamp} • Target: {currentSocConfig.lastAutoStopEvent.targetSoc}% SOC • Delivered: {currentSocConfig.lastAutoStopEvent.deliveredKwh.toFixed(1)} kWh
            </span>
          </div>
        )}
      </div>

      {/* Hourly Generation Curve & Easee Suggested Amperage */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>Tomorrow's Hourly Solar Yield &amp; Suggested Easee Amp Limits</span>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            {showDetails ? "Hide Configuration" : "Adjust Solar Array Size"}
          </button>
        </div>

        {/* Optional Array Config */}
        {showDetails && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-4 text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-slate-600" />
              <span className="font-semibold text-slate-700">Rooftop Solar Peak Power:</span>
            </div>
            <div className="flex items-center gap-2">
              {[3.5, 5.0, 6.5, 8.0, 10.0, 12.0].map((size) => (
                <button
                  key={size}
                  onClick={() => setArraySizeKw(size)}
                  className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition-colors ${
                    arraySizeKw === size
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {size} kW
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hourly Horizontal Bar Timeline */}
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-15 gap-1.5 pt-1">
          {prediction.hourlyProduction.map((item, idx) => {
            const powerScaled = Math.round(((item.solarPowerKw * (arraySizeKw / 6.5))) * 10) / 10;
            const barHeightPct = Math.min(100, Math.round((powerScaled / 7.5) * 100));

            return (
              <div
                key={idx}
                className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50 border border-slate-200/60 hover:bg-amber-50/60 transition-colors group relative"
                title={`${item.hourLabel}: ~${powerScaled} kW Solar (Cloud: ${item.cloudCover}%) - Recommended Easee Current: ${item.recommendedAmpLimit}A`}
              >
                <div className="text-[9px] font-mono text-slate-500 font-semibold mb-1">
                  {item.hourLabel.replace(":00", "").replace(" ", "")}
                </div>

                {/* Vertical Power Bar */}
                <div className="w-full h-12 bg-slate-200/70 rounded-sm flex items-end overflow-hidden p-0.5 mb-1">
                  <div
                    style={{ height: `${Math.max(4, barHeightPct)}%` }}
                    className={`w-full rounded-2xs transition-all duration-300 ${
                      powerScaled >= 4.0
                        ? "bg-amber-500"
                        : powerScaled >= 2.0
                        ? "bg-amber-400"
                        : powerScaled > 0.5
                        ? "bg-amber-300"
                        : "bg-slate-300"
                    }`}
                  />
                </div>

                <div className="text-[10px] font-bold text-slate-800 font-mono">
                  {powerScaled > 0 ? `${powerScaled}` : "0"}
                  <span className="text-[8px] font-normal text-slate-400">kW</span>
                </div>

                <div
                  className={`text-[9px] font-mono font-bold mt-0.5 px-1 rounded ${
                    item.recommendedAmpLimit >= 16
                      ? "bg-emerald-100 text-emerald-800"
                      : item.recommendedAmpLimit >= 10
                      ? "bg-teal-100 text-teal-800"
                      : item.recommendedAmpLimit >= 6
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {item.recommendedAmpLimit > 0 ? `${item.recommendedAmpLimit}A` : "OFF"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>Solar Peak (&gt;4kW)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block" />
              <span>Light Yield</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
              <span>Low / Night</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Calculated via Solar Irradiance &amp; Cloud Vector
          </div>
        </div>
      </div>
    </div>
  );
};
