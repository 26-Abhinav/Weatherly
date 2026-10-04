export type Unit = 'celsius' | 'fahrenheit'

export interface LocationResult {
  id: number
  name: string
  country: string
  admin1?: string
  latitude: number
  longitude: number
  timezone?: string
}

export interface WeatherData {
  source: 'live' | 'sample'
  location: LocationResult
  timezone: string
  current: {
    time: string
    temperature: number
    apparentTemperature: number
    humidity: number
    precipitation: number
    weatherCode: number
    cloudCover: number
    pressure: number
    windSpeed: number
    windDirection: number
    windGusts: number
    isDay: boolean
  }
  hourly: Array<{
    time: string
    temperature: number
    apparentTemperature: number
    precipitationChance: number
    weatherCode: number
    windSpeed: number
    humidity: number
    visibility: number
  }>
  daily: Array<{
    date: string
    weatherCode: number
    maxTemperature: number
    minTemperature: number
    maxFeelsLike: number
    minFeelsLike: number
    sunrise: string
    sunset: string
    uvIndex: number
    precipitationChance: number
    maxWindSpeed: number
    maxWindGusts: number
  }>
  airQuality?: {
    aqi: number
    pm25: number
  }
}

export interface UserPreferences {
  unit: Unit
  weatherAlerts: boolean
  dailySummary: boolean
  autoLocation: boolean
  darkMode: boolean
}

export interface SavedPlace extends LocationResult {
  savedAt: string
}
