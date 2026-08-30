import React, { useState } from "react";
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
} from "recharts";
import { Clock, Droplets, Wind, Thermometer, Layers } from "lucide-react";
import { HourlyItem, UnitSystem } from "../types";

interface HourlyForecastChartProps {
  hourly: HourlyItem[];
  units: {
    temperature: string;
    speed: string;
    precipitation: string;
  };
}

export const HourlyForecastChart: React.FC<HourlyForecastChartProps> = ({
  hourly,
  units,
}) => {
  const [viewHours, setViewHours] = useState<24 | 48>(24);
  const [metricMode, setMetricMode] = useState<"temp_precip" | "wind_humidity">("temp_precip");

  const displayData = hourly.slice(0, viewHours).map((item) => {
    // Format timestamp: "14:00"
    const dateObj = new Date(item.time);
    const hourLabel = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    const dayLabel = dateObj.toLocaleDateString([], { weekday: "short" });

    return {
      rawTime: item.time,
      time: hourLabel,
      fullLabel: `${dayLabel} ${hourLabel}`,
      temperature: item.temperature,
      apparentTemperature: item.apparentTemperature,
      precipitationProbability: item.precipitationProbability,
      precipitation: item.precipitation,
      humidity: item.humidity,
      windSpeed: item.windSpeed,
      uvIndex: item.uvIndex,
      description: item.description,
    };
  });

  return (
    <div id="hourly-forecast-chart" className="relative rounded-2xl glass-card border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 shadow-xl text-slate-800 dark:text-slate-100 overflow-hidden">
      {/* Header and Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5 tracking-tight">
            <Clock className="w-5 h-5 text-blue-500" />
            Interactive Hourly Forecast &amp; Trend Simulation
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Real-time projection of temperature curve, precipitation probability, and wind
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-slate-100/70 dark:bg-slate-800/70 p-1 border border-slate-200 dark:border-slate-700 text-xs backdrop-blur-md">
            <button
              onClick={() => setMetricMode("temp_precip")}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                metricMode === "temp_precip"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Temp &amp; Rain %
            </button>
            <button
              onClick={() => setMetricMode("wind_humidity")}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                metricMode === "wind_humidity"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Wind &amp; Humidity
            </button>
          </div>

          {/* Time range toggle */}
          <div className="flex rounded-xl bg-slate-100/70 dark:bg-slate-800/70 p-1 border border-slate-200 dark:border-slate-700 text-xs backdrop-blur-md">
            <button
              onClick={() => setViewHours(24)}
              className={`px-3 py-1 rounded-lg font-mono font-bold transition-all ${
                viewHours === 24
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700/80"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              24h
            </button>
            <button
              onClick={() => setViewHours(48)}
              className={`px-3 py-1 rounded-lg font-mono font-bold transition-all ${
                viewHours === 48
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700/80"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              48h
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {metricMode === "temp_precip" ? (
            <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="precipGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284C7" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#0284C7" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#94A3B8"
                tick={{ fontSize: 11, fill: "#64748B", fontFamily: "monospace" }}
                interval={viewHours === 24 ? 2 : 4}
              />
              <YAxis
                yAxisId="left"
                stroke="#94A3B8"
                tick={{ fontSize: 11, fill: "#64748B", fontFamily: "monospace" }}
                unit={units.temperature}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#0284C7"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#0284C7", fontFamily: "monospace" }}
                unit="%"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-xl text-xs">
                        <div className="font-bold text-slate-900 mb-1 border-b border-slate-100 pb-1">
                          {data.fullLabel} • <span className="text-blue-600 capitalize">{data.description}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600 font-mono">
                          <div>
                            Temp: <b className="text-slate-900">{data.temperature}{units.temperature}</b>
                          </div>
                          <div>
                            Feels: <b className="text-slate-700">{data.apparentTemperature}{units.temperature}</b>
                          </div>
                          <div>
                            Rain Chance: <b className="text-blue-600">{data.precipitationProbability}%</b>
                          </div>
                          <div>
                            Humidity: <b className="text-blue-600">{data.humidity}%</b>
                          </div>
                          <div>
                            Wind: <b className="text-emerald-600">{data.windSpeed} {units.speed}</b>
                          </div>
                          <div>
                            UV Index: <b className="text-orange-600">{data.uvIndex}</b>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                yAxisId="right"
                dataKey="precipitationProbability"
                name="Rain Chance %"
                fill="url(#precipGradient)"
                radius={[4, 4, 0, 0]}
                barSize={12}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="temperature"
                name="Temperature"
                stroke="#2563EB"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#tempGradient)"
              />
            </ComposedChart>
          ) : (
            <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#94A3B8"
                tick={{ fontSize: 11, fill: "#64748B", fontFamily: "monospace" }}
                interval={viewHours === 24 ? 2 : 4}
              />
              <YAxis
                yAxisId="wind"
                stroke="#0D9488"
                tick={{ fontSize: 11, fill: "#0D9488", fontFamily: "monospace" }}
                unit={` ${units.speed}`}
              />
              <YAxis
                yAxisId="humidity"
                orientation="right"
                stroke="#2563EB"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#2563EB", fontFamily: "monospace" }}
                unit="%"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-xl text-xs">
                        <div className="font-bold text-slate-900 mb-1">{data.fullLabel}</div>
                        <div className="text-emerald-700 font-mono">Wind: <b>{data.windSpeed} {units.speed}</b></div>
                        <div className="text-blue-700 font-mono">Humidity: <b>{data.humidity}%</b></div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                yAxisId="wind"
                type="monotone"
                dataKey="windSpeed"
                name="Wind Speed"
                stroke="#0D9488"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                yAxisId="humidity"
                type="monotone"
                dataKey="humidity"
                name="Humidity %"
                stroke="#2563EB"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                dot={false}
              />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend and Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 mt-4 pt-4 border-t border-slate-100 font-medium">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
            <span className="text-slate-700">Temperature ({units.temperature})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
            <span className="text-slate-700">Precipitation Chance (%)</span>
          </div>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Cached in Termux RAM for sub-millisecond retrieval
        </span>
      </div>
    </div>
  );
};
