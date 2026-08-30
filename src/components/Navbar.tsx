import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  MapPin,
  Compass,
  Cpu,
  RefreshCw,
  Zap,
  Server,
  Terminal,
  Activity,
  Sun,
  Moon,
  Laptop,
  BatteryCharging,
  Timer,
  ChevronDown,
  Clock,
  CloudSun,
} from "lucide-react";
import { LocationOption, UnitSystem, ServerInfo, EvSolarPrediction, ZeroTrustAuthStatus } from "../types";
import { ThemeMode } from "../utils/theme";
import { ShieldCheck, Shield } from "lucide-react";

interface NavbarProps {
  currentCity: string;
  units: UnitSystem;
  theme: ThemeMode;
  onSelectLocation: (loc: LocationOption) => void;
  onToggleUnits: () => void;
  onToggleTheme: () => void;
  onSetTheme?: (theme: ThemeMode) => void;
  onRefresh: () => void;
  onOpenServerModal: () => void;
  onOpenSecurityModal: () => void;
  onOpenWeatherModal?: () => void;
  authStatus: ZeroTrustAuthStatus | null;
  serverInfo: ServerInfo | null;
  isLoading: boolean;
  onGeolocate: () => void;
  solarPrediction?: EvSolarPrediction | null;
  weatherPollSeconds?: number;
  onUpdateWeatherPollSeconds?: (seconds: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentCity,
  units,
  theme,
  onSelectLocation,
  onToggleUnits,
  onToggleTheme,
  onSetTheme,
  onRefresh,
  onOpenServerModal,
  onOpenSecurityModal,
  onOpenWeatherModal,
  authStatus,
  serverInfo,
  isLoading,
  onGeolocate,
  solarPrediction,
  weatherPollSeconds = 30,
  onUpdateWeatherPollSeconds,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LocationOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [isOpenPollDropdown, setIsOpenPollDropdown] = useState(false);
  const [isOpenThemeMenu, setIsOpenThemeMenu] = useState(false);
  const pollDropdownRef = useRef<HTMLDivElement>(null);
  const themeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pollDropdownRef.current && !pollDropdownRef.current.contains(event.target as Node)) {
        setIsOpenPollDropdown(false);
      }
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target as Node)) {
        setIsOpenThemeMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsOpenDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        setSearchResults(data.results || []);
        setIsOpenDropdown(true);
      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpenDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDarkModeActive =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 sm:px-6 shadow-xs transition-colors">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        {/* Left: Station Identity & Host Status */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-600/20 text-white font-black text-lg">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Termux Weather Station
                <span className="hidden sm:inline-block rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Node Alpha
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{serverInfo?.host.lanIp || "192.168.1.145"}:3000</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="hidden md:inline text-blue-600 dark:text-blue-400 font-medium font-sans">ARM64 Node.js</span>
              {serverInfo && (
                <>
                  <span className="text-slate-300 dark:text-slate-700 hidden lg:inline">•</span>
                  <span className="hidden lg:inline text-slate-600 dark:text-slate-400">
                    RAM: {serverInfo.host.memoryUsedMb}MB / CPU: {serverInfo.host.cpuUsagePct}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Search City Autocomplete */}
        <div className="relative flex-1 min-w-[200px] max-w-md" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              id="city-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setIsOpenDropdown(true);
              }}
              placeholder={`Search city (current: ${currentCity})...`}
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 pl-9 pr-8 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-600 dark:focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors shadow-xs"
            />
            {isSearching && (
              <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-400 w-3.5 h-3.5 animate-spin" />
            )}
          </div>

          {/* Autocomplete dropdown */}
          {isOpenDropdown && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                Found Locations
              </div>
              {searchResults.map((loc, idx) => (
                <button
                  key={`${loc.latitude}-${loc.longitude}-${idx}`}
                  onClick={() => {
                    onSelectLocation(loc);
                    setSearchQuery("");
                    setIsOpenDropdown(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/80 dark:hover:bg-slate-800 hover:text-blue-700 dark:hover:text-blue-400 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {loc.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {[loc.admin1, loc.country].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                    {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Controls & Diagnostics */}
        <div className="flex items-center gap-2">
          {/* Obvious Tomorrow EV Solar Status Pill */}
          {solarPrediction && (
            <button
              id="navbar-solar-pill"
              onClick={() => {
                const el = document.getElementById("ev-solar-charging-forecast");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              title={`Tomorrow EV Solar: ${solarPrediction.verdict} (${solarPrediction.score}/100) - Click to view Easee advice`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-transform active:scale-95 shadow-xs border ${
                solarPrediction.verdict === "EXCELLENT" || solarPrediction.verdict === "GOOD"
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20"
                  : solarPrediction.verdict === "MODERATE"
                  ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20"
                  : "bg-slate-700 hover:bg-slate-800 text-white border-slate-800"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span className="hidden sm:inline">Tomorrow EV Solar:</span>
              <span className="font-mono uppercase tracking-wider">{solarPrediction.verdict}</span>
              <span className="bg-black/20 px-1 py-0.2 rounded text-[10px] font-mono">
                {solarPrediction.score}/100
              </span>
            </button>
          )}

          {/* Geolocate Button */}
          <button
            id="btn-geolocate"
            onClick={onGeolocate}
            title="Use current GPS coordinate"
            className="flex items-center justify-center p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-xs"
          >
            <Compass className="w-4 h-4" />
          </button>

          {/* Unit Switcher */}
          <button
            id="btn-unit-toggle"
            onClick={onToggleUnits}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-xs"
            title="Toggle between Metric (°C) and Imperial (°F)"
          >
            {units === "metric" ? "°C, km/h" : "°F, mph"}
          </button>

          {/* Global Dark Mode Theme Toggle */}
          <div className="relative" ref={themeDropdownRef}>
            <button
              id="btn-theme-toggle"
              onClick={onToggleTheme}
              onContextMenu={(e) => {
                e.preventDefault();
                setIsOpenThemeMenu(!isOpenThemeMenu);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-xs"
              title={`Active Theme: ${theme.toUpperCase()} (Click to toggle Dark/Light, Right-click or hold for options)`}
            >
              {isDarkModeActive ? (
                <Moon className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              )}
              <span className="hidden sm:inline text-xs font-semibold capitalize">
                {theme === "system" ? "Auto" : theme}
              </span>
            </button>

            {isOpenThemeMenu && (
              <div className="absolute right-0 mt-1.5 w-44 p-1.5 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Theme
                </div>
                {[
                  { mode: "light" as ThemeMode, label: "Light Mode", icon: Sun, iconColor: "text-amber-500" },
                  { mode: "dark" as ThemeMode, label: "Dark Mode", icon: Moon, iconColor: "text-indigo-400" },
                  { mode: "system" as ThemeMode, label: "System Default", icon: Laptop, iconColor: "text-blue-500" },
                ].map(({ mode, label, icon: Icon, iconColor }) => (
                  <button
                    key={mode}
                    onClick={() => {
                      onSetTheme?.(mode);
                      setIsOpenThemeMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      theme === mode
                        ? "bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                      <span>{label}</span>
                    </span>
                    {theme === mode && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zero Trust Security & Public Access Trigger */}
          <button
            id="btn-zero-trust-security"
            onClick={onOpenSecurityModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors shadow-xs ${
              authStatus?.provider === "CLOUDFLARE_ACCESS" || authStatus?.provider === "TAILSCALE"
                ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                : "bg-slate-900 dark:bg-slate-800 border-slate-800 dark:border-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-700"
            }`}
            title="Zero-Trust Security & Public Exposure Guide"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${authStatus?.isAuthenticated ? "text-emerald-400" : "text-slate-300"}`} />
            <span className="hidden md:inline">
              {authStatus?.provider === "CLOUDFLARE_ACCESS"
                ? "Cloudflare Protected"
                : "Zero Trust (Opt A)"}
            </span>
          </button>

          {/* OpenWeatherMap API & Provider Configuration Trigger */}
          {onOpenWeatherModal && (
            <button
              id="btn-openweather-config"
              onClick={onOpenWeatherModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-900/60 transition-colors text-xs font-semibold shadow-xs"
              title="OpenWeatherMap API Key & Provider Settings"
            >
              <CloudSun className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span className="hidden lg:inline">OpenWeather API</span>
            </button>
          )}

          {/* Server Info / Termux Diagnostics Trigger */}
          <button
            id="btn-server-diagnostics"
            onClick={onOpenServerModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors text-xs font-semibold shadow-sm shadow-blue-600/20"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Termux Server Hub</span>
          </button>

          {/* Weather Polling Frequency Dropdown Selector */}
          <div className="relative" ref={pollDropdownRef}>
            <button
              id="btn-weather-polling-dropdown"
              onClick={() => setIsOpenPollDropdown(!isOpenPollDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-xs"
              title="Configure live weather auto-refresh interval (Default 30s)"
            >
              <Timer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Weather Poll:</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">{weatherPollSeconds}s</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isOpenPollDropdown && (
              <div className="absolute right-0 mt-1.5 w-64 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Weather Refresh Interval</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                    {weatherPollSeconds}s
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                  How often live weather data and solar irradiance automatically refresh (persisted in SQLite, default <strong>30s</strong>).
                </p>
                <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                  {[
                    { label: "15s", val: 15 },
                    { label: "30s ★", val: 30 },
                    { label: "60s", val: 60 },
                    { label: "5m", val: 300 },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => {
                        onUpdateWeatherPollSeconds?.(item.val);
                        setIsOpenPollDropdown(false);
                      }}
                      className={`py-1 px-1.5 rounded-lg text-xs font-mono font-bold text-center transition-all ${
                        weatherPollSeconds === item.val
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Custom:</span>
                  <input
                    type="number"
                    min="5"
                    max="3600"
                    defaultValue={weatherPollSeconds}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = parseInt((e.target as HTMLInputElement).value, 10);
                        if (!isNaN(v) && v >= 5 && v <= 3600) {
                          onUpdateWeatherPollSeconds?.(v);
                          setIsOpenPollDropdown(false);
                        }
                      }
                    }}
                    className="w-16 px-1.5 py-0.5 text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded text-center focus:outline-hidden focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">sec (5-3600)</span>
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            id="btn-refresh"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors disabled:opacity-50 shadow-xs"
            title="Force refresh weather data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600 dark:text-blue-400" : ""}`} />
          </button>
        </div>
      </div>
    </header>
  );
};

