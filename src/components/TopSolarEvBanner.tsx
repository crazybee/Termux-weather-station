import React from "react";
import {
  Sun,
  Zap,
  BatteryCharging,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Moon,
} from "lucide-react";
import { EvSolarPrediction } from "../types";

interface TopSolarEvBannerProps {
  prediction: EvSolarPrediction;
  onScrollToDetails?: () => void;
}

export const TopSolarEvBanner: React.FC<TopSolarEvBannerProps> = ({
  prediction,
  onScrollToDetails,
}) => {
  const isExcellent = prediction.verdict === "EXCELLENT";
  const isGood = prediction.verdict === "GOOD";
  const isModerate = prediction.verdict === "MODERATE";
  const isPoor = prediction.verdict === "POOR" || prediction.isOffPeakSchedule || prediction.isSuitableForCharging === false;

  const handleScroll = () => {
    if (onScrollToDetails) {
      onScrollToDetails();
    } else {
      const el = document.getElementById("ev-solar-charging-forecast");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <div
      id="top-solar-charging-banner"
      className={`w-full border-b transition-colors shadow-xs ${
        isExcellent
          ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-emerald-500"
          : isGood
          ? "bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 text-white border-teal-500"
          : isModerate
          ? "bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white border-amber-500"
          : "bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white border-slate-700"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Solar Icon + Obvious High-Visibility Badge */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-xs font-mono font-bold text-xs tracking-wide uppercase border border-white/30 shrink-0">
            <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>Tomorrow's EV Solar Forecast:</span>
            <span
              className={`px-1.5 py-0.2 rounded font-black ${
                isExcellent || isGood
                  ? "bg-white text-emerald-900"
                  : isModerate
                  ? "bg-white text-amber-900"
                  : "bg-white text-slate-900"
              }`}
            >
              {prediction.verdict} ({prediction.score}/100)
            </span>
          </div>

          {/* Actionable summary text */}
          <div className="text-xs font-semibold flex items-center gap-2 flex-wrap text-white/95">
            <span className="hidden md:inline text-white/80">•</span>
            <span className="flex items-center gap-1">
              {isPoor ? (
                <Moon className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              )}
              <span>
                {isExcellent && "☀️ Perfect sunny day tomorrow! Excellent surplus to charge your car."}
                {isGood && "🌤️ Good midday sun tomorrow (~" + prediction.estimatedSolarKwh + " kWh solar yield)."}
                {isModerate && "⛅ Scattered clouds tomorrow. Blend with grid or lower Easee current."}
                {isPoor && "🌧️ Unsuitable solar weather tomorrow. Night charging scheduled from 0:00 to 6:00 AM."}
              </span>
            </span>

            <span className="hidden lg:inline text-white/80">•</span>
            <span className="hidden lg:inline-flex items-center gap-1 font-mono text-[11px] bg-black/20 px-2 py-0.5 rounded-md">
              {isPoor ? (
                <>
                  <Moon className="w-3 h-3 text-indigo-300" />
                  <span>Night Charging: 0:00 AM – 6:00 AM</span>
                </>
              ) : (
                <>
                  <BatteryCharging className="w-3 h-3 text-emerald-300" />
                  <span>Peak Window: {prediction.peakWindowStart} – {prediction.peakWindowEnd}</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Button */}
        <button
          onClick={handleScroll}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-sm transition-transform active:scale-95 shrink-0 ml-auto sm:ml-0"
        >
          <span>Easee Charger Advisor</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-700" />
        </button>
      </div>
    </div>
  );
};
