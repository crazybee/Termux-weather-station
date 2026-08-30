import { WeatherData, EvSolarPrediction } from "../src/types";
import { calculateSolarPredictionForDay } from "../src/utils/weatherHelpers";

/**
 * Server-side weather forecast fetcher for automated solar dispatching
 */
export async function fetchServerWeatherForecast(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,cloud_cover,surface_pressure,visibility,wind_speed_10m,wind_direction_10m,uv_index,direct_normal_irradiance,global_tilted_irradiance,shortwave_radiation&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,shortwave_radiation_sum&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm&timezone=auto&forecast_days=7`;
    
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Solar Optimizer] Open-Meteo fetch failed with status: ${res.status}`);
      return null;
    }
    const raw = await res.json();
    
    const formatted: WeatherData = {
      city: "Station Location",
      latitude: lat,
      longitude: lon,
      timezone: raw.timezone || "auto",
      timezoneAbbreviation: raw.timezone_abbreviation || "",
      utcOffsetSeconds: typeof raw.utc_offset_seconds === "number" ? raw.utc_offset_seconds : 0,
      elevation: raw.elevation || 0,
      units: {
        temperature: "°C",
        speed: "km/h",
        precipitation: "mm",
        pressure: "hPa",
      },
      current: {
        temperature: Math.round(raw.current?.temperature_2m ?? 20),
        apparentTemperature: Math.round(raw.current?.apparent_temperature ?? 20),
        humidity: Math.round(raw.current?.relative_humidity_2m ?? 50),
        pressure: Math.round(raw.current?.pressure_msl ?? 1013),
        surfacePressure: Math.round(raw.current?.surface_pressure ?? 1013),
        windSpeed: Math.round(raw.current?.wind_speed_10m ?? 0),
        windDirection: raw.current?.wind_direction_10m ?? 0,
        windGusts: Math.round(raw.current?.wind_gusts_10m ?? 0),
        precipitation: raw.current?.precipitation ?? 0,
        cloudCover: raw.current?.cloud_cover ?? 0,
        isDay: raw.current?.is_day === 1,
        weatherCode: raw.current?.weather_code ?? 0,
        condition: "Current",
        description: "Clear",
        icon: "Sun",
        uvIndex: raw.hourly?.uv_index?.[0] ?? 4,
      },
      daily: (raw.daily?.time || []).map((t: string, i: number) => ({
        date: t,
        weatherCode: raw.daily.weather_code[i] ?? 0,
        condition: "Forecast",
        description: "Daily Forecast",
        icon: "Sun",
        tempMax: Math.round(raw.daily.temperature_2m_max[i]),
        tempMin: Math.round(raw.daily.temperature_2m_min[i]),
        apparentTempMax: Math.round(raw.daily.apparent_temperature_max[i]),
        apparentTempMin: Math.round(raw.daily.apparent_temperature_min[i]),
        precipitationSum: raw.daily.precipitation_sum[i] ?? 0,
        precipitationProbabilityMax: raw.daily.precipitation_probability_max?.[i] ?? 0,
        uvIndexMax: raw.daily.uv_index_max?.[i] ?? 0,
        windSpeedMax: Math.round(raw.daily.wind_speed_10m_max?.[i] ?? 0),
        shortwaveRadiationSum: raw.daily.shortwave_radiation_sum?.[i] ?? 0,
        sunrise: raw.daily.sunrise?.[i],
        sunset: raw.daily.sunset?.[i],
      })),
      hourly: (raw.hourly?.time || []).slice(0, 72).map((t: string, i: number) => ({
        time: t,
        temperature: Math.round(raw.hourly.temperature_2m[i]),
        apparentTemperature: Math.round(raw.hourly.apparent_temperature?.[i] ?? raw.hourly.temperature_2m[i]),
        humidity: Math.round(raw.hourly.relative_humidity_2m?.[i] ?? 50),
        precipitationProbability: raw.hourly.precipitation_probability?.[i] ?? 0,
        precipitation: raw.hourly.precipitation?.[i] ?? 0,
        cloudCover: raw.hourly.cloud_cover?.[i] ?? 0,
        windSpeed: Math.round(raw.hourly.wind_speed_10m?.[i] ?? 0),
        windDirection: raw.hourly.wind_direction_10m?.[i] ?? 0,
        weatherCode: raw.hourly.weather_code?.[i] ?? 0,
        condition: "Hourly",
        icon: "Sun",
        uvIndex: raw.hourly.uv_index?.[i] ?? 0,
        directNormalIrradiance: raw.hourly.direct_normal_irradiance?.[i] ?? 0,
        globalTiltedIrradiance: raw.hourly.global_tilted_irradiance?.[i] ?? 0,
        shortwaveRadiation: raw.hourly.shortwave_radiation?.[i] ?? 0,
      })),
      meta: {
        isCacheHit: false,
        cacheAgeSeconds: 0,
        responseTimeMs: 0,
        cachedTtl: 30,
        serverHost: "Termux-Android (ARM64)",
      },
    };

    return formatted;
  } catch (err) {
    console.error("[Solar Optimizer] Error retrieving meteorological forecast:", err);
    return null;
  }
}

/**
 * Formats "10:30 AM" or "4:30 PM" into 24-hour "HH:MM" for Easee API
 */
export function convertAmPmTo24Hour(timeStr: string): string {
  if (!timeStr) return "10:30";
  const trimmed = timeStr.trim();
  const match = trimmed.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return timeStr;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = (match[3] || "").toUpperCase();

  if (ampm === "PM" && hours < 12) {
    hours += 12;
  } else if (ampm === "AM" && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}
