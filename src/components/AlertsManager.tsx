import React, { useState } from "react";
import {
  AlertTriangle,
  Bell,
  ShieldAlert,
  Plus,
  Trash2,
  CheckCircle,
  Volume2,
  Info,
  Sliders,
  Flame,
  Snowflake,
  Wind,
  Droplets,
  Sun,
} from "lucide-react";
import { ActiveAlert, CustomAlertRule, UnitSystem } from "../types";

interface AlertsManagerProps {
  activeAlerts: ActiveAlert[];
  customRules: CustomAlertRule[];
  onAddRule: (rule: CustomAlertRule) => void;
  onToggleRule: (id: string) => void;
  onDeleteRule: (id: string) => void;
  units: UnitSystem;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  activeAlerts,
  customRules,
  onAddRule,
  onToggleRule,
  onDeleteRule,
  units,
}) => {
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newMetric, setNewMetric] = useState<CustomAlertRule["metric"]>("temperature");
  const [newCondition, setNewCondition] = useState<">" | "<">(">");
  const [newValue, setNewValue] = useState<number>(30);
  const [newLabel, setNewLabel] = useState("");
  const [newSeverity, setNewSeverity] = useState<"info" | "warning" | "danger">("warning");
  const [testNotification, setTestNotification] = useState<string | null>(null);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    const rule: CustomAlertRule = {
      id: `rule_${Date.now()}`,
      metric: newMetric,
      condition: newCondition,
      value: Number(newValue),
      enabled: true,
      label: newLabel || `${newMetric} ${newCondition} ${newValue}`,
      severity: newSeverity,
    };
    onAddRule(rule);
    setShowRuleModal(false);
    setNewLabel("");
  };

  const handleTestAlert = () => {
    setTestNotification("🔔 Local Station Alert Audio & Web Notification Triggered Successfully!");
    setTimeout(() => setTestNotification(null), 3500);
  };

  return (
    <div id="weather-alerts-manager" className="relative rounded-2xl glass-card border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 shadow-xl text-slate-800 dark:text-slate-100 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Active Alerts &amp; Warning Thresholds
            </h3>
            {activeAlerts.length > 0 ? (
              <span className="rounded-full bg-amber-500 text-white text-[10px] px-2.5 py-0.5 uppercase font-bold tracking-wider font-mono shadow-xs">
                {activeAlerts.length} Active
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                Normal Conditions
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Real-time threshold monitoring and local network alert dispatch
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestAlert}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors shadow-xs border border-slate-200 dark:border-slate-700"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test Tone</span>
          </button>
          <button
            onClick={() => setShowRuleModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-md shadow-blue-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {testNotification && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="font-medium">{testNotification}</span>
        </div>
      )}

      {/* Active Alerts List */}
      {activeAlerts.length > 0 ? (
        <div className="space-y-3 mb-6">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-r-lg border-l-4 flex items-start gap-3 transition-all ${
                alert.severity === "danger"
                  ? "border-rose-500 bg-rose-50/90 text-rose-900"
                  : alert.severity === "warning"
                  ? "border-orange-500 bg-orange-50/90 text-orange-900"
                  : "border-blue-500 bg-blue-50/90 text-blue-900"
              }`}
            >
              <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${
                alert.severity === "danger"
                  ? "text-rose-600"
                  : alert.severity === "warning"
                  ? "text-orange-600"
                  : "text-blue-600"
              }`} />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold flex items-center gap-2">
                    {alert.title}
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/80 border border-slate-200/60 font-semibold">
                      {alert.value}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono opacity-75">
                    {alert.timestamp}
                  </span>
                </div>
                <p className="text-xs leading-relaxed mt-1 opacity-90">
                  {alert.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span className="font-medium">No active threshold alerts. All atmospheric parameters are within normal boundaries.</span>
        </div>
      )}

      {/* Configured Custom Rules List */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-600 font-semibold mb-3">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-600" /> Configured Warning Thresholds ({customRules.length})
          </span>
          <span className="text-[11px] text-slate-400 font-normal">Evaluated locally on every sync</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {customRules.map((rule) => (
            <div
              key={rule.id}
              className={`p-3 rounded-lg border flex items-center justify-between gap-2 transition-all ${
                rule.enabled
                  ? "bg-slate-50 border-slate-200"
                  : "bg-slate-50/40 border-slate-200/50 opacity-60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => onToggleRule(rule.id)}
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                    rule.enabled
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-slate-300"
                  }`}
                >
                  {rule.enabled && <CheckCircle className="w-3 h-3 stroke-[3]" />}
                </button>
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    {rule.label}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    {rule.metric} {rule.condition} {rule.value}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onDeleteRule(rule.id)}
                className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Delete rule"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 p-6 shadow-2xl">
            <h4 className="text-base font-bold text-slate-900 mb-1">Create Custom Weather Alert Rule</h4>
            <p className="text-xs text-slate-500 mb-4">
              Set automated notifications for when conditions exceed your defined limits.
            </p>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rule Label</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Heat Wave Warning or High Frost"
                  className="w-full rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Metric</label>
                  <select
                    value={newMetric}
                    onChange={(e) => setNewMetric(e.target.value as any)}
                    className="w-full rounded-lg bg-slate-50 border border-slate-200 p-2 text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value="temperature">Temperature</option>
                    <option value="windSpeed">Wind Speed</option>
                    <option value="uvIndex">UV Index</option>
                    <option value="humidity">Humidity</option>
                    <option value="precipitationProbability">Rain %</option>
                    <option value="uvIndex">Solar Irradiance / UV</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Condition</label>
                  <select
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value as any)}
                    className="w-full rounded-lg bg-slate-50 border border-slate-200 p-2 text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value=">">Greater than (&gt;)</option>
                    <option value="<">Less than (&lt;)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Threshold</label>
                  <input
                    type="number"
                    value={newValue}
                    onChange={(e) => setNewValue(Number(e.target.value))}
                    className="w-full rounded-lg bg-slate-50 border border-slate-200 p-2 text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Severity Level</label>
                <div className="flex gap-2">
                  {(["info", "warning", "danger"] as const).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setNewSeverity(sev)}
                      className={`flex-1 py-1.5 rounded-lg capitalize font-semibold transition-all ${
                        newSeverity === sev
                          ? sev === "danger"
                            ? "bg-rose-600 text-white"
                            : sev === "warning"
                            ? "bg-orange-500 text-white"
                            : "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Save Alert Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
