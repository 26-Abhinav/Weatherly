import type { LocationResult, Unit, WeatherData } from './types'

const FORECAST_API = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search'
const AIR_API = 'https://air-quality-api.open-meteo.com/v1/air-quality'

export const DEFAULT_LOCATION: LocationResult = {
  id: 1275339,
  name: 'Mumbai',
  country: 'India',
  admin1: 'Maharashtra',
  latitude: 19.076,
  longitude: 72.8777,
  timezone: 'Asia/Kolkata',
}

const POPULAR_LOCATIONS: LocationResult[] = [
  DEFAULT_LOCATION,
  { id: 1273294, name: 'Delhi', country: 'India', admin1: 'Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' },
  { id: 1277333, name: 'Bengaluru', country: 'India', admin1: 'Karnataka', latitude: 12.9716, longitude: 77.5946, timezone: 'Asia/Kolkata' },
  { id: 2643743, name: 'London', country: 'United Kingdom', admin1: 'England', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' },
  { id: 5128581, name: 'New York', country: 'United States', admin1: 'New York', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
  { id: 1850147, name: 'Tokyo', country: 'Japan', admin1: 'Tokyo', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo' },
  { id: 2147714, name: 'Sydney', country: 'Australia', admin1: 'New South Wales', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
  { id: 292223, name: 'Dubai', country: 'United Arab Emirates', admin1: 'Dubai', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
]

export async function searchLocations(query: string, signal?: AbortSignal): Promise<LocationResult[]> {
  if (query.trim().length < 2) return []
  const params = new URLSearchParams({ name: query.trim(), count: '7', language: 'en', format: 'json' })
  const fallback = () => POPULAR_LOCATIONS.filter((place) => `${place.name} ${place.admin1} ${place.country}`.toLowerCase().includes(query.toLowerCase()))
  let response: Response
  try {
    response = await fetch(`${GEOCODING_API}?${params}`, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return fallback()
  }
  if (!response.ok) {
    return fallback()
  }
  const data = await response.json()
  return (data.results ?? []).map((item: LocationResult) => ({
    id: item.id,
    name: item.name,
    country: item.country,
    admin1: item.admin1,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone,
  }))
}

export async function fetchWeather(location: LocationResult, unit: Unit, signal?: AbortSignal): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: [
      'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
      'precipitation', 'weather_code', 'cloud_cover', 'surface_pressure',
      'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
    ].join(','),
    hourly: [
      'temperature_2m', 'apparent_temperature', 'precipitation_probability',
      'weather_code', 'wind_speed_10m', 'relative_humidity_2m', 'visibility',
    ].join(','),
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min',
      'apparent_temperature_max', 'apparent_temperature_min', 'sunrise', 'sunset',
      'uv_index_max', 'precipitation_probability_max', 'wind_speed_10m_max',
      'wind_gusts_10m_max',
    ].join(','),
    temperature_unit: unit,
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    forecast_days: '7',
  })

  const [weatherResponse, airResponse] = await Promise.all([
    fetch(`${FORECAST_API}?${params}`, { signal }).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return null
    }),
    fetch(`${AIR_API}?latitude=${location.latitude}&longitude=${location.longitude}&current=us_aqi,pm2_5&timezone=auto`, { signal }).catch(() => null),
  ])

  if (!weatherResponse?.ok) return sampleWeather(location, unit)
  const raw = await weatherResponse.json()
  const air = airResponse?.ok ? await airResponse.json() : null

  return {
    source: 'live',
    location,
    timezone: raw.timezone,
    current: {
      time: raw.current.time,
      temperature: raw.current.temperature_2m,
      apparentTemperature: raw.current.apparent_temperature,
      humidity: raw.current.relative_humidity_2m,
      precipitation: raw.current.precipitation,
      weatherCode: raw.current.weather_code,
      cloudCover: raw.current.cloud_cover,
      pressure: raw.current.surface_pressure,
      windSpeed: raw.current.wind_speed_10m,
      windDirection: raw.current.wind_direction_10m,
      windGusts: raw.current.wind_gusts_10m,
      isDay: Boolean(raw.current.is_day),
    },
    hourly: raw.hourly.time.map((time: string, index: number) => ({
      time,
      temperature: raw.hourly.temperature_2m[index],
      apparentTemperature: raw.hourly.apparent_temperature[index],
      precipitationChance: raw.hourly.precipitation_probability[index] ?? 0,
      weatherCode: raw.hourly.weather_code[index],
      windSpeed: raw.hourly.wind_speed_10m[index],
      humidity: raw.hourly.relative_humidity_2m[index],
      visibility: raw.hourly.visibility[index],
    })),
    daily: raw.daily.time.map((date: string, index: number) => ({
      date,
      weatherCode: raw.daily.weather_code[index],
      maxTemperature: raw.daily.temperature_2m_max[index],
      minTemperature: raw.daily.temperature_2m_min[index],
      maxFeelsLike: raw.daily.apparent_temperature_max[index],
      minFeelsLike: raw.daily.apparent_temperature_min[index],
      sunrise: raw.daily.sunrise[index],
      sunset: raw.daily.sunset[index],
      uvIndex: raw.daily.uv_index_max[index],
      precipitationChance: raw.daily.precipitation_probability_max[index] ?? 0,
      maxWindSpeed: raw.daily.wind_speed_10m_max[index],
      maxWindGusts: raw.daily.wind_gusts_10m_max[index],
    })),
    airQuality: air?.current ? { aqi: air.current.us_aqi, pm25: air.current.pm2_5 } : undefined,
  }
}

