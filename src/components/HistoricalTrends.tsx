import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  History,
  TrendingUp,
  Calendar,
  ThermometerSnowflake,
  ThermometerSun,
  Droplet,
  Zap,
  RefreshCw,
  BarChart3,
  Layers,
} from "lucide-react";
import { HistoricalData, UnitSystem } from "../types";

interface HistoricalTrendsProps {
  latitude: number;
  longitude: number;
  city: string;
  units: UnitSystem;
}

export const HistoricalTrends: React.FC<HistoricalTrendsProps> = ({
  latitude,
  longitude,
  city,
  units,
}) => {
  const [days, setDays] = useState<number>(30);
  const [histData, setHistData] = useState<HistoricalData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"temp_range" | "precip_wind">("temp_range");

  const tempUnit = units === "imperial" ? "°F" : "°C";
  const precipUnit = units === "imperial" ? "in" : "mm";
  const speedUnit = units === "imperial" ? "mph" : "km/h";

  useEffect(() => {
    let isCancelled = false;
    const fetchHistorical = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/historical?lat=${latitude}&lon=${longitude}&days=${days}&units=${units}`
        );
        if (!res.ok) throw new Error("Failed to load historical data");
        const data = await res.json();
        if (!isCancelled) {
          setHistData(data);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || "Could not retrieve historical trends");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchHistorical();
    return () => {
      isCancelled = true;
    };
  }, [latitude, longitude, days, units]);

  // Format chart data
  const chartRecords = (histData?.records || []).map((r) => {
    const d = new Date(r.date);
    const dateLabel = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return {
      date: dateLabel,
      fullDate: r.date,
      tempMax: r.tempMax,
      tempMin: r.tempMin,
      tempMean: r.tempMean,
      tempRange: [r.tempMin, r.tempMax],
      precipitation: r.precipitation,
      windSpeedMax: r.windSpeedMax,
    };
  });

  return (
    <div id="historical-trends-section" className="relative rounded-2xl glass-card border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 shadow-xl text-slate-800 dark:text-slate-100 overflow-hidden">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-500" />
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Historical Temperature &amp; Climate Trends
            </h3>
            {histData?.meta?.isCacheHit && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                ⚡ RAM Cache ({histData.meta.responseTimeMs}ms)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Open-Meteo climate archive analysis for {city} over past {days} days
          </p>
        </div>

        {/* Controls: Days Selector & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metric selector */}
          <div className="flex rounded-xl bg-slate-100/70 dark:bg-slate-800/70 p-1 border border-slate-200 dark:border-slate-700 text-xs backdrop-blur-md">
            <button
              onClick={() => setChartMode("temp_range")}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                chartMode === "temp_range"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Temperature Spread
            </button>
            <button
              onClick={() => setChartMode("precip_wind")}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                chartMode === "precip_wind"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Precip &amp; Wind
            </button>
          </div>

          {/* Time range pills */}
          <div className="flex rounded-xl bg-slate-100/70 dark:bg-slate-800/70 p-1 border border-slate-200 dark:border-slate-700 text-xs backdrop-blur-md">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-all ${
                  days === d
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700/80"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {histData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 font-medium">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Mean Temp
              </span>
              <span className="text-[10px] text-slate-400">{days}d Avg</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {histData.stats.averageTemperature}{tempUnit}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 font-medium">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <ThermometerSun className="w-3.5 h-3.5 text-orange-600" /> Record High
              </span>
              <span className="text-[10px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">Peak</span>
            </div>
            <div className="text-2xl font-bold text-orange-600 font-mono">
              {histData.stats.highestTemperature}{tempUnit}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 font-medium">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <ThermometerSnowflake className="w-3.5 h-3.5 text-blue-600" /> Record Low
              </span>
              <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Trough</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 font-mono">
              {histData.stats.lowestTemperature}{tempUnit}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 font-medium">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Droplet className="w-3.5 h-3.5 text-sky-600" /> Total Precip
              </span>
              <span className="text-[10px] text-slate-400">Accumulated</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 font-mono">
              {histData.stats.totalPrecipitation} <span className="text-xs font-normal text-slate-500">{precipUnit}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Historical Chart Canvas */}
      <div className="h-64 sm:h-72 w-full relative">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-xs rounded-xl z-20">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mb-2" />
            <span className="text-xs text-slate-600 font-medium">Loading historical climate records...</span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-rose-600">
            {error}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === "temp_range" ? (
              <ComposedChart data={chartRecords} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="maxGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA580C" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#EA580C" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="minGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284C7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0284C7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#94A3B8"
                  tick={{ fontSize: 10, fill: "#64748B", fontFamily: "monospace" }}
                  interval={days > 30 ? Math.floor(days / 8) : days > 14 ? 2 : 1}
                />
                <YAxis
                  stroke="#94A3B8"
                  tick={{ fontSize: 11, fill: "#64748B", fontFamily: "monospace" }}
                  unit={tempUnit}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-xl text-xs font-mono">
                          <div className="font-bold text-slate-900 mb-1.5 border-b border-slate-100 pb-1 font-sans">
                            {data.fullDate}
                          </div>
                          <div className="space-y-1 text-slate-600">
                            <div className="flex justify-between gap-4">
                              <span className="text-orange-600 font-semibold">Max Temp:</span>
                              <b className="text-slate-900 font-bold">{data.tempMax}{tempUnit}</b>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-blue-600 font-semibold">Mean Temp:</span>
                              <b className="text-slate-900 font-bold">{data.tempMean}{tempUnit}</b>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-sky-600 font-semibold">Min Temp:</span>
                              <b className="text-slate-900 font-bold">{data.tempMin}{tempUnit}</b>
                            </div>
                            <div className="flex justify-between gap-4 pt-1 border-t border-slate-100">
                              <span className="text-slate-500">Precipitation:</span>
                              <b className="text-blue-600 font-bold">{data.precipitation} {precipUnit}</b>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tempMax"
                  name="Max Temp"
                  stroke="#EA580C"
                  strokeWidth={2}
                  fill="url(#maxGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="tempMean"
                  name="Mean Temp"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="tempMin"
                  name="Min Temp"
                  stroke="#0284C7"
                  strokeWidth={2}
                  fill="url(#minGradient)"
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={chartRecords} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#94A3B8"
                  tick={{ fontSize: 10, fill: "#64748B", fontFamily: "monospace" }}
                  interval={days > 30 ? Math.floor(days / 8) : 2}
                />
                <YAxis
                  yAxisId="precip"
                  stroke="#2563EB"
                  tick={{ fontSize: 11, fill: "#2563EB", fontFamily: "monospace" }}
                  unit={` ${precipUnit}`}
                />
                <YAxis
                  yAxisId="wind"
                  orientation="right"
                  stroke="#0D9488"
                  tick={{ fontSize: 11, fill: "#0D9488", fontFamily: "monospace" }}
                  unit={` ${speedUnit}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-xl text-xs font-mono">
                          <div className="font-bold text-slate-900 mb-1 font-sans">{data.fullDate}</div>
                          <div className="text-blue-600">Precip: <b>{data.precipitation} {precipUnit}</b></div>
                          <div className="text-emerald-600">Max Wind: <b>{data.windSpeedMax} {speedUnit}</b></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  yAxisId="precip"
                  dataKey="precipitation"
                  name="Precipitation"
                  fill="#3B82F6"
                  radius={[3, 3, 0, 0]}
                  barSize={days > 30 ? 6 : 10}
                />
                <Line
                  yAxisId="wind"
                  type="monotone"
                  dataKey="windSpeedMax"
                  name="Max Wind Gust"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100 font-medium">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500"></span>
            <span className="text-slate-700">Daily Max</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
            <span className="text-slate-700">Daily Mean</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
            <span className="text-slate-700">Daily Min</span>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Source: Open-Meteo Historical Archive
        </span>
      </div>
    </div>
  );
};
