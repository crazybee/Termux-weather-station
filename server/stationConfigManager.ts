import { ConsolidatedUserConfig, StationConfig } from "../src/types";
import {
  getConsolidatedUserConfig,
  updateConsolidatedUserConfig,
  getSqliteDbStats,
} from "./sqliteDb";

// Re-export StationConfig type for server modules
export type { ConsolidatedUserConfig, StationConfig };

// Helper to resolve active OpenWeatherMap API key (env variable or SQLite saved)
export function getEffectiveOpenWeatherApiKey(): string {
  const envKey = (
    process.env.OPENWEATHER_API_KEY ||
    process.env.OPENWEATHERMAP_API_KEY ||
    process.env.OPEN_WEATHER_API_KEY ||
    ""
  ).trim();

  if (envKey) return envKey;
  const cfg = getConsolidatedUserConfig();
  return (cfg.openWeatherApiKey || "").trim();
}

// Load persisted configuration from SQLite on server boot
export function loadStationConfig(): StationConfig {
  return getConsolidatedUserConfig();
}

// Update and persist configuration to SQLite
export function updateStationConfig(partial: Partial<StationConfig>): StationConfig {
  return updateConsolidatedUserConfig(partial);
}

// Read current station config from SQLite
export function getStationConfig(): StationConfig {
  return getConsolidatedUserConfig();
}

export { getSqliteDbStats };
