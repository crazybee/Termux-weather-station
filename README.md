# Termux Private Weather Station & EV Smart Solar Charging Server

A high-performance, self-hosted meteorological weather station, rooftop solar optimizer, and automated EV charging controller designed to run on a repurposed Android smartphone via **Termux** + **PM2** (or any Linux/macOS/Windows Node.js host). It serves real-time atmospheric telemetry, solar irradiance forecasts, automated Easee Wallbox schedules, and smart EV controls to all devices across your local Wi-Fi network.
<img width="1794" height="4843" alt="image" src="https://github.com/user-attachments/assets/509a86ef-6af7-43fa-bcf6-a8f096c187e6" />



---

## 🌟 Core Features & Modules

### ☀️ 1. Rooftop Solar PV & EV Charging Optimizer
- **Solar Irradiance & Yield Forecasting**: Computes hourly and total daily rooftop solar generation (kWh) using direct solar irradiance, cloud cover vectors, sun angle formulas, and PV system scaling.
- **Custom PV Array Scaling**: Configure your rooftop array capacity (e.g. 3.5 kW for ~9 solar panels, up to 12 kW+) and vehicle battery capacity (kWh) to calculate real-world solar charging percentages and daily savings.
- **Peak Solar Window Computation**: Automatically identifies the highest irradiance time window (e.g., `10:30 AM – 4:30 PM`) and recommends optimal charging current (6A–16A) and phase mode (1-Phase vs 3-Phase).
- **Hourly Production Bar Curves**: Visualizes expected solar yield (kW) throughout daylight hours alongside recommended wallbox amperage.

---

### 🔌 2. Easee Wallbox Cloud Integration & 1-Click Sync
- **Direct Easee API Integration**: Seamlessly connect your Easee wallbox via official cloud credentials without third-party brokers.
- **1-Click Solar Schedule Sync**: Dispatches the computed peak solar window directly into the Easee cloud schedule with automatic local-to-UTC timezone translation.
- **Phase Mode Control**: Toggle between **1-Phase (min 1.4 kW @ 6A)**—ideal for surplus solar charging with modest PV arrays—and **3-Phase (min 4.1 kW @ 6A)** for maximum grid charging speed.
- **Live Hardware Controls**: Remotely Start, Pause, Resume, or Stop charging sessions, lock/unlock the charging cable permanently or temporarily, reboot the wallbox, and monitor live charging power (kW), voltage, current per phase, and session energy.

---

### ⏰ 3. Automated Daily Solar Dispatch Daemon
- **Autonomous Server Daemon**: A background scheduler running on the Termux/Node.js server wakes up daily at your configured dispatch time (default: **08:00 AM** station local time).
- **Fresh Morning Forecast Fetch**: Pulls the day's meteorological forecast, computes today's optimal solar window, and automatically dispatches the schedule parameters to your Easee wallbox.
- **Zero Human Intervention**: Ensures your EV charges during optimal sunshine hours every day without needing to open the app.
- **On-Demand Manual Trigger**: Includes a **"Run 8 AM Dispatch Now"** button in the dashboard to test and execute the daily solar dispatch on demand.

---

### 🚗 4. EV Battery SOC & BMW i3 Telemetry Module
- **EV Battery Health Target (e.g., 80% / 90% SOC)**: Set your vehicle battery charge limit to prolong battery lifespan.
- **Active SOC Enforcement Daemon**: Continuously monitors vehicle BMS telemetry against your configured target and automatically pauses Easee wallbox charging when your vehicle reaches the target battery percentage.
- **BMW i3 Telemetry Status**: The BMW telemetry architecture and battery monitoring module are fully modeled. *Note:* Live cloud sync with BMW ConnectedDrive is currently paused due to BMW's recent mobile API authentication changes (which require specialized session extraction and packet inspection); full live integration will be finalized in an upcoming release.

---

### 🌦️ 5. Dual Weather Providers & Live Polling
- **Dual Weather Engine**: Seamlessly switch between **Open-Meteo** (no API key required) and **OpenWeatherMap One Call 3.0 / 2.5** (custom API key with real-time key validator).
- **Configurable Live Polling Frequency**: Selectable refresh intervals (`15s`, `30s ★ default`, `60s`, `5m`, or custom seconds) with instant UI updates and in-memory RAM cache synchronization.
- **Atmospheric Telemetry**: Apparent temperature, relative humidity, barometric pressure, dew point, UV index category, wind speed, gusts, direction compass, and visibility.
- **48-Hour Hourly Sequence Charts**: Interactive trend visualizations for temperature, precipitation probability, and wind velocity with smooth Framer Motion entrance animations.
- **7-Day Synoptic Outlook**: Daily forecast cards with high/low temperature spectrum bars and precipitation sums.
- **Historical Climate Analysis**: Deep historical trend charts covering 7, 14, 30, and 90-day timeframes.
- **Severe Weather & Frost Alerts**: Automated alert banners for frost warnings, high heat, and extreme precipitation.

---

