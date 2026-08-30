import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { HeroWeatherCard } from "./components/HeroWeatherCard";
import { WeatherMap } from "./components/WeatherMap";
import { HourlyForecastChart } from "./components/HourlyForecastChart";
import { HistoricalTrends } from "./components/HistoricalTrends";
import { DailyForecastList } from "./components/DailyForecastList";
import { AlertsManager } from "./components/AlertsManager";
import { EvSolarChargingCard } from "./components/EvSolarChargingCard";
import { TopSolarEvBanner } from "./components/TopSolarEvBanner";
import { TermuxServerModal } from "./components/TermuxServerModal";
import { EaseeConnectModal } from "./components/EaseeConnectModal";
import { BmwConnectModal } from "./components/BmwConnectModal";
import { ZeroTrustSecurityModal } from "./components/ZeroTrustSecurityModal";
import { OpenWeatherConfigModal } from "./components/OpenWeatherConfigModal";
import { CacheStatsBanner } from "./components/CacheStatsBanner";
import {
  WeatherData,
  LocationOption,
  UnitSystem,
  ServerInfo,
  CustomAlertRule,
  ActiveAlert,
  EaseeAccountStatus,
  ZeroTrustAuthStatus,
  EvBatterySocConfig,
  ConsolidatedUserConfig,
} from "./types";
import { evaluateWeatherAlerts, calculateTomorrowEvSolarPrediction, POPULAR_LOCATIONS } from "./utils/weatherHelpers";
import { encryptCredentialsForLocalTransmission } from "./utils/cryptoClient";
import { ThemeMode, getStoredTheme, applyTheme, resolveIsDark } from "./utils/theme";
import { RefreshCw, AlertCircle } from "lucide-react";

const DEFAULT_ALERT_RULES: CustomAlertRule[] = [
  {
    id: "rule_heat",
    metric: "temperature",
    condition: ">",
    value: 35,
    enabled: true,
    label: "Extreme Heat Warning (> 35°C)",
    severity: "danger",
  },
  {
    id: "rule_frost",
    metric: "temperature",
    condition: "<",
    value: 2,
    enabled: true,
    label: "Frost / Freezing Alert (< 2°C)",
    severity: "warning",
  },
  {
    id: "rule_wind",
    metric: "windSpeed",
    condition: ">",
    value: 40,
    enabled: true,
    label: "Gale Wind Advisory (> 40 km/h)",
    severity: "warning",
  },
  {
    id: "rule_rain",
    metric: "precipitationProbability",
    condition: ">",
    value: 70,
    enabled: true,
    label: "High Rain Likelihood (> 70%)",
    severity: "info",
  },
];

const DEFAULT_LOCATION: LocationOption = {
  name: "New York",
  latitude: 40.7128,
  longitude: -74.0060,
  country: "United States",
};

