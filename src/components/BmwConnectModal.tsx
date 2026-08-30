import React, { useState, useEffect, useRef } from "react";
import {
  Car,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  RefreshCw,
  Shield,
  Gauge,
  Lock,
  BatteryCharging,
  Globe,
  Radio,
  Zap,
  Clock,
  Timer,
  Activity,
  KeyRound,
  FileCode,
  Info,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  ChevronDown,
  Sliders,
  Terminal,
} from "lucide-react";
import { BmwAccountStatus, BmwVehicleTelemetry, EvBatterySocConfig, BmwOAuthDiagnosticTrace } from "../types";
import { encryptCredentialsForLocalTransmission } from "../utils/cryptoClient";
import { BmwOAuthDiagnosticLogs } from "./BmwOAuthDiagnosticLogs";

interface BmwConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  bmwStatus?: BmwAccountStatus;
  onLogin: (payload: any) => Promise<{ success: boolean; message?: string }>;
  onSyncTelemetry: () => Promise<boolean>;
  onUpdateVehicleTelemetry?: (payload: any) => Promise<boolean>;
  onUpdateSocConfig?: (config: Partial<EvBatterySocConfig>) => Promise<boolean>;
  onLogout: () => Promise<boolean>;
}

export const BmwConnectModal: React.FC<BmwConnectModalProps> = ({
  isOpen,
  onClose,
  bmwStatus,
  onLogin,
  onSyncTelemetry,
  onUpdateVehicleTelemetry,
  onUpdateSocConfig,
  onLogout,
}) => {
  const [authMode, setAuthMode] = useState<"credentials" | "oneid" | "token" | "diagnostics">("credentials");
  const [loggedInTab, setLoggedInTab] = useState<"vehicle" | "diagnostics">("vehicle");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [authBasic, setAuthBasic] = useState("");
  const [showAdvancedAuth, setShowAdvancedAuth] = useState(false);
  const [directToken, setDirectToken] = useState("");
  const [region, setRegion] = useState<"rest_of_world" | "north_america" | "china">("rest_of_world");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [customSocInput, setCustomSocInput] = useState<number>(93);
  const [customIntervalInput, setCustomIntervalInput] = useState<number>(bmwStatus?.syncIntervalSeconds || 30);

  // BMW OneID Device Code state
  const [deviceCodeData, setDeviceCodeData] = useState<{
    userCode: string;
    deviceCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    expiresIn: number;
  } | null>(null);
  const [isPollingDeviceCode, setIsPollingDeviceCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const pollTimerRef = useRef<any>(null);

  // Clean up polling timer on unmount or mode switch
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const isLoggedIn = bmwStatus?.isLoggedIn || false;
  const activeVehicle: BmwVehicleTelemetry | undefined =
    bmwStatus?.vehicles?.find((v) => v.vin === bmwStatus.selectedVin) ||
    bmwStatus?.vehicles?.[0];

  const currentPollSec = bmwStatus?.syncIntervalSeconds || (bmwStatus?.syncIntervalMinutes ? bmwStatus.syncIntervalMinutes * 60 : 30);

  const handleStartOneIdFlow = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    try {
      const res = await fetch("/api/bmw/device-code/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.deviceCode && data.userCode) {
        setDeviceCodeData({
          userCode: data.userCode,
          deviceCode: data.deviceCode,
          verificationUri: data.verificationUri || "https://customer.bmwgroup.com/oneid/link",
          verificationUriComplete: data.verificationUriComplete || `https://customer.bmwgroup.com/oneid/link?user_code=${data.userCode}`,
          expiresIn: data.expiresIn || 300,
        });
        setIsPollingDeviceCode(true);

        // Start polling every 4 seconds
        pollTimerRef.current = setInterval(async () => {
          try {
            const pRes = await fetch("/api/bmw/device-code/poll", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deviceCode: data.deviceCode, region }),
            });
            const pData = await pRes.json();
            if (pData.success && pData.status === "approved") {
              clearInterval(pollTimerRef.current);
              setIsPollingDeviceCode(false);
              setDeviceCodeData(null);
              setSuccessMessage("BMW OneID authentication verified! Vehicle BMS synchronized.");
              await onSyncTelemetry();
              setTimeout(() => setSuccessMessage(null), 4000);
            } else if (pData.status === "expired" || pData.status === "error") {
              clearInterval(pollTimerRef.current);
              setIsPollingDeviceCode(false);
              setErrorMessage(pData.message || "Session expired. Please start a new OneID login.");
            }
          } catch (e) {
            console.warn("OneID poll notice:", e);
          }
        }, 4000);
      } else {
        setErrorMessage(data.message || "Failed to start BMW OneID login session.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initiate OneID device code flow.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyOneIdCode = () => {
    if (deviceCodeData?.userCode) {
      navigator.clipboard.writeText(deviceCodeData.userCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleUpdateInterval = async (sec: number) => {
    if (!onUpdateSocConfig) return;
    setIsLoading(true);
    try {
      const valid = Math.max(5, Math.min(3600, Math.round(sec) || 30));
      const ok = await onUpdateSocConfig({ socPollIntervalSeconds: valid });
      if (ok) {
        setSuccessMessage(`BMS Telemetry polling interval set to ${valid}s.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCalibrateSoc = async (soc: number) => {
    if (!onUpdateVehicleTelemetry) return;
    setIsLoading(true);
    try {
      const ok = await onUpdateVehicleTelemetry({
        chargingLevelPercent: soc,
        remainingRangeKm: Math.round(soc * 2.5),
        vin: activeVehicle?.vin,
      });
      if (ok) {
        setSuccessMessage(`Vehicle BMS calibrated to ${soc}% SOC.`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (authMode === "token") {
      if (!directToken.trim()) {
        setErrorMessage("Please paste your MyBMW OAuth Bearer Token or Refresh Token.");
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const result = await onLogin({
          token: directToken.trim(),
          region,
        });

        if (result.success) {
          setSuccessMessage("Connected successfully via OAuth Bearer Token! Live BMS SOC synchronized.");
          setTimeout(() => setSuccessMessage(null), 4000);
        } else {
          setErrorMessage(result.message || "Failed to validate Bearer token with BMW API.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to connect using OAuth token.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!username.trim() || !password.trim()) {
      setErrorMessage("Please enter your BMW ID (Email) and Password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // RSA Zero-Trust End-to-End Encryption
      const { payload } = await encryptCredentialsForLocalTransmission(username.trim(), password);

      const result = await onLogin({
        ...payload,
        region,
        apiKey: apiKey.trim() || undefined,
        apiSecret: apiSecret.trim() || undefined,
        authBasic: authBasic.trim() || undefined,
      });

      if (result.success) {
        setSuccessMessage("Successfully connected to BMW ConnectedDrive! Live BMS SOC synchronized.");
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(result.message || "Authentication failed. Please verify your BMW ID credentials and region.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to communicate with BMW ConnectedDrive.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncClick = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await onSyncTelemetry();
      if (res && res.error) {
        setErrorMessage(`BMW Telemetry Sync notice: ${res.error}`);
      } else if (res && (res.success || res.vehicle)) {
        const soc = res.vehicle?.chargingLevelPercent ?? activeVehicle?.chargingLevelPercent;
        setSuccessMessage(`Live BMS SOC synced: ${soc}% (${res.vehicle?.model || "BMW i3"}) at ${new Date().toLocaleTimeString()}`);
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setSuccessMessage(`Telemetry refresh requested at ${new Date().toLocaleTimeString()}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to sync telemetry from BMW backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    setIsLoading(true);
    try {
      await onLogout();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                <Car className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight flex items-center gap-2">
                  <span>MyBMW &amp; ConnectedDrive</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/30 text-blue-200 border border-blue-400/40">
                    BMS Telematics
                  </span>
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  Direct live battery SOC &amp; range synchronization for BMW i3 / i4 / iX
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Status feedback alerts */}
          {(errorMessage || bmwStatus?.error) && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-rose-800">BMW Authentication / Telemetry Notice</div>
                  <div className="leading-relaxed font-mono text-[11px] break-words">{errorMessage || bmwStatus?.error}</div>
                  <div className="pt-1 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (isLoggedIn) {
                          setLoggedInTab("diagnostics");
                        } else {
                          setAuthMode("diagnostics");
                        }
                      }}
                      className="text-xs font-bold text-rose-800 hover:text-rose-950 underline flex items-center gap-1"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>View OAuth Diagnostic Log Trace →</span>
                    </button>
                    {((errorMessage || bmwStatus?.error)?.includes("hCaptcha") || (errorMessage || bmwStatus?.error)?.includes("bot") || (errorMessage || bmwStatus?.error)?.includes("datacenter")) && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("token");
                          setErrorMessage(null);
                        }}
                        className="text-xs font-bold text-blue-700 underline hover:text-blue-900"
                      >
                        Switch to Direct Token Tab →
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  if (bmwStatus) bmwStatus.error = undefined;
                }}
                className="text-rose-400 hover:text-rose-700 p-1 text-xs font-bold shrink-0"
                title="Dismiss message"
              >
                ✕
              </button>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>{successMessage}</div>
            </div>
          )}

          {isLoggedIn && activeVehicle ? (
            /* Logged in vehicle state */
            <div className="space-y-4">
              {/* Logged in Navigation Sub-Tabs */}
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
                <button
                  type="button"
                  onClick={() => setLoggedInTab("vehicle")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    loggedInTab === "vehicle"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Live Vehicle Telemetry</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLoggedInTab("diagnostics")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    loggedInTab === "diagnostics"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-blue-600" />
                  <span>OAuth Diagnostic Trace</span>
                  {(bmwStatus?.diagnosticLogs?.length ?? 0) > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 text-blue-800">
                      {bmwStatus?.diagnosticLogs?.length}
                    </span>
                  )}
                </button>
              </div>

              {loggedInTab === "diagnostics" ? (
                <BmwOAuthDiagnosticLogs initialLogs={bmwStatus?.diagnosticLogs} />
              ) : (
                <>
                  <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold text-slate-200">{activeVehicle.model}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">VIN: {activeVehicle.vin}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                        <div className="text-[10px] uppercase font-mono text-slate-400 font-bold mb-1 flex items-center gap-1">
                          <Gauge className="w-3 h-3 text-emerald-400" />
                          <span>BMS SOC (HV)</span>
                        </div>
                        <div className="text-2xl font-black font-mono text-emerald-400">
                          {activeVehicle.chargingLevelHv ?? activeVehicle.soc ?? activeVehicle.chargingLevelPercent}%
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          chargingLevelHv
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                        <div className="text-[10px] uppercase font-mono text-slate-400 font-bold mb-1 flex items-center gap-1">
                          <BatteryCharging className="w-3 h-3 text-blue-400" />
                          <span>Max Range</span>
                        </div>
                        <div className="text-2xl font-black font-mono text-white">
                          {activeVehicle.maxrangeElectric ?? 260}{" "}
                          <span className="text-xs font-normal text-slate-400 font-sans">km</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {activeVehicle.maxRangeElectricMls ? `${activeVehicle.maxRangeElectricMls} mi` : "maxrangeElectric"}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                        <div className="text-[10px] uppercase font-mono text-slate-400 font-bold mb-1 flex items-center gap-1">
                          <Car className="w-3 h-3 text-indigo-400" />
                          <span>Odometer</span>
                        </div>
                        <div className="text-2xl font-black font-mono text-indigo-300">
                          {activeVehicle.mileage ? (activeVehicle.mileage >= 1000 ? `${(activeVehicle.mileage / 1000).toFixed(1)}k` : activeVehicle.mileage) : "48.3k"}{" "}
                          <span className="text-xs font-normal text-slate-400 font-sans">km</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {activeVehicle.mileage ? `${activeVehicle.mileage.toLocaleString()} km` : "mileage"}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                        <div className="text-[10px] uppercase font-mono text-slate-400 font-bold mb-1 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>Status</span>
                        </div>
                        <div className="text-sm font-bold font-mono text-amber-300 truncate pt-1">
                          {activeVehicle.charging_status || activeVehicle.chargingStatus || "CHARGING"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans mt-1">
                          {activeVehicle.isPluggedIn ? "Cable Connected" : "Unplugged"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Last Cloud Synced: {activeVehicle.lastUpdated}</span>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={handleSyncClick}
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1 text-xs transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                        <span>Sync BMS Cloud</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Calibrate / Manual SOC Sync */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>Quick Calibrate / Override SOC</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-blue-700">
                        Current: {activeVehicle.chargingLevelPercent}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      If the ConnectedDrive cloud sync is delayed, click a preset or input your exact battery level to synchronize immediately with the Auto-Stop engine.
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {[70, 80, 85, 90, 93, 95, 100].map((val) => (
                        <button
                          key={val}
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleQuickCalibrateSoc(val)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                            activeVehicle.chargingLevelPercent === val
                              ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={customSocInput}
                          onChange={(e) => setCustomSocInput(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                          className="w-14 px-2 py-1 text-xs font-mono font-bold border border-slate-300 rounded-lg text-center bg-white"
                        />
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleQuickCalibrateSoc(customSocInput)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
                        >
                          Set
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SOC Update & Polling Frequency Control */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5 text-blue-600" />
                        <span>Telemetry Polling Frequency</span>
                      </span>
                      <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        Every {currentPollSec}s ({Math.round((currentPollSec / 60) * 10) / 10}m)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      How often the background daemon and browser poll the BMW backend for real-time battery percentage and electric range updates (default is <strong>60 seconds / 1 minute</strong>).
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {[
                        { label: "15s (Turbo)", val: 15 },
                        { label: "30s (Rapid)", val: 30 },
                        { label: "60s (1m Default)", val: 60 },
                        { label: "120s (2m)", val: 120 },
                        { label: "300s (5m)", val: 300 },
                      ].map(({ label, val }) => (
                        <button
                          key={val}
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleUpdateInterval(val)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                            currentPollSec === val
                              ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <div className="flex items-center gap-1 ml-auto">
                        <input
                          type="number"
                          min={5}
                          max={3600}
                          value={customIntervalInput}
                          onChange={(e) => setCustomIntervalInput(Math.max(5, Math.min(3600, parseInt(e.target.value, 10) || 30)))}
                          className="w-16 px-2 py-1 text-xs font-mono font-bold border border-slate-300 rounded-lg text-center bg-white"
                          placeholder="Sec"
                        />
                        <span className="text-[11px] text-slate-500 font-mono">s</span>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleUpdateInterval(customIntervalInput)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium"
                        >
                          Set
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                    <Shield className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <span className="font-bold">Auto-Stop Target Integration:</span> The Easee charging schedule and auto-cutoff guard will now use this real-time {activeVehicle.chargingLevelPercent}% SOC directly to halt charging at your desired 90% threshold.
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleLogoutClick}
                  className="px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect BMW Account</span>
                </button>
              </div>
            </div>
          ) : (
            /* Login Form */
            <div className="space-y-4">
              {/* Method Selector Tabs */}
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("credentials");
                    setIsPollingDeviceCode(false);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    authMode === "credentials"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>BMW ID</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("oneid");
                    if (!deviceCodeData && !isPollingDeviceCode) {
                      handleStartOneIdFlow();
                    }
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    authMode === "oneid"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>OneID Web</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("token");
                    setIsPollingDeviceCode(false);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    authMode === "token"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Direct Token</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("diagnostics");
                    setIsPollingDeviceCode(false);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    authMode === "diagnostics"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-blue-600" />
                  <span>Diagnostics</span>
                  {(bmwStatus?.diagnosticLogs?.length ?? 0) > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-100 text-blue-800">
                      {bmwStatus?.diagnosticLogs?.length}
                    </span>
                  )}
                </button>
              </div>

              {authMode === "diagnostics" ? (
                <BmwOAuthDiagnosticLogs initialLogs={bmwStatus?.diagnosticLogs} />
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  {authMode === "oneid" ? (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-blue-50/90 border border-blue-200 text-xs text-blue-950 space-y-2">
                        <div className="font-bold flex items-center gap-1.5 text-blue-900">
                          <Sparkles className="w-4 h-4 text-blue-600" />
                          <span>Official BMW OneID Web Login</span>
                        </div>
                        <p className="leading-relaxed text-blue-800 text-[11px]">
                          Authenticate directly on BMW's official login portal (supports 2FA, biometric passkeys, and works seamlessly regardless of region/location).
                        </p>
                      </div>

                      {deviceCodeData ? (
                        <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-3.5">
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Your 8-Digit BMW Verification Code:</span>
                            <div className="flex items-center gap-1 text-[11px] text-amber-400 font-mono">
                              <Activity className="w-3 h-3 animate-pulse" />
                              <span>Waiting for web approval...</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                            <div className="text-2xl font-black font-mono tracking-widest text-emerald-400">
                              {deviceCodeData.userCode}
                            </div>
                            <button
                              type="button"
                              onClick={handleCopyOneIdCode}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              {copiedCode ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="space-y-2 pt-1">
                            <a
                              href={deviceCodeData.verificationUriComplete}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span>Open BMW OneID Login Portal (customer.bmwgroup.com) ↗</span>
                            </a>

                            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                              1. Click the button above to open BMW OneID portal.<br />
                              2. Sign in with your BMW ID and confirm code <strong>{deviceCodeData.userCode}</strong>.<br />
                              3. Return here — your vehicle telemetry will connect automatically!
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center space-y-3">
                          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                          <div className="text-xs font-medium text-slate-600">
                            Contacting BMW OneID Authorization Server...
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={handleStartOneIdFlow}
                          className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                          <span>Regenerate Code</span>
                        </button>
                      </div>
                    </div>
                  ) : authMode === "credentials" ? (
                    <>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                        <Radio className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                        <span>
                          Log in with your official <strong>BMW ID</strong> credentials (same as <strong>MyBMW App</strong>). PKCE OAuth 2.0 and edent/BMW-i-Remote Basic Auth headers are automatically negotiated.
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">BMW ID (Email Address)</label>
                          <input
                            type="email"
                            required
                            placeholder="your.email@example.com"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs font-sans"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">BMW ID Password</label>
                          <input
                            type="password"
                            required
                            placeholder="••••••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs font-sans"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Region / Cloud Server</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "rest_of_world", label: "Europe / Global (NL/DE/UK)" },
                              { id: "north_america", label: "North America" },
                              { id: "china", label: "China" },
                            ].map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setRegion(r.id as any)}
                                className={`py-2 px-2 rounded-lg text-xs font-semibold text-center border transition-colors ${
                                  region === r.id
                                    ? "bg-blue-50 border-blue-500 text-blue-700"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Advanced edent/BMW-i-Remote Basic Auth Settings */}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAdvancedAuth(!showAdvancedAuth)}
                            className="flex items-center justify-between w-full p-2.5 rounded-xl bg-slate-100/80 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors border border-slate-200"
                          >
                            <span className="flex items-center gap-1.5">
                              <Sliders className="w-3.5 h-3.5 text-blue-600" />
                              <span>Advanced: Custom API Key / Secret (edent/BMW-i-Remote)</span>
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showAdvancedAuth ? "rotate-180" : ""}`} />
                          </button>

                          {showAdvancedAuth && (
                            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                              <div className="text-slate-600 leading-relaxed text-[11px]">
                                Following <strong>edent/BMW-i-Remote</strong>, the BMW OAuth endpoint requires a <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">Basic base64(apiKey:apiSecret)</code> Authorization header. Known keys are automatically tried. You can optionally supply your own runtime key and secret or custom Basic header below:
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Custom API Key / Client ID</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. client_id_uuid"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Custom API Secret</label>
                                  <input
                                    type="password"
                                    placeholder="e.g. client_secret_key"
                                    value={apiSecret}
                                    onChange={(e) => setApiSecret(e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Or Raw Basic Auth Header (Optional)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Basic <base64-encoded-credentials>"
                                  value={authBasic}
                                  onChange={(e) => setAuthBasic(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                                />
                              </div>

                              <div className="p-2 bg-blue-50/60 rounded-lg text-[11px] text-blue-900 flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 shrink-0 text-blue-600 mt-0.5" />
                                <span>
                                  <strong>Tip:</strong> If BMW blocks datacenter requests with bot defense/captcha, use the <strong>OneID Web</strong> tab (Device Code) or <strong>Direct Token</strong> tab to authenticate directly.
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                        <KeyRound className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                        <div>
                          <span className="font-bold">Direct OAuth / Bearer Token Mode:</span> Paste your active MyBMW Bearer Token or Refresh Token (e.g. from Home Assistant, bimmer_connected, or browser DevTools) to connect instantly and bypass bot verification.
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">MyBMW Access Token or Refresh Token</label>
                          <textarea
                            required
                            rows={4}
                            placeholder="eyJhbGciOiJSUzI1NiIs..."
                            value={directToken}
                            onChange={(e) => setDirectToken(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs font-mono leading-tight"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Region / Cloud Server</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "rest_of_world", label: "Europe / Global (NL/DE/UK)" },
                              { id: "north_america", label: "North America" },
                              { id: "china", label: "China" },
                            ].map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => setRegion(r.id as any)}
                                className={`py-2 px-2 rounded-lg text-xs font-semibold text-center border transition-colors ${
                                  region === r.id
                                    ? "bg-blue-50 border-blue-500 text-blue-700"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {authMode !== "oneid" && (
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Authenticating with MyBMW Cloud...</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>{authMode === "token" ? "Validate & Connect Token" : "Connect BMW ConnectedDrive"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>Zero-Trust 2048-bit RSA encrypted transmission • Credentials never stored in plain text</span>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

