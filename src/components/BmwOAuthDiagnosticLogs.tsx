import React, { useState, useEffect } from "react";
import {
  Terminal,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Code2,
  Send,
  ArrowDownLeft,
  ShieldAlert,
  Info,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { BmwOAuthDiagnosticTrace } from "../types";

interface BmwOAuthDiagnosticLogsProps {
  initialLogs?: BmwOAuthDiagnosticTrace[];
  onRefreshLogs?: () => Promise<BmwOAuthDiagnosticTrace[] | undefined>;
}

export const BmwOAuthDiagnosticLogs: React.FC<BmwOAuthDiagnosticLogsProps> = ({
  initialLogs = [],
  onRefreshLogs,
}) => {
  const [logs, setLogs] = useState<BmwOAuthDiagnosticTrace[]>(initialLogs);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedSnippetIndex, setCopiedSnippetIndex] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "errors" | "success">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sync when prop changes
  useEffect(() => {
    if (initialLogs && initialLogs.length > 0) {
      setLogs(initialLogs);
    }
  }, [initialLogs]);

  const fetchLatestLogs = async () => {
    setIsRefreshing(true);
    try {
      if (onRefreshLogs) {
        const fetched = await onRefreshLogs();
        if (fetched) {
          setLogs(fetched);
          return;
        }
      }
      const res = await fetch("/api/bmw/diagnostics");
      if (res.ok) {
        const data = await res.json();
        if (data.diagnosticLogs) {
          setLogs(data.diagnosticLogs);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch BMW diagnostic logs:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearLogs = async () => {
    setIsClearing(true);
    try {
      const res = await fetch("/api/bmw/diagnostics/clear", { method: "POST" });
      if (res.ok) {
        setLogs([]);
        setExpandedIndex(null);
      }
    } catch (err) {
      console.warn("Failed to clear BMW diagnostic logs:", err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySnippet = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippetIndex(index);
    setTimeout(() => setCopiedSnippetIndex(null), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterStatus === "errors" && log.success) return false;
    if (filterStatus === "success" && !log.success) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchUrl = log.url.toLowerCase().includes(q);
      const matchStage = log.stage.toLowerCase().includes(q);
      const matchErr = (log.error || "").toLowerCase().includes(q);
      const matchClient = (log.clientDescription || "").toLowerCase().includes(q);
      const matchBody = (log.responseBodySnippet || "").toLowerCase().includes(q);
      return matchUrl || matchStage || matchErr || matchClient || matchBody;
    }
    return true;
  });

  const getStatusBadge = (log: BmwOAuthDiagnosticTrace) => {
    if (log.status === 200 || log.status === 204) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          HTTP {log.status} OK
        </span>
      );
    }
    if (log.status === 302) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-300">
          HTTP 302 REDIRECT
        </span>
      );
    }
    if (log.status === 401 || log.status === 403) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
          HTTP {log.status} {log.statusText || "UNAUTHORIZED"}
        </span>
      );
    }
    if (log.status === 404) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
          HTTP 404 NOT FOUND
        </span>
      );
    }
    if (log.status) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
          HTTP {log.status} {log.statusText || "ERROR"}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
        NETWORK REQ
      </span>
    );
  };

  const getAnalysisTip = (log: BmwOAuthDiagnosticTrace) => {
    const errorStr = `${log.error || ""} ${log.responseBodySnippet || ""} ${log.statusText || ""}`.toLowerCase();
    
    if (errorStr.includes("client authentication failed") || errorStr.includes("invalid_client") || log.status === 401) {
      return {
        title: "Client Authentication Failed",
        color: "border-amber-400 bg-amber-50 text-amber-900",
        message:
          "The Basic Auth client ID/secret pair or authorization header was rejected by BMW's gateway. For modern ConnectedDrive/MyBMW accounts, use the 'OneID Web' device flow or GCDM PKCE authorization rather than hardcoded legacy credentials.",
      };
    }
    if (errorStr.includes("resource does not exists") || errorStr.includes("resource does not exist") || log.status === 404) {
      return {
        title: "Endpoint Deprecated / Not Found (HTTP 404)",
        color: "border-rose-400 bg-rose-50 text-rose-900",
        message:
          "The legacy v1 b2vapi.bmwgroup.com endpoint from edent/BMW-i-Remote has been retired by BMW for your region. The app automatically proceeds to modern GCDM OAuth endpoints (customer.bmwgroup.com).",
      };
    }
    if (errorStr.includes("hcaptcha") || errorStr.includes("bot") || errorStr.includes("datacenter") || log.status === 403) {
      return {
        title: "Bot Defense / Captcha Triggered",
        color: "border-blue-400 bg-blue-50 text-blue-900",
        message:
          "BMW's Web Application Firewall (WAF) detected a server-side automated login request. Switch to the 'OneID Web' tab to authenticate via your browser with 2FA support, or use a 'Direct Token'.",
      };
    }
    if (errorStr.includes("invalid_grant") || errorStr.includes("bad credentials")) {
      return {
        title: "Invalid Credentials or Expired Code",
        color: "border-rose-400 bg-rose-50 text-rose-900",
        message:
          "The password provided was incorrect for this BMW ID, or the authorization code expired before token exchange.",
      };
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {/* Header Toolbar */}
      <div className="p-3 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs flex items-center gap-1.5">
                <span>OAuth 2.0 / Basic Auth Diagnostic Flow</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                  {logs.length} trace{logs.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Live captures of request headers, parameters, and HTTP responses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isRefreshing}
              onClick={fetchLatestLogs}
              title="Refresh Traces"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {logs.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyAll}
                  title="Copy All Traces JSON"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 hidden sm:inline">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copy JSON</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isClearing}
                  onClick={handleClearLogs}
                  title="Clear All Traces"
                  className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold flex items-center gap-1 border border-rose-800/40 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search stage, endpoint, headers, errors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-1">
            {(["all", "errors", "success"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterStatus(mode)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  filterStatus === mode
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {mode === "all" ? "All" : mode === "errors" ? "Errors Only" : "Success"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trace Items List */}
      {logs.length === 0 ? (
        <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
          <Code2 className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-xs font-bold text-slate-700">No OAuth Diagnostic Traces Recorded Yet</div>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
            When you attempt to connect with your BMW ID credentials or OneID, each request, header, parameter, and response payload is recorded here in real time.
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
          No diagnostic traces match your search/filter.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
          {filteredLogs.map((trace, index) => {
            const isExpanded = expandedIndex === index;
            const tip = getAnalysisTip(trace);
            const timeFormatted = new Date(trace.timestamp).toLocaleTimeString();

            return (
              <div
                key={index}
                className={`rounded-xl border transition-all overflow-hidden ${
                  trace.success
                    ? "bg-white border-emerald-200"
                    : "bg-white border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Collapsible Card Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setExpandedIndex(isExpanded ? null : index);
                    }
                  }}
                  className="p-3 cursor-pointer hover:bg-slate-50/80 transition-colors flex items-start justify-between gap-2 select-none"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <button
                      type="button"
                      className="mt-0.5 text-slate-400 hover:text-slate-600 transition-transform"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-blue-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-900 truncate">
                          {trace.stage}
                        </span>
                        {getStatusBadge(trace)}
                        {trace.clientDescription && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {trace.clientDescription}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600 truncate">
                        <span className="font-bold text-blue-700">{trace.method}</span>
                        <span className="truncate text-slate-700">{trace.url}</span>
                      </div>

                      {trace.error && (
                        <div className="text-[11px] font-mono text-rose-600 truncate flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{trace.error}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-slate-400">{timeFormatted}</span>
                  </div>
                </div>

                {/* Expanded Trace Details */}
                {isExpanded && (
                  <div className="p-3.5 bg-slate-50/90 border-t border-slate-200 space-y-3 text-xs">
                    {/* Root Cause / Analysis Box */}
                    {tip && (
                      <div className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${tip.color}`}>
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold">{tip.title}</div>
                          <div className="text-[11px] mt-0.5 leading-relaxed">{tip.message}</div>
                        </div>
                      </div>
                    )}

                    {/* Request Headers Sent */}
                    <div className="space-y-1">
                      <div className="font-bold text-slate-700 text-[11px] flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Send className="w-3 h-3 text-blue-600" />
                          <span>Request Headers Sent:</span>
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto space-y-1">
                        {Object.entries(trace.headersSent || {}).map(([key, val]) => (
                          <div key={key} className="flex gap-2">
                            <span className="text-blue-400 shrink-0 font-semibold">{key}:</span>
                            <span className="text-amber-200 break-all">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Request Parameters / Body Sent */}
                    <div className="space-y-1">
                      <div className="font-bold text-slate-700 text-[11px] flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Code2 className="w-3 h-3 text-indigo-600" />
                          <span>Request Parameters / Form Body:</span>
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto space-y-1">
                        {Object.entries(trace.paramsSent || {}).map(([key, val]) => (
                          <div key={key} className="flex gap-2">
                            <span className="text-indigo-400 shrink-0 font-semibold">{key}:</span>
                            <span className="text-slate-100 break-all">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Location Redirect Header if Present */}
                    {trace.locationHeader && (
                      <div className="space-y-1">
                        <div className="font-bold text-blue-900 text-[11px] flex items-center gap-1">
                          <ArrowDownLeft className="w-3 h-3 text-blue-600" />
                          <span>HTTP 302 Location Redirect Header:</span>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-950 text-blue-200 font-mono text-[11px] break-all border border-blue-900">
                          {trace.locationHeader}
                        </div>
                      </div>
                    )}

                    {/* Response Body Snippet */}
                    {trace.responseBodySnippet && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 text-[11px]">
                            Response Body Snippet:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySnippet(trace.responseBodySnippet || "", index)}
                            className="text-[10px] text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1"
                          >
                            {copiedSnippetIndex === index ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Response</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-2.5 rounded-lg bg-slate-950 text-slate-100 font-mono text-[11px] max-h-48 overflow-y-auto overflow-x-auto whitespace-pre-wrap break-all border border-slate-800">
                          {trace.responseBodySnippet}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