function sampleWeather(location: LocationResult, unit: Unit): WeatherData {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  const latitudeEffect = Math.max(-8, Math.min(8, (25 - Math.abs(location.latitude)) * .18))
  const baseCelsius = 24 + latitudeEffect
  const toUnit = (value: number) => unit === 'fahrenheit' ? value * 9 / 5 + 32 : value
  const dayCodes = [2, 1, 61, 2, 0, 3, 80]
  const hourly = Array.from({ length: 168 }, (_, index) => {
    const time = new Date(now.getTime() + index * 60 * 60 * 1000)
    const hour = time.getHours()
    const dailyWave = Math.sin(((hour - 8) / 24) * Math.PI * 2) * 4.2
    const dayIndex = Math.floor(index / 24)
    const code = dayCodes[Math.min(dayIndex, 6)]
    const temperature = toUnit(baseCelsius + dailyWave + Math.sin(dayIndex * 1.7) * 1.2)
    return {
      time: toLocalIso(time),
      temperature,
      apparentTemperature: temperature + (unit === 'fahrenheit' ? 2 : 1),
      precipitationChance: [61, 80].includes(code) ? 72 - (hour % 5) * 5 : code === 3 ? 24 : 8,
      weatherCode: code,
      windSpeed: 10 + ((index * 7) % 12),
      humidity: 58 + ((index * 3) % 24),
      visibility: 9000 + ((index * 337) % 6000),
    }
  })
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() + index * 24 * 60 * 60 * 1000)
    const code = dayCodes[index]
    const variation = Math.sin(index * 1.7) * 1.2
    const minC = baseCelsius - 3.5 + variation
    const maxC = baseCelsius + 5 + variation
    const datePart = toLocalIso(date).slice(0, 10)
    return {
      date: datePart,
      weatherCode: code,
      maxTemperature: toUnit(maxC),
      minTemperature: toUnit(minC),
      maxFeelsLike: toUnit(maxC + 1),
      minFeelsLike: toUnit(minC),
      sunrise: `${datePart}T06:18`,
      sunset: `${datePart}T18:52`,
      uvIndex: 5 + (index % 4),
      precipitationChance: [61, 80].includes(code) ? 78 : code === 3 ? 28 : 9,
      maxWindSpeed: 18 + index * 2,
      maxWindGusts: 27 + index * 3,
    }
  })
  const currentHour = hourly[0]
  return {
    source: 'sample',
    location,
    timezone: location.timezone ?? 'auto',
    current: {
      time: currentHour.time,
      temperature: currentHour.temperature,
      apparentTemperature: currentHour.apparentTemperature,
      humidity: currentHour.humidity,
      precipitation: 0,
      weatherCode: currentHour.weatherCode,
      cloudCover: 42,
      pressure: 1009,
      windSpeed: currentHour.windSpeed,
      windDirection: 245,
      windGusts: 24,
      isDay: now.getHours() >= 6 && now.getHours() < 19,
    },
    hourly,
    daily,
    airQuality: { aqi: 42 + Math.abs(Math.round(location.latitude)) % 37, pm25: 12.4 },
  }
}

function toLocalIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear sky'
  if (code === 1) return 'Mostly clear'
  if (code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if ([45, 48].includes(code)) return 'Foggy'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle'
  if ([61, 63, 65, 66, 67].includes(code)) return 'Rain'
  if ([71, 73, 75, 77].includes(code)) return 'Snow'
  if ([80, 81, 82].includes(code)) return 'Rain showers'
  if ([85, 86].includes(code)) return 'Snow showers'
  if ([95, 96, 99].includes(code)) return 'Thunderstorm'
  return 'Mixed conditions'
}

export function compassDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return directions[Math.round(degrees / 45) % 8]
}

export function aqiDetails(aqi?: number): { label: string; color: string; description: string } {
  if (aqi == null) return { label: 'Unavailable', color: '#8b8a86', description: 'Air data is not available.' }
  if (aqi <= 50)  return { label: 'Good',           color: '#37866b', description: 'Air quality is satisfactory and poses little risk.' }
  if (aqi <= 100) return { label: 'Moderate',       color: '#d3a531', description: 'Acceptable; sensitive individuals may be affected.' }
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: '#dc7b3e', description: 'Sensitive groups should limit prolonged outdoor activity.' }
  if (aqi <= 200) return { label: 'Unhealthy',      color: '#c85252', description: 'Everyone may experience health effects outdoors.' }
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#8b3fa8', description: 'Health alert: significant risk for everyone.' }
  return           { label: 'Hazardous',             color: '#7e1f1f', description: 'Emergency conditions. Avoid all outdoor activity.' }
}