export default function App() {
  const [selectedLocation, setSelectedLocation] = useState<LocationOption>(() => {
    try {
      const saved = localStorage.getItem("termux_wx_selected_location");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.latitude === "number" && typeof parsed.longitude === "number" && parsed.name) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to load saved location from localStorage:", e);
    }
    return DEFAULT_LOCATION;
  });

  const [units, setUnits] = useState<UnitSystem>(() => {
    try {
      const saved = localStorage.getItem("termux_wx_units");
      if (saved === "metric" || saved === "imperial") {
        return saved;
      }
    } catch {
      // ignore
    }
    return "metric";
  });

  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  // Listen to OS theme changes when 'system' is selected
  useEffect(() => {
    applyTheme(theme);

    if (theme === "system" && typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        applyTheme("system");
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    const isCurrentDark = resolveIsDark(theme);
    const nextTheme: ThemeMode = isCurrentDark ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, [theme]);

  const handleSetTheme = useCallback((mode: ThemeMode) => {
    setTheme(mode);
    applyTheme(mode);
  }, []);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isServerModalOpen, setIsServerModalOpen] = useState<boolean>(false);
  const [isEaseeModalOpen, setIsEaseeModalOpen] = useState<boolean>(false);
  const [isBmwModalOpen, setIsBmwModalOpen] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [isOpenWeatherModalOpen, setIsOpenWeatherModalOpen] = useState<boolean>(false);
  const [easeeStatus, setEaseeStatus] = useState<EaseeAccountStatus | null>(null);
  const [authStatus, setAuthStatus] = useState<ZeroTrustAuthStatus | null>(null);
  const [weatherPollSeconds, setWeatherPollSeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("termux_wx_poll_interval");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 5 && parsed <= 3600) return parsed;
      }
    } catch {}
    return 30; // Default 30s
  });

  const handleUpdateWeatherPollSeconds = useCallback((sec: number) => {
    const clamped = Math.max(5, Math.min(3600, sec));
    setWeatherPollSeconds(clamped);
    try {
      localStorage.setItem("termux_wx_poll_interval", clamped.toString());
      fetch("/api/station/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weatherRefreshInterval: clamped }),
      }).catch(() => {});
    } catch {}
  }, []);

  // Fetch Zero-Trust & Auth Status
  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("station_admin_token") || ""}`,
        },
      });
      if (res.ok) {
        const data: ZeroTrustAuthStatus = await res.json();
        setAuthStatus(data);
      }
    } catch (e) {
      console.warn("Auth status fetch error:", e);
    }
  }, []);

  const [stationConfig, setStationConfig] = useState<ConsolidatedUserConfig | null>(null);

  // Fetch Consolidated Station Config from Server (persisted in SQLite database)
  const fetchStationConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/station/config");
      if (res.ok) {
        const data: ConsolidatedUserConfig = await res.json();
        setStationConfig(data);
        if (data.location && typeof data.location.latitude === "number" && typeof data.location.longitude === "number") {
          setSelectedLocation((prev) => {
            if (
              prev &&
              prev.latitude === data.location.latitude &&
              prev.longitude === data.location.longitude &&
              prev.name === data.location.name
            ) {
              return prev;
            }
            return data.location;
          });
          try {
            localStorage.setItem("termux_wx_selected_location", JSON.stringify(data.location));
          } catch {}
          if (data.units === "metric" || data.units === "imperial") {
            setUnits((prev) => (prev === data.units ? prev : data.units));
            try {
              localStorage.setItem("termux_wx_units", data.units);
            } catch {}
          }
          if (typeof data.weatherRefreshInterval === "number" && data.weatherRefreshInterval >= 5) {
            setWeatherPollSeconds(data.weatherRefreshInterval);
            try {
              localStorage.setItem("termux_wx_poll_interval", data.weatherRefreshInterval.toString());
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn("Station config fetch failed:", e);
    }
  }, []);

  // Update consolidated user config in backend SQLite database
  const handleUpdateStationConfig = useCallback(async (partial: Partial<ConsolidatedUserConfig>) => {
    try {
      const res = await fetch("/api/station/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setStationConfig(data.config);
        }
      }
    } catch (e) {
      console.warn("Failed to update SQLite station config:", e);
    }
  }, []);

  // Persist selected location to SQLite server & local storage whenever user selects
  const handleSelectLocation = useCallback(async (loc: LocationOption) => {
    setSelectedLocation(loc);
    try {
      localStorage.setItem("termux_wx_selected_location", JSON.stringify(loc));
      await handleUpdateStationConfig({ location: loc, units });
    } catch (e) {
      console.warn("Failed to persist location to server:", e);
    }
  }, [units, handleUpdateStationConfig]);

  // Persist units to SQLite server & local storage
  const handleToggleUnits = useCallback(async () => {
    const nextUnits: UnitSystem = units === "metric" ? "imperial" : "metric";
    setUnits(nextUnits);
    try {
      localStorage.setItem("termux_wx_units", nextUnits);
      await handleUpdateStationConfig({ location: selectedLocation, units: nextUnits });
    } catch (e) {
      console.warn("Failed to persist units to server:", e);
    }
  }, [selectedLocation, units, handleUpdateStationConfig]);

  // Custom alert rules stored in localStorage
  const [customRules, setCustomRules] = useState<CustomAlertRule[]>(() => {
    try {
      const saved = localStorage.getItem("termux_wx_alert_rules");
      return saved ? JSON.parse(saved) : DEFAULT_ALERT_RULES;
    } catch {
      return DEFAULT_ALERT_RULES;
    }
  });

  // Save rules to localStorage
  const saveCustomRules = (newRules: CustomAlertRule[]) => {
    setCustomRules(newRules);
    try {
      localStorage.setItem("termux_wx_alert_rules", JSON.stringify(newRules));
    } catch (e) {
      console.error("Failed to save rules to localStorage", e);
    }
  };

  // Fetch Easee Status
  const fetchEaseeStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/easee/status");
      if (res.ok) {
        const data: EaseeAccountStatus = await res.json();
        setEaseeStatus(data);
      }
    } catch (e) {
      console.warn("Easee status fetch failed:", e);
    }
  }, []);

  // Easee Login with End-to-End Local Wi-Fi Encryption
  const handleEaseeLogin = async (userName: string, pass: string): Promise<boolean> => {
    try {
      // Hybrid Encrypt credentials in the browser using server's RSA-2048-OAEP + AES-256-GCM
      // Zero plaintext is transmitted across the local Wi-Fi / network.
      const { payload } = await encryptCredentialsForLocalTransmission(userName, pass);

      const res = await fetch("/api/easee/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setEaseeStatus(data.data);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Easee login failed:", err);
      return false;
    }
  };

  // Easee Logout
  const handleEaseeLogout = async () => {
    try {
      await fetch("/api/easee/logout", { method: "POST" });
      await fetchEaseeStatus();
    } catch (e) {
      console.error("Easee logout failed:", e);
    }
  };

  // Refresh Easee Chargers
  const handleRefreshEaseeChargers = async () => {
    try {
      const res = await fetch("/api/easee/chargers");
      if (res.ok) {
        await fetchEaseeStatus();
      }
    } catch (e) {
      console.error("Failed to refresh chargers:", e);
    }
  };

  // Explicit Easee Token Refresh
  const handleRefreshEaseeToken = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/easee/refresh-token", { method: "POST" });
      const data = await res.json();
      if (data.success && data.data) {
        setEaseeStatus(data.data);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Token refresh failed:", e);
      return false;
    }
  };

  // 1-Click Solar Schedule Sync to Easee
  const handleSyncSolarSchedule = async (
    startTime: string,
    stopTime: string,
    targetAmps: number,
    phaseMode: 1 | 3 = 1,
    maxCurrentAmps?: number
  ): Promise<boolean> => {
    try {
      const chargerId = easeeStatus?.selectedChargerId || easeeStatus?.chargers?.[0]?.id || "EH849201";
      const utcOffsetMinutes =
        typeof weather?.utcOffsetSeconds === "number"
          ? Math.round(weather.utcOffsetSeconds / 60)
          : undefined;

      const res = await fetch(`/api/easee/charger/${chargerId}/sync-solar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime,
          stopTime,
          targetAmps,
          maxCurrentAmps: maxCurrentAmps || targetAmps,
          phaseMode,
          repeat: true,
          isEnabled: true,
          solarScore: tomorrowSolarPrediction?.score || 85,
          timezone: weather?.timezone,
          utcOffsetMinutes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchEaseeStatus();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Sync solar schedule failed:", err);
      return false;
    }
  };

  // Easee Command Dispatch
  const handleEaseeCommand = async (
    chargerId: string,
    command: "start" | "pause" | "resume" | "toggle_lock"
  ) => {
    try {
      await fetch(`/api/easee/charger/${chargerId}/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      await fetchEaseeStatus();
    } catch (e) {
      console.error("Command failed:", e);
    }
  };

  // Toggle Auto Sync
  const handleToggleEaseeAutoSync = async (enabled: boolean) => {
    try {
      await fetch("/api/easee/auto-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await fetchEaseeStatus();
    } catch (e) {
      console.error("Toggle auto sync failed:", e);
    }
  };

  // Update EV Battery & Target SOC Threshold Settings
  const handleUpdateSocConfig = async (config: Partial<EvBatterySocConfig>): Promise<boolean> => {
    try {
      const res = await fetch("/api/easee/soc-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success && data.easeeStatus) {
        setEaseeStatus(data.easeeStatus);
        return true;
      }
      await fetchEaseeStatus();
      return true;
    } catch (e) {
      console.error("Update SOC config failed:", e);
      return false;
    }
  };

  // BMW ConnectedDrive Login
  const handleBmwLogin = async (payload: any): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch("/api/bmw/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        if (data.easeeStatus) setEaseeStatus(data.easeeStatus);
        else await fetchEaseeStatus();
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || "Failed to authenticate with BMW ConnectedDrive." };
    } catch (e: any) {
      console.error("BMW login error:", e);
      return { success: false, message: e.message || "Network error connecting to BMW server." };
    }
  };

  // BMW ConnectedDrive Telemetry Sync
  const handleBmwSyncTelemetry = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/bmw/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        if (data.easeeStatus) setEaseeStatus(data.easeeStatus);
        else await fetchEaseeStatus();
        return true;
      }
      return false;
    } catch (e) {
      console.error("BMW telemetry sync error:", e);
      return false;
    }
  };

  // BMW ConnectedDrive Quick Telemetry / SOC Calibration
  const handleBmwUpdateTelemetry = async (payload: any): Promise<boolean> => {
    try {
      const res = await fetch("/api/bmw/vehicle/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        if (data.easeeStatus) setEaseeStatus(data.easeeStatus);
        else await fetchEaseeStatus();
        return true;
      }
      return false;
    } catch (e) {
      console.error("BMW telemetry update error:", e);
      return false;
    }
  };

  // BMW ConnectedDrive Logout
  const handleBmwLogout = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/bmw/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        if (data.easeeStatus) setEaseeStatus(data.easeeStatus);
        else await fetchEaseeStatus();
        return true;
      }
      return false;
    } catch (e) {
      console.error("BMW logout error:", e);
      return false;
    }
  };

  // Fetch weather data from caching server
  const fetchWeather = useCallback(async (loc?: Location | any, u?: UnitSystem | any, force: boolean = false) => {
    // Defend against React SyntheticEvent / MouseEvent passed into onClick handlers
    const isValidLoc = loc && typeof loc === "object" && typeof loc.latitude === "number" && typeof loc.longitude === "number";
    const targetLoc = isValidLoc ? loc : selectedLocation;
    const targetUnits = (u === "metric" || u === "imperial") ? u : units;

    setIsLoading(true);
    setError(null);
    try {
      const forceQuery = force ? "&force=true" : "";
      const url = `/api/weather?lat=${targetLoc.latitude}&lon=${targetLoc.longitude}&city=${encodeURIComponent(
        targetLoc.name
      )}&units=${targetUnits}${forceQuery}&_t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || errJson?.error || `Weather server returned HTTP ${res.status}`);
      }
      const data: WeatherData = await res.json();
      setWeather(data);
    } catch (err: any) {
      console.error("Failed to fetch weather:", err);
      setError(err.message || "Failed to retrieve weather data from backend.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedLocation.latitude, selectedLocation.longitude, selectedLocation.name, units]);

  // Fetch server status & cache telemetry
  const fetchServerInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/server-info");
      if (res.ok) {
        const data: ServerInfo = await res.json();
        setServerInfo(data);
      }
    } catch (e) {
      console.error("Failed to fetch server info", e);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    fetchStationConfig();
    fetchServerInfo();
    fetchEaseeStatus();
    fetchAuthStatus();
  }, [fetchStationConfig, fetchServerInfo, fetchEaseeStatus, fetchAuthStatus]);

  // Fetch weather data whenever location coordinates/name or units change
  useEffect(() => {
    fetchWeather(selectedLocation, units);
  }, [fetchWeather, selectedLocation.latitude, selectedLocation.longitude, selectedLocation.name, units]);

  // Periodic weather auto-poll (default 30 seconds, user configurable)
  useEffect(() => {
    const intervalMs = Math.max(5, Math.min(3600, weatherPollSeconds)) * 1000;
    const interval = setInterval(() => {
      fetchWeather(selectedLocation, units, false);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [fetchWeather, selectedLocation, units, weatherPollSeconds]);

  // Periodic server telemetry & auth status poll (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchServerInfo();
      fetchAuthStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchServerInfo, fetchAuthStatus]);

  // Periodic Easee & BMW EV SOC status poll (default 60s / 1 min, or user configured interval)
  useEffect(() => {
    const pollSeconds = easeeStatus?.socConfig?.socPollIntervalSeconds || 60;
    const intervalMs = Math.max(5, Math.min(3600, pollSeconds)) * 1000;
    const interval = setInterval(() => {
      fetchEaseeStatus();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [fetchEaseeStatus, easeeStatus?.socConfig?.socPollIntervalSeconds]);

  // User location GPS geolocation
  const handleGeolocate = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          try {
            const res = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?name=${lat.toFixed(2)},${lon.toFixed(2)}&count=1`
            );
            let name = "Current Location";
            if (res.ok) {
              const data = await res.json();
              if (data.results && data.results.length > 0) {
                name = data.results[0].name;
              }
            }
            handleSelectLocation({ name, latitude: lat, longitude: lon });
          } catch {
            handleSelectLocation({ name: "Current Location", latitude: lat, longitude: lon });
          }
        },
        (err) => {
          console.warn("Geolocation denied or error:", err);
        }
      );
    }
  };

  // Rule management handlers
  const handleAddRule = (rule: CustomAlertRule) => {
    saveCustomRules([...customRules, rule]);
  };

  const handleToggleRule = (id: string) => {
    saveCustomRules(
      customRules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteRule = (id: string) => {
    saveCustomRules(customRules.filter((r) => r.id !== id));
  };

  // Clear cache handler
  const handleClearCache = async () => {
    try {
      await fetch("/api/cache/clear", { method: "POST" });
      await fetchWeather();
      await fetchServerInfo();
    } catch (e) {
      console.error("Clear cache failed", e);
    }
  };

  // Compute active alerts & EV solar prediction
  const activeAlerts: ActiveAlert[] = weather
    ? evaluateWeatherAlerts(weather, customRules)
    : [];

  const tomorrowSolarPrediction = weather
    ? calculateTomorrowEvSolarPrediction(weather)
    : null;

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] transition-colors">
      {/* Obvious Top Solar Charging Banner */}
      {tomorrowSolarPrediction && (
        <TopSolarEvBanner prediction={tomorrowSolarPrediction} />
      )}

      {/* Top Navbar */}
      <Navbar
        currentCity={selectedLocation.name}
        units={units}
        theme={theme}
        onSelectLocation={handleSelectLocation}
        onToggleUnits={handleToggleUnits}
        onToggleTheme={handleToggleTheme}
        onSetTheme={handleSetTheme}
        onRefresh={() => fetchWeather(selectedLocation, units, true)}
        onOpenServerModal={() => setIsServerModalOpen(true)}
        onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
        onOpenWeatherModal={() => setIsOpenWeatherModalOpen(true)}
        authStatus={authStatus}
        serverInfo={serverInfo}
        isLoading={isLoading}
        onGeolocate={handleGeolocate}
        solarPrediction={tomorrowSolarPrediction}
        weatherPollSeconds={weatherPollSeconds}
        onUpdateWeatherPollSeconds={handleUpdateWeatherPollSeconds}
      />

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6">
        {/* Cache Performance Banner */}
        <CacheStatsBanner
          serverInfo={serverInfo}
          onOpenModal={() => setIsServerModalOpen(true)}
        />

        {error ? (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-6 text-center text-rose-800 shadow-sm my-8">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">Failed to load weather data</h3>
            <p className="text-xs text-rose-600 mb-4">{error}</p>
            <button
              onClick={() => fetchWeather(selectedLocation, units, true)}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs"
            >
              Retry Sync
            </button>
          </div>
        ) : weather && tomorrowSolarPrediction ? (
          <div className="space-y-6">
            {/* Row 1: Hero Weather Card */}
            <HeroWeatherCard weather={weather} />

            {/* Row 2: Tomorrow's Solar EV & Easee Charging Predictor */}
            <EvSolarChargingCard
              weather={weather}
              prediction={tomorrowSolarPrediction}
              easeeStatus={easeeStatus}
              stationConfig={stationConfig}
              onUpdateStationConfig={handleUpdateStationConfig}
              onOpenEaseeModal={() => setIsEaseeModalOpen(true)}
              onOpenBmwModal={() => setIsBmwModalOpen(true)}
              onSyncSolarSchedule={handleSyncSolarSchedule}
              onUpdateSocConfig={handleUpdateSocConfig}
              onUpdateBmwTelemetry={handleBmwUpdateTelemetry}
              onSyncBmwTelemetry={handleBmwSyncTelemetry}
              onSendCommand={handleEaseeCommand}
            />

            {/* Row 3: Alerts & Custom Warnings */}
            <AlertsManager
              activeAlerts={activeAlerts}
              customRules={customRules}
              onAddRule={handleAddRule}
              onToggleRule={handleToggleRule}
              onDeleteRule={handleDeleteRule}
              units={units}
            />

            {/* Row 3: Interactive Geographic Map & City Selector */}
            <WeatherMap
              weather={weather}
              onSelectCoordinates={(loc) => handleSelectLocation(loc)}
            />

            {/* Row 4: Hourly Forecast Projection Chart */}
            <HourlyForecastChart
              hourly={weather.hourly}
              units={weather.units}
            />

            {/* Row 5: Historical Temperature Trends Analyzer */}
            <HistoricalTrends
              latitude={weather.latitude}
              longitude={weather.longitude}
              city={weather.city}
              units={units}
            />

            {/* Row 6: 7-Day Synoptic Outlook */}
            <DailyForecastList
              daily={weather.daily}
              units={weather.units}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              Connecting to Termux Weather Cache &amp; Open Database...
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="font-medium text-slate-700">Private Local Network Weather Server • Android Termux Host</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Powered by Open-Meteo &amp; Open Weather Archive • High Performance Caching Proxy
          </div>
        </div>
      </footer>

      {/* Termux Server Diagnostics & .NET Core Hub Modal */}
      {isServerModalOpen && (
        <TermuxServerModal
          serverInfo={serverInfo}
          onClose={() => setIsServerModalOpen(false)}
          onClearCache={handleClearCache}
        />
      )}

      {/* Easee Cloud EV Charger Control & Configuration Modal */}
      {isEaseeModalOpen && (
        <EaseeConnectModal
          isOpen={isEaseeModalOpen}
          onClose={() => setIsEaseeModalOpen(false)}
          easeeStatus={easeeStatus}
          onLogin={handleEaseeLogin}
          onLogout={handleEaseeLogout}
          onRefreshChargers={handleRefreshEaseeChargers}
          onRefreshToken={handleRefreshEaseeToken}
          onSendCommand={handleEaseeCommand}
          onToggleAutoSync={handleToggleEaseeAutoSync}
          onUpdateSocConfig={handleUpdateSocConfig}
        />
      )}

      {/* BMW ConnectedDrive & MyBMW Live BMS Telematics Modal */}
      {isBmwModalOpen && (
        <BmwConnectModal
          isOpen={isBmwModalOpen}
          onClose={() => setIsBmwModalOpen(false)}
          bmwStatus={easeeStatus?.socConfig?.bmwStatus}
          onLogin={handleBmwLogin}
          onSyncTelemetry={handleBmwSyncTelemetry}
          onUpdateVehicleTelemetry={handleBmwUpdateTelemetry}
          onUpdateSocConfig={handleUpdateSocConfig}
          onLogout={handleBmwLogout}
        />
      )}

      {/* Zero Trust & Public Access Security Modal (Option A) */}
      {isSecurityModalOpen && (
        <ZeroTrustSecurityModal
          authStatus={authStatus}
          onClose={() => setIsSecurityModalOpen(false)}
          onRefreshAuth={fetchAuthStatus}
        />
      )}

      {/* OpenWeatherMap API & Provider Configuration Modal */}
      {isOpenWeatherModalOpen && (
        <OpenWeatherConfigModal
          isOpen={isOpenWeatherModalOpen}
          onClose={() => setIsOpenWeatherModalOpen(false)}
          onConfigUpdated={() => fetchWeather(selectedLocation, units, true)}
        />
      )}
    </div>
  );
}