### 🌓 6. Global Dark Mode Theme System
- **Light, Dark, and System Modes**: Seamlessly toggle between high-contrast daylight and dark themes with an accessible navbar control.
- **Dual-Layer Persistence**: Preferences are saved locally for instant zero-latency page loads and synchronized with the SQLite database.
- **Anti-Flicker Architecture**: Inline script evaluation prevents unstyled flashes on refresh.

---

### 🔒 7. Zero-Trust Security & Station Administration
- **Station Admin Authentication**: Protects sensitive operations (dispatching schedules, manual wallbox controls, cable locks, SOC limits, and station coordinates) behind an Admin PIN / Session Token.
- **Encrypted Local Transmission**: AES-GCM / RSA-OAEP encrypted client-to-server credential transmission.
- **Public Kiosk / Family View**: Safe for wall-mounted displays and family members on the local network without exposing admin controls.

---

### 📱 8. Termux Local Server Hub & Hardware Telemetry
- **Native SQLite Persistence**: Zero-configuration durable storage (`user_data.sqlite`) for station configuration, weather provider keys, Easee sessions, and alert rules with JSON migration fallback.
- **Sub-Millisecond RAM Proxy Caching**: In-memory caching drastically reduces external API latency (<5ms response time) and prevents rate limits.
- **Hardware Telemetry Monitor**: Displays host CPU usage, RAM utilization, process uptime, Android battery level, cache hit ratios, and server response times.
- **Local Network Broadcast**: Binds to `0.0.0.0:3000` so any device (smartphones, tablets, PCs, smart TVs) on your local Wi-Fi can view the dashboard.

---

## 📖 Application Usage Instructions

### 1. Setting Up Your Weather Station Location
1. Open the dashboard in your browser (`http://localhost:3000` or `http://<phone-ip>:3000`).
2. Click **"Termux Server Hub"** in the top navigation bar or the location title on the main card.
3. Search for your city or click on the interactive map to select your coordinates.
4. Set your local station name and verify the detected UTC timezone offset.
5. Click **"Save Station Config"** (enter your Admin PIN if prompted).

### 2. Connecting Your Easee Wallbox
1. In the **EV Solar & Easee Wallbox Charging Hub**, click **"Connect Easee"** (or click the plug icon in the top navigation).
2. Enter your **Easee Cloud Email & Password** and click **Connect Easee Wallbox**.
3. Once authenticated, your detected chargers will appear.
4. Select your active charger to view live status, voltage, current per phase, and session energy.

### 3. Configuring Solar PV Array & EV Battery Target SOC
1. In the **EV Solar Charging** card, adjust the **Solar Array Capacity** slider (e.g. `3.5 kW` for 9 panels) to match your rooftop setup.
2. In the **EV Battery SOC Management** panel, set your target battery limit (e.g. `80%` or `90%`).
3. Toggle **"Enable Automatic Charging Pause at Limit"** to active. The server daemon will automatically stop Easee charging once the target percentage has been reached.

### 4. Programming Solar Charging Schedules
- **Manual 1-Click Sync**: Under **Tomorrow's Forecast**, review the recommended window and click **"Sync Solar Schedule to Easee"**. The schedule will be immediately pushed to your wallbox.
- **Automated Daily Auto-Dispatch**: Ensure the **Daily Solar Auto-Dispatch** daemon indicator displays *Active*. Every morning at your scheduled time (e.g., 08:00 AM), the server will autonomously fetch the latest forecast and program today's solar window to your Easee wallbox.
- **Test Auto-Dispatch**: Click **"Run 8 AM Dispatch Now"** to test the complete calculation and dispatch pipeline immediately.

### 5. Adjusting Live Weather Polling Frequency
- Click the **"Weather Poll: 30s"** button in the top navigation bar.
- Choose from presets (`15s`, `30s`, `60s`, `5m`) or type a custom interval (5–3600 seconds) and press Enter.

---

## 🚀 Quick Start on Android (Termux + PM2)

