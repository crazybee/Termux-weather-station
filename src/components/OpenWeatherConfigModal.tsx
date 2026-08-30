import React, { useState, useEffect } from "react";
import {
  CloudSun,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Trash2,
  X,
  Radio,
  Zap,
} from "lucide-react";

interface OpenWeatherConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: () => void;
}

export const OpenWeatherConfigModal: React.FC<OpenWeatherConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [currentProvider, setCurrentProvider] = useState<"openweathermap" | "open-meteo">("openweathermap");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [keyMasked, setKeyMasked] = useState("");
  const [isFromEnv, setIsFromEnv] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    message: string;
    city?: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch current config when modal opens
  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/weather/config");
      if (res.ok) {
        const data = await res.json();
        setHasStoredKey(data.hasOpenWeatherKey);
        setKeyMasked(data.keyMasked || "");
        setCurrentProvider(data.provider === "open-meteo" ? "open-meteo" : "openweathermap");
        setIsFromEnv(Boolean(data.isFromEnv));
      }
    } catch (err) {
      console.error("Failed to load weather config:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      setTestResult(null);
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    const keyToTest = apiKeyInput.trim();
    if (!keyToTest) {
      setStatusMessage({ type: "error", text: "Please enter an API key to test." });
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);
      setStatusMessage(null);
      const res = await fetch("/api/weather/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToTest }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.valid) {
        setStatusMessage({
          type: "success",
          text: `Success! Validated with OpenWeatherMap.org (${data.city || "Connected"}).`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: data.message || "Key validation failed with OpenWeatherMap.org.",
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: `Network error: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setIsLoading(true);
      setStatusMessage(null);

      const payload: any = {
        provider: currentProvider,
      };

      if (apiKeyInput.trim()) {
        payload.apiKey = apiKeyInput.trim();
      }

      const res = await fetch("/api/weather/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatusMessage({
          type: "error",
          text: data.message || "Failed to save OpenWeatherMap configuration.",
        });
        setIsLoading(false);
        return;
      }

      setStatusMessage({
        type: "success",
        text: data.message || "Weather configuration updated successfully!",
      });

      setApiKeyInput("");
      await fetchConfig();
      if (onConfigUpdated) {
        onConfigUpdated();
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: `Error saving: ${err.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveKey = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/weather/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "", provider: "open-meteo" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: "success",
          text: "OpenWeatherMap key removed. Provider set to Open-Meteo.",
        });
        setApiKeyInput("");
        await fetchConfig();
        if (onConfigUpdated) {
          onConfigUpdated();
        }
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: `Error removing key: ${err.message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="openweather-config-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div
        id="openweather-config-modal-content"
        className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden transition-all text-slate-800"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
              <CloudSun className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                OpenWeatherMap API Setup
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Runtime configuration & API key management
              </p>
            </div>
          </div>
          <button
            id="close-openweather-modal-btn"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Status feedback */}
          {statusMessage && (
            <div
              className={`flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium border ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">{statusMessage.text}</div>
            </div>
          )}

          {/* Active Provider Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Primary Weather Provider
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                id="select-provider-openweathermap"
                onClick={() => setCurrentProvider("openweathermap")}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  currentProvider === "openweathermap"
                    ? "border-orange-500 bg-orange-50/50 shadow-xs ring-1 ring-orange-500/30"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full mt-0.5 shrink-0 border flex items-center justify-center ${
                    currentProvider === "openweathermap"
                      ? "border-orange-600 bg-orange-600"
                      : "border-slate-300"
                  }`}
                >
                  {currentProvider === "openweathermap" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>OpenWeatherMap.org</span>
                    <span className="bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded text-[10px]">Official</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Live global 2.5 API with 5-day forecasts & air pollution.
                  </p>
                </div>
              </button>

              <button
                type="button"
                id="select-provider-openmeteo"
                onClick={() => setCurrentProvider("open-meteo")}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  currentProvider === "open-meteo"
                    ? "border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500/30"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full mt-0.5 shrink-0 border flex items-center justify-center ${
                    currentProvider === "open-meteo"
                      ? "border-blue-600 bg-blue-600"
                      : "border-slate-300"
                  }`}
                >
                  {currentProvider === "open-meteo" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Open-Meteo Archive
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Public fallback database without requiring an API key.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Current Key Status */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-700">
                  Stored Key Status:
                </span>
              </div>
              {hasStoredKey ? (
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  Active {isFromEnv && "(ENV)"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-md">
                  No Key Saved
                </span>
              )}
            </div>

            {hasStoredKey && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                <span className="font-mono text-slate-600 text-[11px]">
                  {keyMasked}
                </span>
                <button
                  type="button"
                  id="remove-openweather-key-btn"
                  onClick={handleRemoveKey}
                  disabled={isLoading}
                  className="text-rose-600 hover:text-rose-700 text-[11px] font-semibold flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove Key
                </button>
              </div>
            )}
          </div>

          {/* Key Input Section */}
          <div className="space-y-1.5">
            <label
              htmlFor="openweather-key-input"
              className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between"
            >
              <span>Provide OpenWeatherMap API Key</span>
              <a
                href="https://home.openweathermap.org/api_keys"
                target="_blank"
                rel="noreferrer"
                className="text-orange-600 hover:text-orange-700 text-[11px] font-medium inline-flex items-center gap-1 hover:underline normal-case"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </label>

            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <Key className="w-4 h-4" />
              </div>
              <input
                id="openweather-key-input"
                type="password"
                placeholder={hasStoredKey ? "Enter new key to replace current key..." : "e.g. 1a2b3c4d5e6f7g8h9i0j..."}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full pl-9 pr-24 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
              />
              <button
                type="button"
                id="test-openweather-key-btn"
                onClick={handleTestKey}
                disabled={isTesting || !apiKeyInput.trim()}
                className="absolute right-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <span>Test Key</span>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              Your key is saved in runtime configuration and proxy-requested server-side.
              New OpenWeatherMap keys may take 10–30 minutes after registration on openweathermap.org to activate.
            </p>
          </div>

          {/* Quick links to documentation */}
          <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-3 flex items-start gap-2.5 text-xs text-orange-950">
            <Zap className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span>Follows the official </span>
              <a
                href="https://openweathermap.org/api"
                target="_blank"
                rel="noreferrer"
                className="font-bold underline text-orange-700 hover:text-orange-800"
              >
                OpenWeatherMap API Documentation
              </a>
              <span> for Current Weather, 5-Day 3-Hour Forecast, and Geocoding.</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">
          <button
            type="button"
            id="cancel-openweather-modal-btn"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            id="save-openweather-modal-btn"
            onClick={handleSaveConfig}
            disabled={isLoading || (!apiKeyInput.trim() && currentProvider === "openweathermap" && !hasStoredKey)}
            className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md shadow-orange-600/20 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save & Apply</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
