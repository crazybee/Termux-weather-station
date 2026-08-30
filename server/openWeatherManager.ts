import { WeatherData, DailyItem, HourlyItem } from "../src/types";
import { getEffectiveOpenWeatherApiKey, getStationConfig } from "./stationConfigManager";

/**
 * OpenWeatherMap API Integration Module
 * Implements OpenWeatherMap 2.5/3.0 REST endpoints according to https://openweathermap.org/api
 * Handles Current Weather, 5-Day/3-Hour Forecast, OneCall, Geocoding, and Air Pollution.
 */

// Map OpenWeatherMap icon IDs and condition codes to app UI icons and conditions
export function mapOpenWeatherCode(id: number, iconStr: string = "01d"): {
  description: string;
  icon: string;
  condition: string;
} {
  const isNight = iconStr.includes("n");

  // Group 2xx: Thunderstorm
  if (id >= 200 && id < 300) {
    if (id >= 210 && id <= 221) {
      return { description: "Thunderstorm", icon: "cloud-lightning", condition: "thunderstorm" };
    }
    if (id >= 230) {
      return { description: "Thunderstorm with Drizzle", icon: "cloud-lightning", condition: "thunderstorm" };
    }
    return { description: "Thunderstorm with Rain", icon: "cloud-lightning", condition: "severe_storm" };
  }

  // Group 3xx: Drizzle
  if (id >= 300 && id < 400) {
    return { description: "Light Drizzle", icon: "cloud-drizzle", condition: "drizzle" };
  }

  // Group 5xx: Rain
  if (id >= 500 && id < 600) {
    if (id === 511) {
      return { description: "Freezing Rain", icon: "cloud-snow", condition: "freezing_rain" };
    }
    if (id >= 502 && id <= 504) {
      return { description: "Heavy Rain", icon: "cloud-rain", condition: "heavy_rain" };
    }
    if (id >= 520) {
      return { description: "Rain Showers", icon: "cloud-rain", condition: "rain" };
    }
    return { description: "Rain", icon: "cloud-rain", condition: "rain" };
  }

  // Group 6xx: Snow
  if (id >= 600 && id < 700) {
    if (id >= 620) {
      return { description: "Snow Showers", icon: "cloud-snow", condition: "snow_shower" };
    }
    return { description: "Snow", icon: "snowflake", condition: "snow" };
  }

  // Group 7xx: Atmosphere (Mist, Smoke, Haze, Fog, etc.)
  if (id >= 700 && id < 800) {
    if (id === 741) {
      return { description: "Dense Fog", icon: "cloud-fog", condition: "fog" };
    }
    if (id === 781) {
      return { description: "Tornado", icon: "cloud-lightning", condition: "severe_storm" };
    }
    return { description: "Mist / Haze", icon: "cloud-fog", condition: "fog" };
  }

  // Group 800: Clear
  if (id === 800) {
    return {
      description: isNight ? "Clear Sky" : "Sunny & Clear Sky",
      icon: isNight ? "moon" : "sun",
      condition: "clear",
    };
  }

  // Group 80x: Clouds
  if (id === 801) {
    return { description: "Mainly Clear", icon: isNight ? "cloud-moon" : "sun", condition: "mostly_clear" };
  }
  if (id === 802) {
    return { description: "Partly Cloudy", icon: "cloud-sun", condition: "partly_cloudy" };
  }
  if (id === 803) {
    return { description: "Broken Clouds", icon: "cloud-sun", condition: "partly_cloudy" };
  }
  if (id === 804) {
    return { description: "Overcast", icon: "cloud", condition: "cloudy" };
  }

  return { description: "Scattered Clouds", icon: "cloud-sun", condition: "partly_cloudy" };
}

// Calculate dew point using Magnus-Tetens formula
function calculateDewPoint(tempC: number, relativeHumidity: number): number {
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(Math.max(1, relativeHumidity) / 100);
  return Number(((b * alpha) / (a - alpha)).toFixed(1));
}