### Step 1: Install Termux
Install **Termux** from [F-Droid](https://f-droid.org/packages/com.termux/) (do not use Google Play Store version as it is deprecated).

### Step 2: Update Packages & Install Node.js
Open Termux and run:
```bash
pkg update -y
pkg install -y nodejs git openssh
```

### Step 3: Keep Termux Active in Background
Prevent Android battery optimizer from sleeping background processes:
```bash
termux-wake-lock
```

*(Optional) Start OpenSSH server to manage Termux from your computer:*
```bash
passwd    # set a password
sshd      # starts SSH on port 8022
```

### Step 4: Clone & Install Dependencies
```bash
git clone https://github.com/crazybee/Termux-weather-station.git weather-station
cd weather-station
npm install
```

### Step 5: Build & Run with PM2 (24/7 Background Service)
```bash
# Install PM2 globally for automatic process restart
npm install -g pm2

# Build production bundle
npm run build

# Start server as background daemon
pm2 start dist/server.cjs --name "weather-station"
pm2 save
```
The server will start and bind to `http://0.0.0.0:3000`.

### Step 6: Find Your Phone's Local Wi-Fi IP
In Termux, check your local IP:
```bash
ifconfig wlan0
```
Look for the `inet` line (e.g. `192.168.1.145`).

### Step 7: Open Dashboard on Any Device
- On the phone itself: `http://localhost:3000`
- On any PC, iPad, tablet, or wall display on the same Wi-Fi: **`http://192.168.1.145:3000`**

---

## 💻 Quick Start on PC / Mac / Linux (Development)

```bash
# 1. Install dependencies
npm install

# 2. Run in development mode
npm run dev

# 3. Open in browser
http://localhost:3000
```

---

## 🛠️ Production Build Scripts

- `npm run build`: Compiles the React Vite frontend into `/dist` and bundles `server.ts` into a self-contained `/dist/server.cjs`.
- `npm start`: Launches the production server (`node dist/server.cjs`).
- `npm run lint`: Runs TypeScript compiler type-checking (`tsc --noEmit`).

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/weather` | Live atmospheric telemetry & solar metrics (lat, lon, units, provider) | No |
| `GET` | `/api/historical` | Historical climate trends (days: 7, 14, 30, 90) | No |
| `GET` | `/api/search` | Location search and geocoding query | No |
| `GET` | `/api/station-config` | Current weather station coordinates, provider, and settings | No |
| `POST` | `/api/station-config` | Update station location, coordinates, and timezone | Admin PIN |
| `GET` | `/api/server-info` | Host telemetry, CPU, RAM, uptime, and cache statistics | No |
| `POST` | `/api/clear-cache` | Flushes the in-memory RAM cache | Admin PIN |
| `GET` | `/api/openweather/config` | OpenWeatherMap API configuration status | No |
| `POST` | `/api/openweather/config` | Update & validate OpenWeatherMap API key | Admin PIN |
| `GET` | `/api/auth/status` | Current Zero-Trust authentication status | No |
| `POST` | `/api/auth/login` | Authenticate with Station Admin PIN | No |
| `GET` | `/api/easee/status` | Easee wallbox connection, live state, and schedule | No |
| `POST` | `/api/easee/login` | Authenticate with Easee Cloud credentials | Admin PIN |
| `POST` | `/api/easee/logout` | Disconnect Easee account and wipe session | Admin PIN |
| `POST` | `/api/easee/charger/:id/sync-solar` | Sync solar charging schedule to Easee wallbox | Admin PIN |
| `POST` | `/api/easee/charger/:id/action` | Hardware control (start, pause, resume, stop, cable lock, reboot) | Admin PIN |
| `POST` | `/api/easee/trigger-8am-dispatch` | Trigger daily solar auto-dispatch on demand | Admin PIN |
| `POST` | `/api/easee/soc-config` | Update target SOC cutoff limit & polling frequency | Admin PIN |
| `GET` | `/api/bmw/status` | BMW ConnectedDrive connection & vehicle telemetry | No |
| `POST` | `/api/bmw/login` | Authenticate with MyBMW credentials | Admin PIN |
| `POST` | `/api/bmw/logout` | Disconnect MyBMW account and wipe session | Admin PIN |

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Leaflet Maps, Framer Motion animations.
- **Backend Server**: Node.js, Express, tsx/esbuild, Open-Meteo REST API, OpenWeatherMap One Call API, Easee Cloud REST API, BMW ConnectedDrive API.
- **Persistence Layer**: Native SQLite database (`user_data.sqlite`) with automatic schema bootstrapping and WAL mode.
- **Background Daemons**:
  - `startDaily8AmScheduler`: Autonomous morning solar prediction and Easee schedule dispatcher.
  - `startSocMonitorDaemon`: Continuous vehicle SOC comparison and automatic charging pause enforcer.
- **Storage & State**: High-speed in-memory RAM cache with durable SQLite persistence.

---

## 🔮 Future Roadmap

- 🔌 **Expanded EV Wallbox & Charger Support**:
  - Add native integrations and cloud/local protocol support for other popular smart chargers (e.g., **Zaptec Go / Pro**, **Wallbox Pulsar Plus / Commander**, **go-e Charger**, **Tesla Wall Connector Gen 3**, and standard **OCPP 1.6J / 2.0.1** smart charging profiles).
  - Multi-charger load balancing and priority allocation for homes with multiple EV wallboxes.

- 🚘 **Expanded Vehicle Model & Telemetry Integrations**:
  - Add telemetry, battery SOC monitoring, and remote precondition controls for additional EV brands and APIs (e.g., **Tesla Fleet API**, **VAG / VW We Connect / Cariad**, **Hyundai Bluelink / Kia UVO**, **Renault / Dacia My Z.E.**, and **Nissan Leaf / ARIYA**).
  - Complete live token extraction and automated session refresh workflows for the **BMW ConnectedDrive (BMW i3)** telemetry engine.

- 📊 **Dynamic Electricity Tariff Optimization**:
  - Integrate real-time dynamic day-ahead Nord Pool / EPEX Spot / Tibber / Octopus energy prices to balance solar self-consumption with lowest-cost grid charging windows.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — free for personal, community, and commercial use with zero restrictions.

