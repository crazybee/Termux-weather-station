export type UnitSystem = "metric" | "imperial";

export interface WeatherMeta {
  isCacheHit: boolean;
  cacheAgeSeconds: number;
  responseTimeMs: number;
  cachedTtl: number;
  serverHost: string;
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  pressure: number;
  surfacePressure: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  precipitation: number;
  cloudCover: number;
  isDay: boolean;
  weatherCode: number;
  condition: string;
  description: string;
  icon: string;
  uvIndex: number;
}

export interface DailyItem {
  date: string;
  weatherCode: number;
  condition: string;
  description: string;
  icon: string;
  tempMax: number;
  tempMin: number;
  apparentTempMax: number;
  apparentTempMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  uvIndexMax: number;
  windSpeedMax: number;
  shortwaveRadiationSum?: number;
  sunrise?: string;
  sunset?: string;
}

export interface HourlyItem {
  time: string;
  weatherCode: number;
  condition: string;
  description: string;
  icon: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  dewPoint: number;
  precipitationProbability: number;
  precipitation: number;
  cloudCover?: number;
  pressure: number;
  visibility: number;
  windSpeed: number;
  windDirection: number;
  uvIndex: number;
  directRadiation?: number;
  globalRadiation?: number;
}

export interface EvSolarPrediction {
  score: number; // 0 - 100
  verdict: "EXCELLENT" | "GOOD" | "MODERATE" | "POOR";
  isSuitableForCharging?: boolean; // False if weather forecast is poor/unsuitable for solar charging
  isOffPeakSchedule?: boolean; // True if fallback 0:00 to 6:00 AM off-peak schedule is active
  badgeColor: string;
  solarHours: number; // peak sun hours
  estimatedSolarKwh: number; // estimated solar generation (e.g. for 5-8kW typical residential array)
  peakWindowStart: string; // e.g. "11:00 AM" or "0:00 AM" (00:00)
  peakWindowEnd: string; // e.g. "4:00 PM" or "6:00 AM" (06:00)
  cloudCoverageAvg: number; // %
  rainRisk: number; // %
  easeeRecommendation: string;
  summary: string;
  hourlyProduction: {
    time: string;
    hourLabel: string;
    solarPowerKw: number;
    uv: number;
    cloudCover: number;
    recommendedAmpLimit: number;
  }[];
}

export interface EaseeSchedulePayload {
  startTime: string; // "HH:MM" in Local Time (e.g. "10:30")
  stopTime: string; // "HH:MM" in Local Time (e.g. "16:30")
  isEnabled: boolean;
  repeat: boolean;
  targetAmps?: number; // e.g. 6 or 16
  maxCurrentAmps?: number; // e.g. 6 to 32
  phaseMode?: 1 | 3; // 1 = Single-phase, 3 = 3-phase
  chargeMode?: "SOLAR_ONLY" | "ECO_SURPLUS" | "GRID_FAST";
  timezone?: string; // e.g. "Europe/Berlin"
  utcOffsetMinutes?: number; // e.g. 120 for UTC+2
}

export interface BmwVehicleTelemetry {
  vin: string; // VIN (Vehicle Identification Number)
  soc: number; // chargingLevelHv / SOC percentage (e.g. 58%)
  chargingLevelHv: number; // edent/BMW-i-Remote exact field for HV battery charge level
  chargingLevelPercent: number; // Backward compatibility alias for soc
  maxrangeElectric: number; // Maximum possible electric driving range (km)
  maxRangeElectricMls?: number; // Maximum electric driving range in miles (km * 0.621371)
  remainingRangeKm: number; // Remaining electric range (km)
  mileage: number; // Total vehicle mileage / odometer reading (km)
  mileageMls?: number; // Total vehicle mileage in miles (km * 0.621371)
  chargingStatus: "CHARGING" | "WAITING_FOR_CHARGING" | "COMPLETE" | "ERROR" | "NOT_CHARGING" | "INVALID" | "CHARGING_PAUSED" | string;
  charging_status?: string; // edent/BMW-i-Remote raw charging status string (e.g. "CHARGING", "INVALID")
  isPluggedIn: boolean; // Connection state
  connectionStatus?: string; // "CONNECTED" | "DISCONNECTED"
  chargingTimeRemaining?: number; // Remaining charging time in minutes
  updateTime?: string; // Server/vehicle update timestamp
  model: string; // e.g. "BMW i3 120Ah"
  brand: string; // e.g. "BMW"
  targetSocPercent?: number; // Target cut-off SOC percentage
  lastUpdated: string;
  isVehicleTrackingActive?: boolean;
}