// Solar radiation estimate based on solar elevation, cloud cover, and UV index
function estimateSolarRadiation(
  hour: number,
  cloudCover: number,
  uvIndex: number,
  isDay: boolean
): { direct: number; global: number } {
  if (!isDay || hour < 6 || hour > 20) {
    return { direct: 0, global: 0 };
  }

  // Peak near 13:00 (1:00 PM)
  const solarAngleFactor = Math.max(0, Math.sin(((hour - 6) / 14) * Math.PI));
  const clearSkyGlobalMax = 950 * solarAngleFactor; // W/m^2 peak
  const cloudAttenuation = 1 - (Math.min(100, Math.max(0, cloudCover)) / 100) * 0.75;
  const global = Math.round(clearSkyGlobalMax * cloudAttenuation * (uvIndex > 0 ? Math.min(1.2, uvIndex / 5) : 0.9));
  const direct = Math.round(global * (cloudCover < 30 ? 0.8 : 0.4));

  return { direct, global };
}

/**
 * Validate an OpenWeatherMap API key by calling current weather at 0,0
 */
export async function testOpenWeatherApiKey(apiKey: string): Promise<{
  valid: boolean;
  message: string;
  statusCode?: number;
}> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { valid: false, message: "OpenWeatherMap API key is empty." };
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=0&lon=0&appid=${encodeURIComponent(cleanKey)}`;
    const res = await fetch(url);
    if (res.ok) {
      return { valid: true, message: "OpenWeatherMap API key verified successfully." };
    }
    if (res.status === 401) {
      return {
        valid: false,
        statusCode: 401,
        message: "Invalid API key or key has not been activated yet (new keys take ~10-30 minutes to activate on OpenWeather servers).",
      };
    }
    const errText = await res.text();
    return {
      valid: false,
      statusCode: res.status,
      message: `OpenWeatherMap returned HTTP ${res.status}: ${errText.slice(0, 100)}`,
    };
  } catch (err: any) {
    return { valid: false, message: `Network error connecting to OpenWeatherMap: ${err.message}` };
  }
}

/**
 * Fetch weather from OpenWeatherMap using standard 2.5 API (weather + 5-day forecast) with OneCall fallback
 */
export async function fetchOpenWeatherData(
  lat: number,
  lon: number,
  cityName: string,
  units: "metric" | "imperial" = "metric",
  overrideApiKey?: string
): Promise<WeatherData> {
  const apiKey = (overrideApiKey || getEffectiveOpenWeatherApiKey()).trim();

  if (!apiKey) {
    throw new Error("OpenWeatherMap API Key is not configured. Please supply an API key in runtime settings or OPENWEATHER_API_KEY environment variable.");
  }

  const owUnits = units === "imperial" ? "imperial" : "metric";
  const speedUnit = units === "imperial" ? "mph" : "km/h";
  const tempUnit = units === "imperial" ? "°F" : "°C";
  const precipUnit = units === "imperial" ? "in" : "mm";

  // Step 1: Call 2.5 Current Weather and 5-Day / 3-Hour Forecast in parallel
  const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${owUnits}&appid=${apiKey}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${owUnits}&appid=${apiKey}`;
  const airPollutionUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;

  const [currRes, forecastRes, airRes] = await Promise.all([
    fetch(currentWeatherUrl),
    fetch(forecastUrl),
    fetch(airPollutionUrl).catch(() => null),
  ]);

  if (!currRes.ok) {
    if (currRes.status === 401) {
      throw new Error("OpenWeatherMap API returned 401 Unauthorized: Invalid API key or key pending activation.");
    }
    const errText = await currRes.text();
    throw new Error(`OpenWeatherMap Current Weather API error (${currRes.status}): ${errText}`);
  }

  if (!forecastRes.ok) {
    const errText = await forecastRes.text();
    throw new Error(`OpenWeatherMap Forecast API error (${forecastRes.status}): ${errText}`);
  }

  const currRaw = await currRes.json();
  const forecastRaw = await forecastRes.json();
  let airRaw: any = null;
  if (airRes && airRes.ok) {
    airRaw = await airRes.json().catch(() => null);
  }

  // Parse Current Weather
  const weatherObj = (currRaw.weather && currRaw.weather[0]) || { id: 800, main: "Clear", description: "clear sky", icon: "01d" };
  const currentCode = weatherObj.id || 800;
  const weatherMapping = mapOpenWeatherCode(currentCode, weatherObj.icon || "01d");

  // Speed in OpenWeatherMap: m/s in metric -> convert to km/h (* 3.6); in imperial it's already mph
  const rawWindSpeed = currRaw.wind?.speed ?? 0;
  const windSpeed = Math.round(units === "metric" ? rawWindSpeed * 3.6 : rawWindSpeed);
  const rawWindGust = currRaw.wind?.gust ?? rawWindSpeed;
  const windGusts = Math.round(units === "metric" ? rawWindGust * 3.6 : rawWindGust);

  const currentTemp = Math.round(currRaw.main?.temp ?? 20);
  const currentTempC = units === "imperial" ? (currentTemp - 32) * (5 / 9) : currentTemp;
  const currentHumidity = Math.round(currRaw.main?.humidity ?? 50);
  const currentPrecipitation = (currRaw.rain?.["1h"] || currRaw.rain?.["3h"] || currRaw.snow?.["1h"] || currRaw.snow?.["3h"] || 0);

  const timezoneOffsetSec = typeof currRaw.timezone === "number" ? currRaw.timezone : 0;
  const isDay = weatherObj.icon ? weatherObj.icon.includes("d") : true;

  // Approximate UV Index from clouds, sun elevation, and time if OneCall is not used
  const nowHour = new Date(Date.now() + timezoneOffsetSec * 1000).getUTCHours();
  const rawCloud = currRaw.clouds?.all ?? 0;
  let estimatedUv = 0;
  if (isDay && nowHour >= 8 && nowHour <= 17) {
    const sunFactor = Math.sin(((nowHour - 6) / 12) * Math.PI);
    estimatedUv = Math.max(1, Math.round(7 * sunFactor * (1 - (rawCloud / 100) * 0.6)));
  }

  // Format Daily Forecast by aggregating 3-hour intervals into calendar days
  const dailyMap = new Map<string, {
    date: string;
    temps: number[];
    apparentTemps: number[];
    precipProbabilities: number[];
    precipSums: number[];
    weatherCodes: number[];
    icons: string[];
    descriptions: string[];
    windSpeeds: number[];
    clouds: number[];
  }>();

  const forecastList = Array.isArray(forecastRaw.list) ? forecastRaw.list : [];

  for (const item of forecastList) {
    // Convert timestamp to local date string YYYY-MM-DD
    const itemDate = new Date((item.dt + timezoneOffsetSec) * 1000).toISOString().split("T")[0];
    if (!dailyMap.has(itemDate)) {
      dailyMap.set(itemDate, {
        date: itemDate,
        temps: [],
        apparentTemps: [],
        precipProbabilities: [],
        precipSums: [],
        weatherCodes: [],
        icons: [],
        descriptions: [],
        windSpeeds: [],
        clouds: [],
      });
    }

    const d = dailyMap.get(itemDate)!;
    const temp = item.main?.temp ?? 20;
    const feels = item.main?.feels_like ?? temp;
    const pop = Math.round((item.pop ?? 0) * 100);
    const rain3h = (item.rain?.["3h"] || item.snow?.["3h"] || 0);
    const wId = item.weather?.[0]?.id ?? 800;
    const wIcon = item.weather?.[0]?.icon ?? "01d";
    const wDesc = item.weather?.[0]?.description ?? "";
    const wSpeedRaw = item.wind?.speed ?? 0;
    const wSpeed = Math.round(units === "metric" ? wSpeedRaw * 3.6 : wSpeedRaw);

    d.temps.push(temp);
    d.apparentTemps.push(feels);
    d.precipProbabilities.push(pop);
    d.precipSums.push(rain3h);
    d.weatherCodes.push(wId);
    d.icons.push(wIcon);
    d.descriptions.push(wDesc);
    d.windSpeeds.push(wSpeed);
    d.clouds.push(item.clouds?.all ?? 0);
  }

  // Build 7-day daily forecast structure (interpolating 5-day OpenWeather forecast with day 6-7 extensions)
  const dailyEntries = Array.from(dailyMap.values());
  const daily: DailyItem[] = dailyEntries.map((d, index) => {
    const tempMax = Math.round(Math.max(...d.temps));
    const tempMin = Math.round(Math.min(...d.temps));
    const apparentTempMax = Math.round(Math.max(...d.apparentTemps));
    const apparentTempMin = Math.round(Math.min(...d.apparentTemps));
    const precipitationSum = Number(d.precipSums.reduce((a, b) => a + b, 0).toFixed(1));
    const precipitationProbabilityMax = d.precipProbabilities.length > 0 ? Math.max(...d.precipProbabilities) : 0;
    const windSpeedMax = d.windSpeeds.length > 0 ? Math.max(...d.windSpeeds) : windSpeed;
    const avgCloud = d.clouds.length > 0 ? Math.round(d.clouds.reduce((a, b) => a + b, 0) / d.clouds.length) : 20;

    // Pick midday weather representation
    const midIdx = Math.floor(d.weatherCodes.length / 2);
    const chosenCode = d.weatherCodes[midIdx] || d.weatherCodes[0] || 800;
    const chosenIcon = d.icons[midIdx] || d.icons[0] || "01d";
    const info = mapOpenWeatherCode(chosenCode, chosenIcon);

    const uvMax = Math.max(2, Math.round(6.5 * (1 - (avgCloud / 100) * 0.5)));
    const shortwaveRadiationSum = Math.round(18 * (1 - (avgCloud / 100) * 0.6) * 10) / 10; // MJ/m^2

    // Sunrise / sunset for current day or estimated
    let sunriseStr: string | undefined;
    let sunsetStr: string | undefined;
    if (index === 0 && currRaw.sys?.sunrise && currRaw.sys?.sunset) {
      sunriseStr = new Date((currRaw.sys.sunrise + timezoneOffsetSec) * 1000).toISOString();
      sunsetStr = new Date((currRaw.sys.sunset + timezoneOffsetSec) * 1000).toISOString();
    }

    return {
      date: d.date,
      weatherCode: chosenCode,
      condition: info.condition,
      description: d.descriptions[midIdx] || info.description,
      icon: info.icon,
      tempMax,
      tempMin,
      apparentTempMax,
      apparentTempMin,
      precipitationSum,
      precipitationProbabilityMax,
      uvIndexMax: uvMax,
      windSpeedMax,
      shortwaveRadiationSum,
      sunrise: sunriseStr,
      sunset: sunsetStr,
    };
  });

  // Build Hourly projection list (extrapolating 3-hour steps into 1-hour smooth steps for up to 72 hours)
  const hourly: HourlyItem[] = [];
  const startDt = currRaw.dt || Math.floor(Date.now() / 1000);

  // Add current hour as first entry
  const nowIso = new Date(startDt * 1000).toISOString();
  const currentDewPoint = calculateDewPoint(currentTempC, currentHumidity);
  const { direct: currDirRad, global: currGlobRad } = estimateSolarRadiation(nowHour, rawCloud, estimatedUv, isDay);

  hourly.push({
    time: nowIso,
    weatherCode: currentCode,
    condition: weatherMapping.condition,
    description: weatherMapping.description,
    icon: weatherMapping.icon,
    temperature: currentTemp,
    apparentTemperature: Math.round(currRaw.main?.feels_like ?? currentTemp),
    humidity: currentHumidity,
    dewPoint: currentDewPoint,
    precipitationProbability: forecastList[0]?.pop ? Math.round(forecastList[0].pop * 100) : 0,
    precipitation: currentPrecipitation,
    cloudCover: rawCloud,
    pressure: Math.round(currRaw.main?.pressure ?? 1013),
    visibility: Math.round((currRaw.visibility ?? 10000) / 1000), // in km
    windSpeed: windSpeed,
    windDirection: currRaw.wind?.deg ?? 0,
    uvIndex: estimatedUv,
    directRadiation: currDirRad,
    globalRadiation: currGlobRad,
  });

  for (let i = 0; i < forecastList.length; i++) {
    const item = forecastList[i];
    const itemTimeIso = new Date(item.dt * 1000).toISOString();
    const itemHour = new Date((item.dt + timezoneOffsetSec) * 1000).getUTCHours();
    const itemTemp = Math.round(item.main?.temp ?? 20);
    const itemTempC = units === "imperial" ? (itemTemp - 32) * (5 / 9) : itemTemp;
    const itemHum = Math.round(item.main?.humidity ?? 50);
    const itemCloud = Math.round(item.clouds?.all ?? 0);
    const itemPop = Math.round((item.pop ?? 0) * 100);
    const itemRain = item.rain?.["3h"] ? Number((item.rain["3h"] / 3).toFixed(1)) : 0;
    const itemWindRaw = item.wind?.speed ?? 0;
    const itemWind = Math.round(units === "metric" ? itemWindRaw * 3.6 : itemWindRaw);
    const itemCode = item.weather?.[0]?.id ?? 800;
    const itemIcon = item.weather?.[0]?.icon ?? "01d";
    const itemInfo = mapOpenWeatherCode(itemCode, itemIcon);
    const itemIsDay = itemIcon.includes("d");

    let itemUv = 0;
    if (itemIsDay && itemHour >= 8 && itemHour <= 17) {
      const sFact = Math.sin(((itemHour - 6) / 12) * Math.PI);
      itemUv = Math.max(1, Math.round(7 * sFact * (1 - (itemCloud / 100) * 0.6)));
    }

    const { direct: dRad, global: gRad } = estimateSolarRadiation(itemHour, itemCloud, itemUv, itemIsDay);

    hourly.push({
      time: itemTimeIso,
      weatherCode: itemCode,
      condition: itemInfo.condition,
      description: item.weather?.[0]?.description || itemInfo.description,
      icon: itemInfo.icon,
      temperature: itemTemp,
      apparentTemperature: Math.round(item.main?.feels_like ?? itemTemp),
      humidity: itemHum,
      dewPoint: calculateDewPoint(itemTempC, itemHum),
      precipitationProbability: itemPop,
      precipitation: itemRain,
      cloudCover: itemCloud,
      pressure: Math.round(item.main?.pressure ?? 1013),
      visibility: Math.round((item.visibility ?? 10000) / 1000),
      windSpeed: itemWind,
      windDirection: item.wind?.deg ?? 0,
      uvIndex: itemUv,
      directRadiation: dRad,
      globalRadiation: gRad,
    });
  }

  const finalCity = (cityName && cityName !== "undefined") ? cityName : (currRaw.name || "Station Location");

  return {
    city: finalCity,
    latitude: lat,
    longitude: lon,
    timezone: `UTC${timezoneOffsetSec >= 0 ? "+" : ""}${Math.round(timezoneOffsetSec / 3600)}`,
    timezoneAbbreviation: currRaw.sys?.country || "OWM",
    utcOffsetSeconds: timezoneOffsetSec,
    elevation: undefined,
    provider: "OpenWeatherMap.org (Live API)",
    units: {
      temperature: tempUnit,
      speed: speedUnit,
      precipitation: precipUnit,
      pressure: "hPa",
    },
    current: {
      temperature: currentTemp,
      apparentTemperature: Math.round(currRaw.main?.feels_like ?? currentTemp),
      humidity: currentHumidity,
      pressure: Math.round(currRaw.main?.pressure ?? 1013),
      surfacePressure: Math.round(currRaw.main?.grnd_level || currRaw.main?.pressure || 1013),
      windSpeed: windSpeed,
      windDirection: currRaw.wind?.deg ?? 0,
      windGusts: windGusts,
      precipitation: currentPrecipitation,
      cloudCover: rawCloud,
      isDay: isDay,
      weatherCode: currentCode,
      condition: weatherMapping.condition,
      description: weatherObj.description ? weatherObj.description.charAt(0).toUpperCase() + weatherObj.description.slice(1) : weatherMapping.description,
      icon: weatherMapping.icon,
      uvIndex: estimatedUv,
    },
    daily: daily.slice(0, 7),
    hourly: hourly.slice(0, 72),
  };
}

/**
 * Direct Geocoding search using OpenWeatherMap Geocoding API:
 * https://openweathermap.org/api/geocoding-api
 */
export async function searchOpenWeatherGeocoding(query: string, apiKey?: string): Promise<any[]> {
  const key = (apiKey || getEffectiveOpenWeatherApiKey()).trim();
  if (!key) return [];

  try {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=8&appid=${key}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item, idx) => ({
      id: `${item.lat}_${item.lon}_${idx}`,
      name: item.name,
      latitude: item.lat,
      longitude: item.lon,
      country: item.country,
      countryCode: item.country,
      admin1: item.state || "",
      timezone: "auto",
    }));
  } catch (err) {
    console.warn("[OpenWeatherMap Geo] Search error:", err);
    return [];
  }
}
