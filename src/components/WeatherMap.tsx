import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapPin, Navigation, Compass, Layers, Globe } from "lucide-react";
import { LocationOption, WeatherData } from "../types";
import { POPULAR_LOCATIONS } from "../utils/weatherHelpers";

interface WeatherMapProps {
  weather: WeatherData;
  onSelectCoordinates: (loc: LocationOption) => void;
}

export const WeatherMap: React.FC<WeatherMapProps> = ({
  weather,
  onSelectCoordinates,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [mapMode, setMapMode] = useState<"dark" | "standard">("dark");

  const darkTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const standardTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const validLat = typeof weather.latitude === "number" && !isNaN(weather.latitude) ? weather.latitude : 52.3676;
    const validLng = typeof weather.longitude === "number" && !isNaN(weather.longitude) ? weather.longitude : 4.9041;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [validLat, validLng],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "topright" }).addTo(map);

      // Default dark theme tiles
      const tileLayer = L.tileLayer(darkTileUrl, {
        maxZoom: 18,
        subdomains: "abcd",
      }).addTo(map);

      // Custom pulsing map marker icon
      const customIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute h-8 w-8 rounded-full bg-blue-500 opacity-60"></span>
            <div class="h-6 w-6 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([validLat, validLng], {
        icon: customIcon,
      }).addTo(map);

      markerRef.current = marker;

      // Handle map click: fetch weather for clicked coordinate
      map.on("click", async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (typeof lat !== "number" || isNaN(lat) || typeof lng !== "number" || isNaN(lng)) return;
        // Attempt reverse geocoding via Open-Meteo or generic coordinate naming
        try {
          const res = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${lat.toFixed(2)},${lng.toFixed(2)}&count=1`
          );
          let cityName = `Location (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`;
          if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              cityName = data.results[0].name;
            }
          }
          onSelectCoordinates({
            name: cityName,
            latitude: lat,
            longitude: lng,
          });
        } catch {
          onSelectCoordinates({
            name: `Location (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`,
            latitude: lat,
            longitude: lng,
          });
        }
      });

      mapInstanceRef.current = map;
    }

    return () => {
      // Map cleanup on unmount handled gracefully
    };
  }, []);

  // Update center and marker when weather coordinates change
  useEffect(() => {
    const validLat = typeof weather.latitude === "number" && !isNaN(weather.latitude) ? weather.latitude : 52.3676;
    const validLng = typeof weather.longitude === "number" && !isNaN(weather.longitude) ? weather.longitude : 4.9041;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([validLat, validLng], 7, {
        duration: 1.2,
      });

      if (markerRef.current) {
        markerRef.current.setLatLng([validLat, validLng]);
        markerRef.current.bindPopup(`
          <div style="color: #0f172a; font-family: sans-serif; font-size: 12px; padding: 2px;">
            <b style="font-size: 14px;">${weather.city || "Selected Station"}</b><br/>
            <span>Temp: <b>${weather.current?.temperature ?? "--"}${weather.units?.temperature ?? "°C"}</b> (${weather.current?.description ?? ""})</span><br/>
            <span style="color: #64748b;">${validLat.toFixed(3)}°, ${validLng.toFixed(3)}°</span>
          </div>
        `).openPopup();
      }
    }
  }, [weather.latitude, weather.longitude, weather.city, weather.current?.temperature]);

  return (
    <div id="interactive-weather-map" className="relative rounded-2xl glass-card border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 shadow-xl text-slate-800 dark:text-slate-100 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5 tracking-tight">
            <Globe className="w-5 h-5 text-blue-500" />
            Interactive Geographic Station Selector
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Click anywhere on the map to load real-time telemetry &amp; historical trends for that coordinate
          </p>
        </div>

        {/* Quick Popular City Pills */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-thin">
          {POPULAR_LOCATIONS.slice(0, 5).map((loc) => (
            <button
              key={loc.name}
              onClick={() => onSelectCoordinates(loc)}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                weather.city.toLowerCase().includes(loc.name.toLowerCase())
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
              }`}
            >
              {loc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-72 sm:h-80 w-full rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-700/80 shadow-md">
        <div ref={mapContainerRef} className="h-full w-full z-10" />

        {/* Floating coordinate helper pill */}
        <div className="absolute bottom-3 left-3 z-20 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-md flex items-center gap-2 font-medium">
          <MapPin className="w-3.5 h-3.5 text-blue-500" />
          <span>Active Pin: <b>{weather.latitude.toFixed(3)}°, {weather.longitude.toFixed(3)}°</b></span>
        </div>
      </div>
    </div>
  );
};
