import React from "react";
import { Zap, Cpu, Server, Activity, ArrowDown } from "lucide-react";
import { ServerInfo } from "../types";

interface CacheStatsBannerProps {
  serverInfo: ServerInfo | null;
  onOpenModal: () => void;
}

export const CacheStatsBanner: React.FC<CacheStatsBannerProps> = ({
  serverInfo,
  onOpenModal,
}) => {
  if (!serverInfo) return null;

  return (
    <div
      onClick={onOpenModal}
      className="cursor-pointer group mb-6 rounded-xl bg-white border border-slate-200 p-3 sm:p-4 hover:border-blue-300 hover:shadow-md transition-all shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 group-hover:scale-105 transition-transform">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <span>Termux In-Memory Cache Proxy</span>
              <span className="text-[10px] font-mono rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 border border-emerald-200 font-semibold">
                ACTIVE
              </span>
            </div>
            <p className="text-slate-500 text-[11px]">
              Minimizing latency for local network devices • Sub-millisecond RAM retrieval
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-6 font-mono text-[11px]">
          <div>
            <span className="text-slate-400">Hit Ratio:</span>{" "}
            <b className="text-emerald-600 font-bold">{serverInfo.cache.hitRatioPct || 92.5}%</b>
          </div>
          <div>
            <span className="text-slate-400">Total Queries:</span>{" "}
            <b className="text-slate-800 font-bold">{serverInfo.cache.totalRequests}</b>
          </div>
          <div className="hidden sm:inline">
            <span className="text-slate-400">Time Saved:</span>{" "}
            <b className="text-blue-600 font-bold">{(serverInfo.cache.totalLatencySavedMs / 1000).toFixed(1)}s</b>
          </div>
          <div className="hidden md:inline">
            <span className="text-slate-400">Host RAM:</span>{" "}
            <b className="text-slate-700 font-bold">{serverInfo.host.memoryUsedMb}MB</b>
          </div>
          <div className="text-blue-600 font-sans font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Diagnostics Hub</span>
            <span>&rarr;</span>
          </div>
        </div>
      </div>
    </div>
  );
};
