import { WeatherData, CustomAlertRule, ActiveAlert } from "../types";

// Convert wind degrees into 16-point cardinal compass direction
export function getWindDirectionLabel(degrees: number): string {
  const directions = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const index = Math.round((degrees % 360) / 22.5) % 16;
  return directions[index];
}

// Convert UV index into risk category and color class
export function getUvCategory(uv: number): { label: string; color: string; bg: string } {
  if (uv <= 2) return { label: "Low", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
  if (uv <= 5) return { label: "Moderate", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" };
  if (uv <= 7) return { label: "High", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" };
  if (uv <= 10) return { label: "Very High", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
  return { label: "Extreme", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" };
}

// Format duration from seconds to human uptime
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  return `${hours}h ${mins}m`;
}

// Evaluate user custom alert rules against current live weather
export function evaluateWeatherAlerts(
  weather: WeatherData,
  customRules: CustomAlertRule[]
): ActiveAlert[] {
  const alerts: ActiveAlert[] = [];
  const current = weather.current;

  // 1. Built-in threshold alerts
  // Severe weather codes
  if (current.weatherCode >= 95) {
    alerts.push({
      id: "severe_storm",
      type: "Severe Thunderstorm",
      severity: "danger",
      title: "Severe Thunderstorm Warning",
      message: `Lightning and potential hail detected in ${weather.city}. Take shelter indoors.`,
      value: `${current.description}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }

  // Freezing condition
  const isFreezing = weather.units.temperature === "°C" ? current.temperature <= 0 : current.temperature <= 32;
  if (isFreezing) {
    alerts.push({
      id: "freeze_warning",
      type: "Freeze Warning",
      severity: "warning",
      title: "Frost / Freeze Advisory",
      message: `Current temp is ${current.temperature}${weather.units.temperature}. Protect sensitive outdoor plants and pipes.`,
      value: `${current.temperature}${weather.units.temperature}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }

  // Extreme UV Alert
  if (current.uvIndex >= 8) {
    alerts.push({
      id: "uv_extreme",
      type: "Extreme UV Advisory",
      severity: "warning",
      title: "Extreme UV Index Warning",
      message: `UV Index is currently ${current.uvIndex}. Unprotected skin can burn within 15 minutes. Wear SPF 50+.`,
      value: `UV ${current.uvIndex}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }

  // Gale / High wind
  const isHighWind = weather.units.speed === "km/h" ? current.windSpeed >= 45 : current.windSpeed >= 28;
  if (isHighWind) {
    alerts.push({
      id: "high_wind",
      type: "High Wind Advisory",
      severity: "warning",
      title: "Strong Wind Gust Alert",
      message: `Sustained winds of ${current.windSpeed} ${weather.units.speed} with gusts up to ${current.windGusts} ${weather.units.speed}.`,
      value: `${current.windSpeed} ${weather.units.speed}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }

  // Tomorrow's EV Solar Charging Forecast Alert
  const tomorrowForecast = calculateTomorrowEvSolarPrediction(weather);
  if (tomorrowForecast.verdict === "EXCELLENT" || tomorrowForecast.verdict === "GOOD") {
    alerts.push({
      id: "ev_solar_favorable",
      type: "Solar EV Charging Alert",
      severity: "info",
      title: `⚡ Tomorrow EV Solar Alert: ${tomorrowForecast.verdict === "EXCELLENT" ? "Prime" : "Favorable"} Conditions`,
      message: `Sunny conditions tomorrow (~${tomorrowForecast.estimatedSolarKwh} kWh solar yield). Recommended: Charge EV between ${tomorrowForecast.peakWindowStart} - ${tomorrowForecast.peakWindowEnd} using Easee Solar/Eco mode.`,
      value: `${tomorrowForecast.score}/100 Solar Score`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  } else if (tomorrowForecast.verdict === "POOR" || !tomorrowForecast.isSuitableForCharging) {
    alerts.push({
      id: "ev_solar_poor",
      type: "Solar EV Charging Alert",
      severity: "warning",
      title: "⚡ Tomorrow EV Solar Alert: Unsuitable Weather — Fallback Schedule Active",
      message: `Forecast is not suitable for solar charging tomorrow (${tomorrowForecast.cloudCoverageAvg}% cloud, ${tomorrowForecast.rainRisk}% rain). Next day schedule automatically set to overnight off-peak: 0:00 to 6:00 AM.`,
      value: `Schedule: 0:00 – 6:00 AM`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }

  // 2. Evaluate User Configurable Rules
  for (const rule of customRules) {
    if (!rule.enabled) continue;

    let currentValue = 0;
    let unit = "";

    switch (rule.metric) {
      case "temperature":
        currentValue = current.temperature;
        unit = weather.units.temperature;
        break;
      case "windSpeed":
        currentValue = current.windSpeed;
        unit = weather.units.speed;
        break;
      case "uvIndex":
        currentValue = current.uvIndex;
        unit = "";
        break;
      case "humidity":
        currentValue = current.humidity;
        unit = "%";
        break;
      case "precipitationProbability":
        currentValue = weather.daily[0]?.precipitationProbabilityMax ?? 0;
        unit = "%";
        break;
    }

    const isTriggered = rule.condition === ">" ? currentValue > rule.value : currentValue < rule.value;

    if (isTriggered) {
      alerts.push({
        id: `custom_${rule.id}`,
        type: "Custom Rule Alert",
        severity: rule.severity,
        title: `${rule.label} Triggered`,
        message: `${rule.label}: Current value is ${currentValue}${unit} (Threshold: ${rule.condition} ${rule.value}${unit}).`,
        value: `${currentValue}${unit}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    }
  }

  return alerts;
}

// Preset popular cities with global distribution
export const POPULAR_LOCATIONS = [
  { name: "New York", country: "United States", latitude: 40.7128, longitude: -74.0060 },
  { name: "London", country: "United Kingdom", latitude: 51.5074, longitude: -0.1278 },
  { name: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 },
  { name: "Paris", country: "France", latitude: 48.8566, longitude: 2.3522 },
  { name: "Sydney", country: "Australia", latitude: -33.8688, longitude: 151.2093 },
  { name: "Berlin", country: "Germany", latitude: 52.5200, longitude: 13.4050 },
  { name: "Singapore", country: "Singapore", latitude: 1.3521, longitude: 103.8198 },
  { name: "San Francisco", country: "United States", latitude: 37.7749, longitude: -122.4194 },
  { name: "Toronto", country: "Canada", latitude: 43.6532, longitude: -79.3832 },
  { name: "Dubai", country: "United Arab Emirates", latitude: 25.2048, longitude: 55.2708 },
];

/**
 * Predict solar PV generation for a specific forecast day (0 = Today, 1 = Tomorrow, etc.)
 * and determine optimal charging windows and Easee settings.
 */
export function calculateSolarPredictionForDay(weather: WeatherData, dayIndex: number = 1): import("../types").EvSolarPrediction {
  const targetDaily = weather.daily[dayIndex] || weather.daily[0];
  const targetDateStr = targetDaily?.date;
  
  // Filter hourly forecasts belonging to the target date
  const targetHourly = targetDateStr ? weather.hourly.filter((h) => h.time.startsWith(targetDateStr)) : [];
  const fallbackSlice = dayIndex === 0 ? weather.hourly.slice(0, 24) : weather.hourly.slice(24, 48);
  const hourlyData = targetHourly.length > 0 ? targetHourly : fallbackSlice;

  // Daylight hours typically between 07:00 and 19:00
  const daytimeHours = hourlyData.filter((h) => {
    const hour = new Date(h.time).getHours();
    return hour >= 7 && hour <= 19;
  });

  const avgCloud = daytimeHours.length > 0
    ? Math.round(daytimeHours.reduce((acc, h) => acc + (h.cloudCover ?? (h.uvIndex < 2 ? 80 : 20)), 0) / daytimeHours.length)
    : 35;

  const maxUv = targetDaily?.uvIndexMax ?? 5;
  const rainProb = targetDaily?.precipitationProbabilityMax ?? 0;
  const rainSum = targetDaily?.precipitationSum ?? 0;
  
  // Calculate solar radiation / production score
  const solarHours = daytimeHours.filter((h) => (h.cloudCover ?? 30) < 40 && h.uvIndex >= 3).length;
  
  // Base calculation (0 to 100)
  let score = 100;
  score -= avgCloud * 0.55;
  score -= rainProb * 0.35;
  score += Math.min(25, maxUv * 3.5);
  if (rainSum > 5) score -= 20;
  score = Math.max(5, Math.min(99, Math.round(score)));

  let verdict: "EXCELLENT" | "GOOD" | "MODERATE" | "POOR" = "GOOD";
  let badgeColor = "bg-emerald-500 text-white";
  let easeeRecommendation = "Set Easee Charger to Solar-Only mode (Eco/Surplus)";
  let summary = "Strong clear-sky daylight forecast. Ideal for self-consuming 100% green solar energy.";

  const dayLabel = dayIndex === 0 ? "today" : "tomorrow";

  const isSuitableForCharging = score >= 38 && avgCloud < 85 && rainProb < 75;

  if (score >= 78) {
    verdict = "EXCELLENT";
    badgeColor = "bg-emerald-600 text-white";
    easeeRecommendation = "Set Easee to 100% Solar / Eco Mode (3-Phase 16A / 11kW recommended). Expected surplus will easily charge your EV.";
    summary = `Sunny & clear conditions ${dayLabel}. High solar irradiance will generate ample free surplus energy for your vehicle.`;
  } else if (score >= 58) {
    verdict = "GOOD";
    badgeColor = "bg-emerald-500 text-white";
    easeeRecommendation = "Schedule Easee solar charging between 11:00 AM and 3:30 PM, or enable Dynamic Grid + Solar blend.";
    summary = `Mostly sunny with intermittent clouds ${dayLabel}. Great opportunity for solar charging around midday peak generation.`;
  } else if (score >= 38) {
    verdict = "MODERATE";
    badgeColor = "bg-amber-500 text-white";
    easeeRecommendation = "Limit Easee charge current (e.g. 6A-10A single phase) or blend with off-peak grid tariff to avoid grid pull spikes.";
    summary = `Scattered cloud cover or light overcast expected ${dayLabel}. Solar generation will fluctuate throughout the afternoon.`;
  } else {
    verdict = "POOR";
    badgeColor = "bg-rose-500 text-white";
    easeeRecommendation = "Weather forecast is not suitable for solar charging. Next day schedule set from 0:00 to 6:00 AM (overnight off-peak).";
    summary = `Overcast sky, high cloud density, or rain forecast ${dayLabel}. Weather is not suitable for solar charging — schedule set to overnight off-peak (0:00 to 6:00 AM).`;
  }

  // Estimated solar generation for a standard 6.5kW array
  const estimatedSolarKwh = Math.round((Math.max(2, score * 0.28) * (maxUv > 0 ? (maxUv / 5) : 1) * 10)) / 10;

  // Build hourly production curve (from 6:00 to 20:00)
  const hourlyProduction = (hourlyData.length > 0 ? hourlyData : weather.hourly.slice(0, 24))
    .filter((h) => {
      const hr = new Date(h.time).getHours();
      return hr >= 6 && hr <= 20;
    })
    .map((h) => {
      const hour = new Date(h.time).getHours();
      const hourLabel = `${hour === 12 ? 12 : hour % 12}:00 ${hour >= 12 ? "PM" : "AM"}`;
      const cloud = h.cloudCover ?? (h.uvIndex < 2 ? 75 : 25);
      
      const sunAngleMultiplier = Math.sin(((hour - 6) / 14) * Math.PI);
      const cloudFactor = Math.max(0.12, (100 - cloud) / 100);
      const rawKw = 6.2 * sunAngleMultiplier * cloudFactor;
      const solarPowerKw = Math.max(0, Math.round(rawKw * 10) / 10);
      
      let recommendedAmpLimit = 6;
      if (solarPowerKw >= 7.0) recommendedAmpLimit = 16;
      else if (solarPowerKw >= 5.0) recommendedAmpLimit = 13;
      else if (solarPowerKw >= 3.6) recommendedAmpLimit = 10;
      else if (solarPowerKw >= 2.0) recommendedAmpLimit = 8;
      else if (solarPowerKw < 1.4) recommendedAmpLimit = 0;

      return {
        time: h.time,
        hourLabel,
        solarPowerKw,
        uv: h.uvIndex,
        cloudCover: cloud,
        recommendedAmpLimit,
      };
    });

  let peakWindowStart: string;
  let peakWindowEnd: string;

  if (isSuitableForCharging && verdict !== "POOR") {
    // Dynamic Peak Window calculation from daytime production curve
    const peakProductionHours = hourlyProduction.filter((p) => p.solarPowerKw >= 2.5);
    let startHour = 10;
    let endHour = 16;
    if (peakProductionHours.length > 0) {
      const hours = peakProductionHours.map((p) => new Date(p.time).getHours()).filter((h) => !isNaN(h));
      if (hours.length > 0) {
        startHour = Math.max(8, Math.min(...hours));
        endHour = Math.min(18, Math.max(...hours) + 1);
      }
    }

    const formatPeakHour = (h: number, isHalf: boolean = false) => {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      return `${displayHour}:${isHalf ? "30" : "00"} ${period}`;
    };

    peakWindowStart = formatPeakHour(startHour, true); // e.g. "10:30 AM"
    peakWindowEnd = formatPeakHour(endHour, true); // e.g. "4:30 PM"
  } else {
    // If the weather forecast is not suitable for charging, set schedule from 0:00 to 6:00 am
    peakWindowStart = "0:00 AM"; // 24-hr "00:00"
    peakWindowEnd = "6:00 AM";   // 24-hr "06:00"
  }

  return {
    score,
    verdict,
    isSuitableForCharging: isSuitableForCharging && verdict !== "POOR",
    isOffPeakSchedule: !isSuitableForCharging || verdict === "POOR",
    badgeColor,
    solarHours: Math.max(1, solarHours),
    estimatedSolarKwh,
    peakWindowStart,
    peakWindowEnd,
    cloudCoverageAvg: avgCloud,
    rainRisk: rainProb,
    easeeRecommendation,
    summary,
    hourlyProduction,
  };
}

/**
 * Predict tomorrow's solar PV generation and determine if it's optimal to charge an EV using Easee charger.
 */
export function calculateTomorrowEvSolarPrediction(weather: WeatherData): import("../types").EvSolarPrediction {
  return calculateSolarPredictionForDay(weather, 1);
}

/**
 * Predict today's solar PV generation and determine optimal charging window for today (used for 8:00 AM dispatch).
 */
export function calculateTodayEvSolarPrediction(weather: WeatherData): import("../types").EvSolarPrediction {
  return calculateSolarPredictionForDay(weather, 0);
}
