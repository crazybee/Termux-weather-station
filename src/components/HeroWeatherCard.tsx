import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Wind,
  Droplets,
  Gauge,
  Sun,
  Eye,
  CloudRain,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Sunrise,
  Sunset,
  Clock,
  Sparkles,
} from "lucide-react";
import { WeatherData } from "../types";
import { WeatherIcon } from "./WeatherIcon";
import { getWindDirectionLabel, getUvCategory } from "../utils/weatherHelpers";

interface HeroWeatherCardProps {
  weather: WeatherData;
}

export const HeroWeatherCard: React.FC<HeroWeatherCardProps> = ({ weather }) => {
  const current = weather.current;
  const today = weather.daily[0];
  const windDirLabel = getWindDirectionLabel(current.windDirection);
  const uvInfo = getUvCategory(current.uvIndex);

  // Derive unique key so animations re-trigger smoothly on fresh fetches / location switches
  const animationKey = `${weather.city}-${weather.current.time}-${weather.meta?.fetchedAt || ""}`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={animationKey}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{
          duration: 0.35,
          ease: [0.16, 1, 0.3, 1],
        }}
        id="hero-weather-card"
        className="relative overflow-hidden rounded-2xl glass-card p-6 sm:p-8 shadow-xl transition-all text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800/80"
      >
        {/* Subtle decorative background glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-500/10 dark:bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-amber-500/10 dark:bg-amber-500/5 blur-3xl" />

        {/* Top Header: Location, Coordinates, and Cache Speed Badge */}
        <div className="relative flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/70 dark:border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {weather.city}
              </h2>
              <span className="rounded-full bg-slate-100/90 dark:bg-slate-800/90 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-700/80 shadow-2xs">
                {weather.latitude.toFixed(2)}°, {weather.longitude.toFixed(2)}°
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 font-medium">
              <span>Elevation: <b className="text-slate-700 dark:text-slate-200">{weather.elevation}m</b></span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>Timezone: <b className="text-slate-700 dark:text-slate-200">{weather.timezone}</b></span>
            </p>
          </div>

          {/* Cache Performance & Feels-like Badges */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2 bg-blue-500/10 dark:bg-sky-500/10 px-3.5 py-1.5 border border-blue-500/20 dark:border-sky-500/30 rounded-xl backdrop-blur-md">
              <span className="text-[11px] text-blue-600 dark:text-sky-400 font-bold uppercase tracking-wider">Feels Like</span>
              <span className="text-blue-700 dark:text-sky-300 text-sm font-extrabold font-mono">{current.apparentTemperature}{weather.units.temperature}</span>
            </div>

            {weather.meta?.isCacheHit ? (
              <div
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 dark:border-emerald-500/40 px-3 py-1.5 text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs glow-emerald backdrop-blur-md"
                title="Served instantly from Termux host RAM Cache"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>RAM: <b>{weather.meta.responseTimeMs.toFixed(1)}ms</b></span>
                <span className="text-emerald-600/80 dark:text-emerald-400/80 text-[10px]">({weather.meta.cacheAgeSeconds}s)</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/15 border border-cyan-500/30 dark:border-cyan-500/40 px-3 py-1.5 text-xs font-mono font-semibold text-cyan-700 dark:text-cyan-300 shadow-2xs glow-cyan backdrop-blur-md"
                title="Fetched from Live Weather API & Cached to RAM"
              >
                <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>{weather.provider || weather.meta?.provider || "OpenWeather"}: <b>{weather.meta?.responseTimeMs || 45}ms</b></span>
              </div>
            )}
          </div>
        </div>

        {/* Main Weather Hero Block */}
        <div className="relative my-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left: Temp & Condition */}
          <div className="md:col-span-7 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="shrink-0 relative flex items-center justify-center p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-sky-500/15 dark:to-indigo-500/15 border border-blue-200/60 dark:border-sky-500/30 shadow-md">
              <div className="absolute inset-0 rounded-2xl bg-blue-400/10 blur-md pointer-events-none" />
              <WeatherIcon
                icon={current.icon}
                isDay={current.isDay}
                className="w-18 h-18 sm:w-22 sm:h-22 relative z-10 drop-shadow-md"
              />
            </div>

            <div className="text-center sm:text-left">
              <div className="flex items-baseline justify-center sm:justify-start gap-1">
                <span className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white font-sans">
                  {current.temperature}
                </span>
                <span className="text-2xl sm:text-3xl font-light text-slate-400 dark:text-slate-400">
                  {weather.units.temperature}
                </span>
              </div>

              <div className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-1 capitalize tracking-tight">
                {current.description}
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-slate-500 dark:text-slate-400 mt-3 font-medium">
                {today && (
                  <>
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 bg-emerald-500/10 dark:bg-emerald-500/15 px-2.5 py-1 rounded-lg border border-emerald-500/20 dark:border-emerald-500/30 font-mono">
                      <ArrowUpRight className="w-3.5 h-3.5" /> High: {today.tempMax}{weather.units.temperature}
                    </span>
                    <span className="text-sky-700 dark:text-sky-300 font-semibold flex items-center gap-1 bg-sky-500/10 dark:bg-sky-500/15 px-2.5 py-1 rounded-lg border border-sky-500/20 dark:border-sky-500/30 font-mono">
                      <ArrowDownRight className="w-3.5 h-3.5" /> Low: {today.tempMin}{weather.units.temperature}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Sun & Precipitation summary */}
          <div className="md:col-span-5 grid grid-cols-2 gap-3 bg-slate-100/60 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Sunrise className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Sunrise</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">
                  {today?.sunrise ? today.sunrise.split("T")[1]?.slice(0, 5) : "06:15"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                <Sunset className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Sunset</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">
                  {today?.sunset ? today.sunset.split("T")[1]?.slice(0, 5) : "19:45"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                <CloudRain className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Rain Chance</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">
                  {today?.precipitationProbabilityMax ?? 0}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${uvInfo.bg} dark:bg-slate-800/80 dark:border-slate-700`}>
                <Sun className={`w-4 h-4 ${uvInfo.color}`} />
              </div>
              <div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">UV Index</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="font-mono">{current.uvIndex}</span>
                  <span className={`text-[11px] font-bold ${uvInfo.color}`}>
                    ({uvInfo.label})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid: Detailed Environmental Sensors */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-slate-200/70 dark:border-slate-800/80">
          {/* Wind Speed & Compass */}
          <div className="rounded-2xl bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 p-4 transition-all hover:border-blue-400/50 dark:hover:border-sky-500/40">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                <Wind className="w-3.5 h-3.5 text-sky-500" /> Wind
              </span>
              <span className="font-mono text-[10px] text-sky-600 dark:text-sky-300 font-bold bg-sky-500/10 dark:bg-sky-500/15 px-1.5 py-0.5 rounded-md border border-sky-500/20">{windDirLabel} ({current.windDirection}°)</span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {current.windSpeed} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{weather.units.speed}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Gusts: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{current.windGusts} {weather.units.speed}</span>
            </div>
          </div>

          {/* Humidity */}
          <div className="rounded-2xl bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 p-4 transition-all hover:border-blue-400/50 dark:hover:border-sky-500/40">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                <Droplets className="w-3.5 h-3.5 text-blue-500" /> Humidity
              </span>
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{current.cloudCover}% Cloud</span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {current.humidity}<span className="text-xs font-normal text-slate-500 dark:text-slate-400">%</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Dew point: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{weather.hourly[0]?.dewPoint ?? 12}{weather.units.temperature}</span>
            </div>
          </div>

          {/* Barometric Pressure */}
          <div className="rounded-2xl bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 p-4 transition-all hover:border-amber-400/50 dark:hover:border-amber-500/40">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                <Gauge className="w-3.5 h-3.5 text-amber-500" /> Pressure
              </span>
              <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/15 px-1.5 py-0.5 rounded-md font-mono font-semibold border border-amber-500/20">Stable</span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {current.pressure} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">hPa</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Surface: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{current.surfacePressure} hPa</span>
            </div>
          </div>

          {/* Visibility & Precipitation */}
          <div className="rounded-2xl bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 p-4 transition-all hover:border-emerald-400/50 dark:hover:border-emerald-500/40">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                <Eye className="w-3.5 h-3.5 text-emerald-500" /> Visibility
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded-md font-mono font-semibold border border-emerald-500/20">Clear</span>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {weather.hourly[0]?.visibility ?? 10} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">km</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Precip: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{current.precipitation} {weather.units.precipitation}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
