import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { LocationOption, UnitSystem, ConsolidatedUserConfig } from "../src/types";

const SQLITE_DB_PATH = path.join(process.cwd(), "user_data.sqlite");
const LEGACY_JSON_PATH = path.join(process.cwd(), ".station_config.json");

let dbInstance: DatabaseSync | null = null;

export function getSqliteDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(SQLITE_DB_PATH);
    initDatabaseSchema(dbInstance);
  }
  return dbInstance;
}

function initDatabaseSchema(db: DatabaseSync): void {
  // Create user_config table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      location_name TEXT NOT NULL DEFAULT 'New York',
      latitude REAL NOT NULL DEFAULT 40.7128,
      longitude REAL NOT NULL DEFAULT -74.0060,
      country TEXT NOT NULL DEFAULT 'United States',
      country_code TEXT DEFAULT '',
      admin1 TEXT DEFAULT '',
      timezone TEXT NOT NULL DEFAULT 'America/New_York',
      utc_offset_minutes INTEGER NOT NULL DEFAULT -240,
      preferred_unit TEXT NOT NULL DEFAULT 'metric',
      default_easee_phase_mode INTEGER NOT NULL DEFAULT 1,
      default_easee_max_current INTEGER NOT NULL DEFAULT 6,
      weather_provider TEXT NOT NULL DEFAULT 'openweathermap',
      openweather_api_key TEXT DEFAULT '',
      weather_refresh_interval INTEGER NOT NULL DEFAULT 30,
      daily_dispatch_time TEXT NOT NULL DEFAULT '08:00',
      daily_dispatch_enabled INTEGER NOT NULL DEFAULT 1,
      auto_sync_solar INTEGER NOT NULL DEFAULT 1,
      is_daily_8am_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Run non-destructive column migrations for existing databases
  try {
    db.exec("ALTER TABLE user_config ADD COLUMN weather_refresh_interval INTEGER NOT NULL DEFAULT 30;");
  } catch {}
  try {
    db.exec("ALTER TABLE user_config ADD COLUMN daily_dispatch_time TEXT NOT NULL DEFAULT '08:00';");
  } catch {}
  try {
    db.exec("ALTER TABLE user_config ADD COLUMN daily_dispatch_enabled INTEGER NOT NULL DEFAULT 1;");
  } catch {}
  try {
    db.exec("ALTER TABLE user_config ADD COLUMN theme TEXT NOT NULL DEFAULT 'system';");
  } catch {}

  // Ensure singleton row exists
  const existing = db.prepare("SELECT id FROM user_config WHERE id = 1").get();
  if (!existing) {
    // Check if legacy .station_config.json exists to migrate previous settings
    let initialLocation = {
      name: "New York",
      latitude: 40.7128,
      longitude: -74.006,
      country: "United States",
    };
    let initialUnit = "metric";
    let initialTz = "America/New_York";
    let initialOffset = -240;
    let initialProvider = "openweathermap";
    let initialApiKey = "";
    let initialRefresh = 30;
    let initialDispatchTime = "08:00";
    let initialDispatchEnabled = 1;

    try {
      if (fs.existsSync(LEGACY_JSON_PATH)) {
        const raw = fs.readFileSync(LEGACY_JSON_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.location?.name) {
          initialLocation = parsed.location;
          initialUnit = parsed.units === "imperial" ? "imperial" : "metric";
          initialTz = parsed.timezone || initialTz;
          initialOffset = typeof parsed.utcOffsetMinutes === "number" ? parsed.utcOffsetMinutes : initialOffset;
          initialProvider = parsed.weatherProvider === "open-meteo" ? "open-meteo" : "openweathermap";
          initialApiKey = parsed.openWeatherApiKey || "";
          initialRefresh = typeof parsed.weatherRefreshInterval === "number" ? parsed.weatherRefreshInterval : 30;
          initialDispatchTime = typeof parsed.dailyDispatchTime === "string" ? parsed.dailyDispatchTime : "08:00";
          initialDispatchEnabled = parsed.dailyDispatchEnabled === false ? 0 : 1;
          console.log(`[SQLite DB] Migrated existing settings from .station_config.json into SQLite: ${initialLocation.name}`);
        }
      }
    } catch (err) {
      console.warn("[SQLite DB] Failed to parse legacy JSON, using defaults:", err);
    }

    const insertStmt = db.prepare(`
      INSERT INTO user_config (
        id, location_name, latitude, longitude, country,
        timezone, utc_offset_minutes, preferred_unit,
        default_easee_phase_mode, default_easee_max_current,
        weather_provider, openweather_api_key,
        weather_refresh_interval, daily_dispatch_time, daily_dispatch_enabled,
        auto_sync_solar, is_daily_8am_enabled,
        created_at, updated_at
      ) VALUES (
        1, ?, ?, ?, ?,
        ?, ?, ?,
        1, 6,
        ?, ?,
        ?, ?, ?,
        1, 1,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    insertStmt.run(
      initialLocation.name,
      initialLocation.latitude,
      initialLocation.longitude,
      initialLocation.country || "",
      initialTz,
      initialOffset,
      initialUnit,
      initialProvider,
      initialApiKey,
      initialRefresh,
      initialDispatchTime,
      initialDispatchEnabled
    );
    console.log("[SQLite DB] Initialized user_config table with default row in user_data.sqlite");
  }
}

export function getConsolidatedUserConfig(): ConsolidatedUserConfig {
  const db = getSqliteDb();
  const row = db.prepare("SELECT * FROM user_config WHERE id = 1").get() as any;

  if (!row) {
    return {
      location: {
        name: "New York",
        latitude: 40.7128,
        longitude: -74.006,
        country: "United States",
      },
      units: "metric",
      timezone: "America/New_York",
      utcOffsetMinutes: -240,
      defaultEaseePhaseMode: 1,
      defaultEaseeMaxCurrent: 6,
      weatherProvider: "openweathermap",
      openWeatherApiKey: "",
      weatherRefreshInterval: 30,
      dailyDispatchTime: "08:00",
      dailyDispatchEnabled: true,
      autoSyncSolar: true,
      isDaily8AmEnabled: true,
      lastUpdated: new Date().toISOString(),
      databaseEngine: "SQLite 3 (Native Sync Engine)",
    };
  }

  const dispatchEnabled = typeof row.daily_dispatch_enabled === "number" ? row.daily_dispatch_enabled === 1 : (row.is_daily_8am_enabled !== 0);

  return {
    location: {
      name: row.location_name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      country: row.country || "",
      countryCode: row.country_code || undefined,
      admin1: row.admin1 || undefined,
    },
    units: row.preferred_unit === "imperial" ? "imperial" : "metric",
    timezone: row.timezone || "auto",
    utcOffsetMinutes: typeof row.utc_offset_minutes === "number" ? row.utc_offset_minutes : 0,
    theme: (row.theme === "dark" || row.theme === "light" || row.theme === "system") ? row.theme : "system",
    defaultEaseePhaseMode: (row.default_easee_phase_mode === 3 ? 3 : 1) as 1 | 3,
    defaultEaseeMaxCurrent: typeof row.default_easee_max_current === "number" ? Math.max(6, Math.min(32, row.default_easee_max_current)) : 6,
    weatherProvider: row.weather_provider === "open-meteo" ? "open-meteo" : "openweathermap",
    openWeatherApiKey: row.openweather_api_key || undefined,
    weatherRefreshInterval: typeof row.weather_refresh_interval === "number" ? Math.max(5, Math.min(3600, row.weather_refresh_interval)) : 30,
    dailyDispatchTime: (row.daily_dispatch_time && /^([01]\d|2[0-3]):[0-5]\d$/.test(row.daily_dispatch_time)) ? row.daily_dispatch_time : "08:00",
    dailyDispatchEnabled: dispatchEnabled,
    autoSyncSolar: row.auto_sync_solar === 1,
    isDaily8AmEnabled: dispatchEnabled,
    lastUpdated: row.updated_at || new Date().toISOString(),
    databaseEngine: "SQLite 3 (Native Sync Engine)",
  };
}

export function updateConsolidatedUserConfig(partial: Partial<ConsolidatedUserConfig>): ConsolidatedUserConfig {
  const db = getSqliteDb();
  const current = getConsolidatedUserConfig();

  const nextLocation: LocationOption = {
    name: partial.location?.name ?? current.location.name,
    latitude: typeof partial.location?.latitude === "number" ? partial.location.latitude : current.location.latitude,
    longitude: typeof partial.location?.longitude === "number" ? partial.location.longitude : current.location.longitude,
    country: partial.location?.country ?? current.location.country,
    countryCode: partial.location?.countryCode ?? current.location.countryCode,
    admin1: partial.location?.admin1 ?? current.location.admin1,
  };

  const nextUnit: UnitSystem = partial.units === "imperial" ? "imperial" : (partial.units === "metric" ? "metric" : current.units);
  const nextTimezone = partial.timezone ?? current.timezone;
  const nextUtcOffset = typeof partial.utcOffsetMinutes === "number" ? partial.utcOffsetMinutes : current.utcOffsetMinutes;
  const nextTheme = (partial.theme === "dark" || partial.theme === "light" || partial.theme === "system") ? partial.theme : (current.theme || "system");
  
  const nextPhaseMode: 1 | 3 = partial.defaultEaseePhaseMode === 3 ? 3 : (partial.defaultEaseePhaseMode === 1 ? 1 : current.defaultEaseePhaseMode);
  const nextMaxCurrent = typeof partial.defaultEaseeMaxCurrent === "number" 
    ? Math.max(6, Math.min(32, partial.defaultEaseeMaxCurrent)) 
    : current.defaultEaseeMaxCurrent;

  const nextWeatherProvider = partial.weatherProvider ?? current.weatherProvider;
  const nextApiKey = typeof partial.openWeatherApiKey === "string" ? partial.openWeatherApiKey.trim() : (current.openWeatherApiKey || "");
  
  const nextRefreshInterval = typeof partial.weatherRefreshInterval === "number"
    ? Math.max(5, Math.min(3600, Math.round(partial.weatherRefreshInterval)))
    : (current.weatherRefreshInterval || 30);

  let nextDispatchTime = current.dailyDispatchTime || "08:00";
  if (typeof partial.dailyDispatchTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(partial.dailyDispatchTime.trim())) {
    nextDispatchTime = partial.dailyDispatchTime.trim();
  }

  const isDispatchExplicit = typeof partial.dailyDispatchEnabled === "boolean" 
    ? partial.dailyDispatchEnabled 
    : (typeof partial.isDaily8AmEnabled === "boolean" ? partial.isDaily8AmEnabled : current.dailyDispatchEnabled);
  const nextDispatchEnabledInt = isDispatchExplicit ? 1 : 0;

  const nextAutoSync = typeof partial.autoSyncSolar === "boolean" ? (partial.autoSyncSolar ? 1 : 0) : (current.autoSyncSolar ? 1 : 0);

  const updateStmt = db.prepare(`
    UPDATE user_config
    SET
      location_name = ?,
      latitude = ?,
      longitude = ?,
      country = ?,
      country_code = ?,
      admin1 = ?,
      timezone = ?,
      utc_offset_minutes = ?,
      preferred_unit = ?,
      theme = ?,
      default_easee_phase_mode = ?,
      default_easee_max_current = ?,
      weather_provider = ?,
      openweather_api_key = ?,
      weather_refresh_interval = ?,
      daily_dispatch_time = ?,
      daily_dispatch_enabled = ?,
      auto_sync_solar = ?,
      is_daily_8am_enabled = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);

  updateStmt.run(
    nextLocation.name,
    nextLocation.latitude,
    nextLocation.longitude,
    nextLocation.country || "",
    nextLocation.countryCode || "",
    nextLocation.admin1 || "",
    nextTimezone,
    nextUtcOffset,
    nextUnit,
    nextTheme,
    nextPhaseMode,
    nextMaxCurrent,
    nextWeatherProvider,
    nextApiKey,
    nextRefreshInterval,
    nextDispatchTime,
    nextDispatchEnabledInt,
    nextAutoSync,
    nextDispatchEnabledInt
  );

  console.log(`[SQLite DB] Consolidated update: loc=${nextLocation.name}, unit=${nextUnit}, tz=${nextTimezone}, refresh=${nextRefreshInterval}s, dispatchTime=${nextDispatchTime}, dispatchEnabled=${isDispatchExplicit}, phase=${nextPhaseMode}P, maxCurrent=${nextMaxCurrent}A`);

  // Mirror to legacy file for external compatibility if needed
  try {
    const legacyPayload = {
      location: nextLocation,
      units: nextUnit,
      timezone: nextTimezone,
      utcOffsetMinutes: nextUtcOffset,
      defaultEaseePhaseMode: nextPhaseMode,
      defaultEaseeMaxCurrent: nextMaxCurrent,
      weatherProvider: nextWeatherProvider,
      openWeatherApiKey: nextApiKey,
      weatherRefreshInterval: nextRefreshInterval,
      dailyDispatchTime: nextDispatchTime,
      dailyDispatchEnabled: isDispatchExplicit,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(LEGACY_JSON_PATH, JSON.stringify(legacyPayload, null, 2), "utf-8");
  } catch {}

  return getConsolidatedUserConfig();
}

export function getSqliteDbStats(): {
  dbPath: string;
  exists: boolean;
  sizeBytes: number;
  tables: string[];
  userConfigRowCount: number;
  engine: string;
} {
  try {
    const db = getSqliteDb();
    const stat = fs.existsSync(SQLITE_DB_PATH) ? fs.statSync(SQLITE_DB_PATH) : null;
    const tableRows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    const countRow = db.prepare("SELECT COUNT(*) as count FROM user_config").get() as any;

    return {
      dbPath: SQLITE_DB_PATH,
      exists: true,
      sizeBytes: stat ? stat.size : 0,
      tables: tableRows.map((r) => r.name),
      userConfigRowCount: countRow?.count || 1,
      engine: "SQLite 3 (Node.js Native DatabaseSync)",
    };
  } catch (err: any) {
    return {
      dbPath: SQLITE_DB_PATH,
      exists: false,
      sizeBytes: 0,
      tables: [],
      userConfigRowCount: 0,
      engine: `SQLite Error: ${err?.message || "Unknown"}`,
    };
  }
}
