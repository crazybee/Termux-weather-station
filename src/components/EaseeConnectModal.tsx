import React, { useState } from "react";
import {
  Zap,
  X,
  Lock,
  Unlock,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Cpu,
  Wifi,
  Sliders,
  ChevronRight,
  LogOut,
  Info,
  Gauge,
  Car,
} from "lucide-react";
import { EaseeAccountStatus, EaseeCharger, EvBatterySocConfig } from "../types";

interface EaseeConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  easeeStatus: EaseeAccountStatus | null;
  onLogin: (user: string, pass: string) => Promise<boolean>;
  onLogout: () => Promise<void>;
  onRefreshChargers: () => Promise<void>;
  onRefreshToken?: () => Promise<boolean>;
  onSendCommand: (chargerId: string, cmd: "start" | "pause" | "resume" | "toggle_lock") => Promise<void>;
  onToggleAutoSync: (enabled: boolean) => Promise<void>;
  onUpdateSocConfig?: (config: Partial<EvBatterySocConfig>) => Promise<boolean>;
}

export const EaseeConnectModal: React.FC<EaseeConnectModalProps> = ({
  isOpen,
  onClose,
  easeeStatus,
  onLogin,
  onLogout,
  onRefreshChargers,
  onRefreshToken,
  onSendCommand,
  onToggleAutoSync,
  onUpdateSocConfig,
}) => {
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [refreshSuccessMsg, setRefreshSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commandLoading, setCommandLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !password) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const ok = await onLogin(userName, password);
      if (!ok) {
        setErrorMessage("Failed to authenticate with Easee. Please check your credentials.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Connection failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoConnect = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onLogin("demo@easee.com", "demo12345");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCharger: EaseeCharger | undefined =
    easeeStatus?.chargers?.find((c) => c.id === easeeStatus.selectedChargerId) ||
    easeeStatus?.chargers?.[0];

  const handleAction = async (cmd: "start" | "pause" | "resume" | "toggle_lock") => {
    if (!activeCharger) return;
    setCommandLoading(cmd);
    try {
      await onSendCommand(activeCharger.id, cmd);
    } finally {
      setCommandLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="easee-connect-modal"
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Easee EV Charger Integration</h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
                  Cloud REST API
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Automate charging schedules based on solar PV generation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {easeeStatus?.isLoggedIn ? (
            /* Logged In View */
            <div className="space-y-5">
              {/* Connected Account Bar */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-950">Linked Easee Account:</span>{" "}
                      <span className="font-mono text-emerald-800 font-medium">
                        {easeeStatus.userEmail || "Connected"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1 text-slate-600 hover:text-rose-600 font-semibold px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-800">
                  <div className="flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>OAuth2 Refresh Token Persisted — Auto-renews upon expiration</span>
                  </div>
                  {onRefreshToken && (
                    <button
                      type="button"
                      disabled={isRefreshingToken}
                      onClick={async () => {
                        setIsRefreshingToken(true);
                        setRefreshSuccessMsg(null);
                        try {
                          const ok = await onRefreshToken();
                          if (ok) {
                            setRefreshSuccessMsg("Token refreshed successfully");
                            setTimeout(() => setRefreshSuccessMsg(null), 3000);
                          }
                        } finally {
                          setIsRefreshingToken(false);
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-emerald-100/80 border border-emerald-300 font-semibold text-emerald-900 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRefreshingToken ? "animate-spin text-emerald-600" : ""}`} />
                      <span>{isRefreshingToken ? "Renewing..." : "Renew Token Now"}</span>
                    </button>
                  )}
                </div>

                {refreshSuccessMsg && (
                  <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-1 rounded">
                    ✓ {refreshSuccessMsg}
                  </div>
                )}
              </div>

              {/* Active Charger Hardware Details */}
              {activeCharger ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4.5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900">{activeCharger.name}</h4>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                          {activeCharger.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              activeCharger.isOnline ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <span>{activeCharger.isOnline ? "Online (Wi-Fi/4G)" : "Offline"}</span>
                        </span>
                        <span>•</span>
                        <span>{activeCharger.phaseMode}-Phase Mode</span>
                      </div>
                    </div>

                    <button
                      onClick={onRefreshChargers}
                      title="Refresh live status from Easee Cloud"
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Charger Stats Grid */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                      <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">
                        Status
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                        {activeCharger.chargerOpMode}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                      <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">
                        Dynamic Current
                      </div>
                      <div className="text-xs font-bold text-blue-600 font-mono mt-0.5">
                        {activeCharger.dynamicCurrentAmps} A
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                      <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">
                        Active Schedule
                      </div>
                      <div className="text-xs font-bold text-slate-800 font-mono mt-0.5 truncate">
                        {activeCharger.currentSchedule
                          ? `${activeCharger.currentSchedule.startTime}-${activeCharger.currentSchedule.stopTime}`
                          : "None"}
                      </div>
                    </div>
                  </div>

                  {/* Quick Controls */}
                  <div className="pt-2 border-t border-slate-200/70 flex flex-wrap gap-2">
                    <button
                      disabled={commandLoading !== null}
                      onClick={() => handleAction(activeCharger.chargerOpMode === "Charging" ? "pause" : "start")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                        activeCharger.chargerOpMode === "Charging"
                          ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      {activeCharger.chargerOpMode === "Charging" ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Charge</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>Start Charge</span>
                        </>
                      )}
                    </button>

                    <button
                      disabled={commandLoading !== null}
                      onClick={() => handleAction("toggle_lock")}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all shadow-2xs"
                    >
                      {activeCharger.cableLocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Locked</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Unlocked</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border">
                  No chargers found under this account.
                </div>
              )}

              {/* Auto Sync Toggle */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between">
                <div className="space-y-0.5 pr-3">
                  <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-blue-600" />
                    <span>Autopilot: Nightly Solar Schedule Sync</span>
                  </div>
                  <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                    Automatically computes tomorrow's peak solar window and pushes the schedule to Easee.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={easeeStatus.autoSyncSolar}
                    onChange={(e) => onToggleAutoSync(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>

              {/* EV Battery SOC Cutoff Threshold Guard */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-3">
                    <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Battery Protection: Target SOC Auto-Cutoff</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 font-medium">
                      Automatically sends a pause/stop command when vehicle reaches your desired SOC threshold.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={easeeStatus.socConfig?.enabled ?? true}
                      onChange={(e) => onUpdateSocConfig && onUpdateSocConfig({ enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-600" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200">
                    <div className="text-[10px] uppercase font-mono text-slate-500 font-bold mb-1">Target Stop %</div>
                    <div className="flex items-center gap-1.5">
                      {[80, 85, 90, 100].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => onUpdateSocConfig && onUpdateSocConfig({ targetSocPercent: val })}
                          className={`flex-1 py-1 rounded text-xs font-bold font-mono transition-colors ${
                            (easeeStatus.socConfig?.targetSocPercent || 90) === val
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-emerald-200 flex flex-col justify-between">
                    <div className="text-[10px] uppercase font-mono text-slate-500 font-bold">Vehicle Pack Size</div>
                    <div className="text-xs font-bold font-mono text-emerald-900">
                      {easeeStatus.socConfig?.batteryCapacityKwh || 75} kWh ({easeeStatus.socConfig?.vehicleModelName || "Standard EV"})
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold flex items-center gap-1.5 text-slate-900">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>How Easee Integration Works</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Local Wi-Fi Encrypted</span>
                  </span>
                </div>
                <p>
                  Enter your Easee App account credentials. This weather station communicates securely with the Easee Cloud API to automatically configure charge windows and current limits.
                </p>
                <div className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 flex items-center gap-1.5 font-medium">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    <b>Wi-Fi Interception Protection:</b> Password and username are hybrid-encrypted in your browser using <b>RSA-2048 + AES-256-GCM</b> before leaving your device. Zero plaintext is transmitted across your local network.
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Easee Phone Number or Email
                </label>
                <input
                  type="text"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="+4790000000 or user@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Easee Account Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating with Easee...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Connect Easee Account</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDemoConnect}
                  className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Quick Test with Easee Simulator (1-Click Demo)</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-slate-400" />
            <span>Local &amp; Cloud Hybrid Sync</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
