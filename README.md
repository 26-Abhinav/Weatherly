# Weatherly — Weather Forecast System

Weatherly is a responsive weather dashboard built with React, TypeScript, and Vite. It fetches live forecast and geocoding data from Open-Meteo and falls back to clearly labelled sample data when the provider is unavailable.

## Features

- Live current conditions with temperature, humidity, wind, rain, visibility, and pressure
- Searchable global locations and browser geolocation
- 12-hour and detailed hourly forecasts
- Interactive seven-day forecast with a temperature trend chart
- Forecast-based severe-weather, rain, wind, UV, and heat alerts
- Air quality, sunrise, sunset, and daily details
- Saved locations stored on the device
- Celsius/Fahrenheit and light/dark preferences
- Local-first sign-up and sign-in prototype
- Responsive layouts for mobile, tablet, and desktop

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

## Validate and build

```bash
npm run lint
npm run build
npm run preview
```

## Data and architecture

- `src/weather.ts` contains the Open-Meteo integration, weather-code mapping, air-quality helpers, and sample fallback.
- `src/App.tsx` contains the application pages and interactive flows.
- `src/styles.css` contains the responsive design system and dark theme.
- Preferences, places, and the prototype account are currently persisted with `localStorage`.

## Production roadmap

For a production deployment, replace the local-first account prototype with a server-side authentication provider and database. Store notification subscriptions on the server, run scheduled alert checks, and deliver push/email alerts from a trusted backend. The weather provider can also be proxied through an API route for caching, rate limiting, and observability.