export interface BmwOAuthDiagnosticTrace {
  timestamp: string;
  stage: string;
  clientDescription?: string;
  clientId?: string;
  method: string;
  url: string;
  headersSent: Record<string, string>;
  paramsSent: Record<string, string>;
  status?: number;
  statusText?: string;
  locationHeader?: string;
  responseHeaders?: Record<string, string>;
  responseBodySnippet?: string;
  error?: string;
  success: boolean;
}

export interface BmwAccountStatus {
  isLoggedIn: boolean;
  username?: string;
  region: "rest_of_world" | "north_america" | "china";
  vehicles: BmwVehicleTelemetry[];
  selectedVin?: string;
  lastSyncTime?: string;
  syncIntervalMinutes: number;
  syncIntervalSeconds?: number; // Configurable polling interval (default: 30)
  error?: string;
  diagnosticLogs?: BmwOAuthDiagnosticTrace[];
}

export interface EvBatterySocConfig {
  enabled: boolean; // Whether auto-cutoff on target SOC is active
  batteryCapacityKwh: number; // e.g. 42.2 for i3 120Ah, 33.2 for 94Ah, 22 for 60Ah, or 75
  startSocPercent: number; // e.g. 30% when charging started
  targetSocPercent: number; // e.g. 80%, 90% (Auto stop threshold)
  socPollIntervalSeconds?: number; // User configurable SOC poll frequency (default: 30 seconds)
  vehicleModelName?: string; // e.g. "BMW i3 120Ah (42.2 kWh)"
  socSource: "BMW_CONNECTED_DRIVE" | "ESTIMATED"; // Direct BMW live telematics vs calculated
  bmwStatus?: BmwAccountStatus;
  lastAutoStopEvent?: {
    timestamp: string;
    targetSoc: number;
    deliveredKwh: number;
    finalSoc: number;
    reason: string;
    source: string;
  } | null;
}

export interface EaseeCharger {
  id: string; // e.g. "EH123456"
  name: string;
  isOnline: boolean;
  chargerOpMode: "Disconnected" | "AwaitingStart" | "Charging" | "Completed" | "Error" | "ReadyToCharge";
  cableLocked: boolean;
  currentPowerKw: number;
  sessionEnergyKwh: number;
  maxCurrentAmps: number;
  dynamicCurrentAmps: number;
  phaseMode: 1 | 3;
  currentSchedule?: {
    startTime: string; // Local time format
    stopTime: string; // Local time format
    utcStartTime?: string; // UTC string sent/stored in Easee Cloud
    utcStopTime?: string;
    isEnabled: boolean;
    repeat: boolean;
  } | null;
  lastUpdated: string;
}

export interface EaseeAccountStatus {
  isLoggedIn: boolean;
  userEmail?: string;
  accessToken?: string;
  chargers: EaseeCharger[];
  selectedChargerId?: string;
  autoSyncSolar: boolean;
  socConfig?: EvBatterySocConfig;
  lastScheduleSync?: {
    timestamp: string;
    startTime: string; // Local time
    stopTime: string; // Local time
    utcStartTime?: string; // UTC time
    utcStopTime?: string;
    timezone?: string;
    solarScore: number;
    amps: number;
    phaseMode?: 1 | 3;
    status: "SUCCESS" | "FAILED";
  } | null;
  daily8AmDispatch?: Daily8AmDispatchRecord | null;
  error?: string;
}

