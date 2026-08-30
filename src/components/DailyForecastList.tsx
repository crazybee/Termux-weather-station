import React from "react";
import { Calendar, CloudRain, Sun, Wind, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { DailyItem, UnitSystem } from "../types";
import { WeatherIcon } from "./WeatherIcon";
import { getUvCategory } from "../utils/weatherHelpers";

interface DailyForecastListProps {
  daily: DailyItem[];
  units: {
    temperature: string;
    speed: string;
    precipitation: string;
  };
}

export const DailyForecastList: React.FC<DailyForecastListProps> = ({
  daily,
  units,
}) => {
  // Find global min and max for the 7 days to scale temperature progress bar
  const allMins = daily.map((d) => d.tempMin);
  const allMaxs = daily.map((d) => d.tempMax);
  const globalMin = Math.min(...allMins);
  const globalMax = Math.max(...allMaxs);
  const range = globalMax - globalMin || 1;

  return (
    <div id="daily-forecast-container" className="relative rounded-2xl glass-card border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 shadow-xl text-slate-800 dark:text-slate-100 overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5 tracking-tight">
            <Calendar className="w-5 h-5 text-blue-500" />
            7-Day Synoptic Weather Outlook
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Daily temperature spectrum, precipitation probabilities, and maximum UV
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {daily.map((item, index) => {
          const dateObj = new Date(item.date);
          const isToday = index === 0;
          const dayName = isToday
            ? "Today"
            : dateObj.toLocaleDateString([], { weekday: "short" });
          const formattedDate = dateObj.toLocaleDateString([], {
            month: "short",
            day: "numeric",
          });

          // Calculate temperature bar relative positions
          const leftPercent = Math.max(0, ((item.tempMin - globalMin) / range) * 100);
          const widthPercent = Math.max(8, ((item.tempMax - item.tempMin) / range) * 100);
          const uvInfo = getUvCategory(item.uvIndexMax);

          return (
            <div
              key={item.date}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition-all ${
                isToday
                  ? "bg-blue-500/10 dark:bg-sky-500/10 border-blue-500/30 dark:border-sky-500/30 shadow-xs"
                  : "bg-slate-100/50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60 hover:border-blue-400/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
              }`}
            >
              {/* Day & Date */}
              <div className="flex items-center gap-3 sm:w-36 shrink-0">
                <div className="w-8 flex items-center justify-center">
                  <WeatherIcon icon={item.icon} isDay={true} className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    {dayName}
                    {isToday && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-extrabold text-white uppercase tracking-wider font-mono">
                        Now
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-400 font-mono">
                    {formattedDate}
                  </div>
                </div>
              </div>

              {/* Weather Condition */}
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 sm:w-36 capitalize truncate">
                {item.description}
              </div>

              {/* Rain Chance & UV */}
              <div className="flex items-center gap-3 sm:w-44 text-xs font-mono">
                <div className="flex items-center gap-1 text-blue-600 dark:text-sky-400 font-medium">
                  <CloudRain className="w-3.5 h-3.5" />
                  <span>{item.precipitationProbabilityMax}%</span>
                  {item.precipitationSum > 0 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-400">
                      ({item.precipitationSum}{units.precipitation})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Sun className={`w-3.5 h-3.5 ${uvInfo.color}`} />
                  <span className={`text-[11px] font-bold ${uvInfo.color}`}>
                    UV {item.uvIndexMax}
                  </span>
                </div>
              </div>

              {/* Temperature Bar */}
              <div className="flex items-center gap-3 flex-1 min-w-[160px]">
                <span className="text-xs font-mono text-blue-600 dark:text-sky-400 w-8 text-right font-bold">
                  {item.tempMin}°
                </span>

                {/* Progress bar representing temp range */}
                <div className="relative h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700/80 overflow-hidden">
                  <div
                    className="absolute h-full rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-rose-500"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                    }}
                  />
                </div>

                <span className="text-xs font-mono text-rose-600 dark:text-rose-400 w-8 text-left font-bold">
                  {item.tempMax}°
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