export interface Daily8AmDispatchRecord {
  lastRunTime: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "10:30"
  stopTime: string; // "16:30"
  utcStartTime?: string;
  utcStopTime?: string;
  timezone?: string;
  solarScore: number;
  estimatedSolarKwh: number;
  recommendedAmps: number;
  phaseMode: 1 | 3;
  status: "SUCCESS" | "FAILED" | "PENDING" | "SKIPPED";
  message: string;
  chargerId?: string;
  verdict?: "EXCELLENT" | "GOOD" | "MODERATE" | "POOR";
  isDaily8AmEnabled?: boolean;
}

export interface WeatherData {
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  timezoneAbbreviation?: string;
  utcOffsetSeconds?: number;
  elevation?: number;
  provider?: string;
  units: {
    temperature: string;
    speed: string;
    precipitation: string;
    pressure: string;
  };
  current: CurrentWeather;
  daily: DailyItem[];
  hourly: HourlyItem[];
  meta?: WeatherMeta;
}

export interface HistoricalRecord {
  date: string;
  tempMax: number;
  tempMin: number;
  tempMean: number;
  precipitation: number;
  windSpeedMax: number;
}

export interface HistoricalStats {
  averageTemperature: number;
  highestTemperature: number;
  lowestTemperature: number;
  totalPrecipitation: number;
  recordCount: number;
}

export interface HistoricalData {
  days: number;
  startDate: string;
  endDate: string;
  records: HistoricalRecord[];
  stats: HistoricalStats;
  meta: {
    isCacheHit: boolean;
    cacheAgeSeconds: number;
    responseTimeMs: number;
  };
}

export interface LocationOption {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  countryCode?: string;
  admin1?: string;
}

export interface HostInfo {
  device: string;
  environment: string;
  os: string;
  lanIp: string;
  port: number;
  uptimeSeconds: number;
  sshStatus: string;
  batteryLevel: number;
  batteryStatus: string;
  batteryTempC: number;
  cpuUsagePct: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  thermalState: string;
}

export interface CacheTelemetry {
  totalEntries: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRatioPct: number;
  totalLatencySavedMs: number;
  estimatedNetworkDataSavedKb: number;
}

export interface ServerInfo {
  host: HostInfo;
  cache: CacheTelemetry;
}

export interface CustomAlertRule {
  id: string;
  metric: "temperature" | "windSpeed" | "uvIndex" | "precipitationProbability" | "humidity";
  condition: ">" | "<";
  value: number;
  enabled: boolean;
  label: string;
  severity: "info" | "warning" | "danger";
}

export interface ActiveAlert {
  id: string;
  type: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
  value: string;
  timestamp: string;
}

export interface ZeroTrustAuthStatus {
  isAuthenticated: boolean;
  provider: "CLOUDFLARE_ACCESS" | "TAILSCALE" | "LOCAL_PASSCODE" | "LOCAL_OPEN" | "UNAUTHENTICATED";
  userEmail: string | null;
  userName: string | null;
  clientIp: string | null;
  isAdmin: boolean;
  isEnforced: boolean;
  allowedAdminEmails: string[];
  features: {
    canControlEasee: boolean;
    canSyncSchedule: boolean;
    canFlushCache: boolean;
    isPublicInternet: boolean;
  };
}

export interface ConsolidatedUserConfig {
  location: LocationOption;
  units: UnitSystem;
  timezone: string;
  utcOffsetMinutes: number;
  theme?: "light" | "dark" | "system";
  defaultEaseePhaseMode: 1 | 3; // default: 1-phase
  defaultEaseeMaxCurrent: number; // default: 6A
  weatherProvider?: "openweathermap" | "open-meteo";
  openWeatherApiKey?: string;
  weatherRefreshInterval?: number; // default: 30 seconds
  dailyDispatchTime?: string; // default: "08:00" (24h format HH:mm)
  dailyDispatchEnabled?: boolean; // default: true
  autoSyncSolar?: boolean;
  isDaily8AmEnabled?: boolean; // backwards-compatible alias for dailyDispatchEnabled
  lastUpdated: string;
  databaseEngine?: string;
}

export type StationConfig = ConsolidatedUserConfig;

