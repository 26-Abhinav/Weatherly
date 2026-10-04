import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell, BellRing, Bookmark, Check, Cloud, CloudFog, CloudLightning,
  CloudRain, CloudSun, Droplets, Eye, Gauge, Heart, Home, LocateFixed, LogOut,
  MapPin, Menu, Moon, Navigation, RefreshCw, Search, Settings, ShieldAlert, Snowflake,
  Sparkles, Sun, Sunrise, Sunset, ThermometerSun, Wind, X,
} from 'lucide-react'
import type { LocationResult, SavedPlace, Unit, UserPreferences, WeatherData } from './types'
import {
  DEFAULT_LOCATION, aqiDetails, compassDirection, fetchWeather, searchLocations, weatherLabel,
} from './weather'
import AuthPage, { type AuthUser } from './AuthPage'

const DEFAULT_PREFERENCES: UserPreferences = {
  unit: 'celsius',
  weatherAlerts: true,
  dailySummary: false,
  autoLocation: false,
  darkMode: false,
}

type Tab = 'weather' | 'forecast' | 'places' | 'alerts'

function getStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function WeatherIcon({ code, isDay = true, size = 28, className = '' }: { code: number; isDay?: boolean; size?: number; className?: string }) {
  const props = { size, strokeWidth: 1.7, className, 'aria-hidden': true }
  if (code === 0) return isDay ? <Sun {...props} /> : <Moon {...props} />
  if ([1, 2].includes(code)) return <CloudSun {...props} />
  if (code === 3) return <Cloud {...props} />
  if ([45, 48].includes(code)) return <CloudFog {...props} />
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <Snowflake {...props} />
  if ([95, 96, 99].includes(code)) return <CloudLightning {...props} />
  return <CloudRain {...props} />
}

function formatTemperature(value: number, unit: Unit) {
  return `${Math.round(value)}°${unit === 'celsius' ? 'C' : 'F'}`
}

function formatHour(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric' })
}

function dayLabel(date: string, index: number) {
  if (index === 0) return 'Today'
  return new Date(`${date}T12:00`).toLocaleDateString([], { weekday: 'short' })
}

function App() {
  // Auth gate — show auth page until user is logged in
  const [user, setUser] = useState<AuthUser | null>(() => getStored('weatherly_user', null))

  function handleAuth(authUser: AuthUser) {
    setUser(authUser)
    localStorage.setItem('weatherly_user', JSON.stringify(authUser))
  }

  function handleSignOut() {
    setUser(null)
    localStorage.removeItem('weatherly_user')
  }

  if (!user) return <AuthPage onAuth={handleAuth} />

  return <WeatherApp user={user} onSignOut={handleSignOut} />
}

function WeatherApp({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const [preferences, setPreferences] = useState<UserPreferences>(() => getStored('weatherly_preferences', DEFAULT_PREFERENCES))
  const [location, setLocation] = useState<LocationResult>(() => getStored('weatherly_last_location', DEFAULT_LOCATION))
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() => getStored('weatherly_saved_places', []))
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('weather')
  const [selectedDay, setSelectedDay] = useState(0)
  const [mobileNav, setMobileNav] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [locating, setLocating] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.darkMode ? 'dark' : 'light'
    localStorage.setItem('weatherly_preferences', JSON.stringify(preferences))
  }, [preferences])

  useEffect(() => {
    localStorage.setItem('weatherly_saved_places', JSON.stringify(savedPlaces))
  }, [savedPlaces])

  useEffect(() => {
    const controller = new AbortController()
    fetchWeather(location, preferences.unit, controller.signal)
      .then(setWeather)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Unable to load the forecast')
      })
      .finally(() => setLoading(false))
    localStorage.setItem('weatherly_last_location', JSON.stringify(location))
    return () => controller.abort()
  }, [location, preferences.unit])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([])
        setSearching(false)
        return
      }
      setSearching(true)
      searchLocations(query, controller.signal)
        .then(setResults)
        .catch((err) => { if (err.name !== 'AbortError') setResults([]) })
        .finally(() => setSearching(false))
    }, 320)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const currentHourlyIndex = weather?.hourly.findIndex((hour) => hour.time >= weather.current.time) ?? 0
  const nextHours = weather?.hourly.slice(Math.max(0, currentHourlyIndex), Math.max(0, currentHourlyIndex) + 12) ?? []
  const isSaved = savedPlaces.some((place) => place.id === location.id)

  const alerts = useMemo(() => {
    if (!weather) return []
    const items: Array<{ level: 'warning' | 'watch' | 'info'; title: string; message: string }> = []
    const today = weather.daily[0]
    if (today.weatherCode >= 95) items.push({ level: 'warning', title: 'Thunderstorm warning', message: 'Thunderstorms are possible today. Stay indoors during lightning.' })
    if (today.precipitationChance >= 80) items.push({ level: 'watch', title: 'Heavy rain likely', message: `${today.precipitationChance}% chance of rain. Allow extra travel time.` })
    if (today.maxWindGusts >= 65) items.push({ level: 'warning', title: 'Strong wind advisory', message: `Wind gusts may reach ${Math.round(today.maxWindGusts)} km/h.` })
    if (today.uvIndex >= 8) items.push({ level: 'watch', title: 'Very high UV index', message: `UV index may reach ${Math.round(today.uvIndex)}. Use sun protection outdoors.` })
    if (today.maxTemperature >= (preferences.unit === 'celsius' ? 40 : 104)) items.push({ level: 'warning', title: 'Extreme heat', message: 'Limit strenuous outdoor activity and stay hydrated.' })
    if (!items.length) items.push({ level: 'info', title: 'No severe weather alerts', message: `Conditions around ${location.name} look stable today.` })
    return items
  }, [weather, location.name, preferences.unit])

  function chooseLocation(place: LocationResult) {
    setLoading(true)
    setError('')
    setWeather(null)
    setLocation(place)
    setQuery('')
    setResults([])
    setSearchOpen(false)
    setSelectedDay(0)
    setActiveTab('weather')
  }

  function toggleSaved() {
    if (isSaved) {
      setSavedPlaces((places) => places.filter((place) => place.id !== location.id))
      setToast(`${location.name} removed from saved places`)
    } else {
      setSavedPlaces((places) => [...places, { ...location, savedAt: new Date().toISOString() }])
      setToast(`${location.name} saved to your places`)
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setToast('Location is not supported by this browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLoading(true)
        setWeather(null)
        setLocation({
          id: Math.round(position.coords.latitude * 10000 + position.coords.longitude * 100),
          name: 'Current location',
          country: 'Your area',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocating(false)
        setToast('Using your current location')
      },
      () => {
        setLocating(false)
        setToast('We could not access your location')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function changeTab(tab: Tab) {
    setActiveTab(tab)
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function refreshWeather() {
    setLoading(true)
    setError('')
    setWeather(null)
    setLocation({ ...location })
  }

  const navItems: Array<{ id: Tab; label: string; icon: typeof Home }> = [
    { id: 'weather', label: 'Weather', icon: Home },
    { id: 'forecast', label: 'Forecast', icon: CloudSun },
    { id: 'places', label: 'Saved places', icon: Heart },
    { id: 'alerts', label: 'Alerts', icon: Bell },
  ]

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => changeTab('weather')} aria-label="Weatherly home">
          <span className="brand-mark"><Sun size={22} /></span>
          <span>Weatherly</span>
        </button>

        <nav className={mobileNav ? 'main-nav mobile-open' : 'main-nav'} aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.id} className={activeTab === item.id ? 'nav-item active' : 'nav-item'} onClick={() => changeTab(item.id)}>
              <item.icon size={17} /><span>{item.label}</span>
              {item.id === 'alerts' && alerts.some((a) => a.level !== 'info') && <span className="alert-dot" />}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Settings size={19} /></button>
          <div className="account-button">
            <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
            <span className="account-name">{user.name.split(' ')[0]}</span>
            <button className="signout-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
          <button className="mobile-menu" onClick={() => setMobileNav((value) => !value)} aria-label="Open navigation">
            {mobileNav ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <main>
        <section className="search-strip">
          <div className="search-wrap" ref={searchRef}>
            <Search size={20} />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search a city or place..."
              aria-label="Search locations"
            />
            {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><X size={17} /></button>}
            {searchOpen && query.length >= 2 && (
              <div className="search-results">
                {searching && <div className="search-status"><RefreshCw className="spin" size={17} /> Finding places…</div>}
                {!searching && results.map((result) => (
                  <button key={`${result.id}-${result.latitude}`} onClick={() => chooseLocation(result)}>
                    <MapPin size={18} />
                    <span><strong>{result.name}</strong><small>{[result.admin1, result.country].filter(Boolean).join(', ')}</small></span>
                    <Navigation size={15} />
                  </button>
                ))}
                {!searching && !results.length && <div className="search-status">No matching places found.</div>}
              </div>
            )}
          </div>
          <button className="location-button" onClick={useCurrentLocation} disabled={locating}>
            <LocateFixed className={locating ? 'spin' : ''} size={19} />
            <span>{locating ? 'Locating…' : 'Use my location'}</span>
          </button>
        </section>

        {loading && !weather && <LoadingState />}
        {error && !weather && (
          <div className="error-state">
            <CloudRain size={48} /><h2>Forecast unavailable</h2><p>{error}</p>
            <button className="primary-button" onClick={refreshWeather}><RefreshCw size={17} /> Try again</button>
          </div>
        )}

        {weather && activeTab === 'weather' && (
          <div className="dashboard page-enter">
            <div className="location-heading">
              <div>
                <span className="eyebrow"><MapPin size={14} /> Current weather</span>
                <h1>{location.name}</h1>
                <p>{[location.admin1, location.country].filter(Boolean).join(', ')} · Updated {new Date(weather.current.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{weather.source === 'sample' ? ' · Sample data' : ''}</p>
              </div>
              <div className="heading-actions">
                <button className={isSaved ? 'soft-button saved' : 'soft-button'} onClick={toggleSaved}>
                  <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} /> {isSaved ? 'Saved' : 'Save place'}
                </button>
                <button className="soft-button square" onClick={refreshWeather} aria-label="Refresh weather">
                  <RefreshCw className={loading ? 'spin' : ''} size={17} />
                </button>
              </div>
            </div>

            <section className="hero-grid">
              <article className="current-card">
                <div className="weather-glow glow-one" />
                <div className="weather-glow glow-two" />
                <div className="current-card-top">
                  <div className="current-icon"><WeatherIcon code={weather.current.weatherCode} isDay={weather.current.isDay} size={84} /></div>
                  <div className="current-temp">
                    <div className="temperature">{Math.round(weather.current.temperature)}<sup>°</sup></div>
                    <h2>{weatherLabel(weather.current.weatherCode)}</h2>
                    <p>Feels like {formatTemperature(weather.current.apparentTemperature, preferences.unit)}</p>
                  </div>
                </div>
                <div className="current-high-low">
                  <span>H: {formatTemperature(weather.daily[0].maxTemperature, preferences.unit)}</span>
                  <span>L: {formatTemperature(weather.daily[0].minTemperature, preferences.unit)}</span>
                </div>
                <div className="quick-stats">
                  <div><Droplets size={18} /><span><small>Humidity</small><strong>{weather.current.humidity}%</strong></span></div>
                  <div><Wind size={18} /><span><small>Wind</small><strong>{Math.round(weather.current.windSpeed)} km/h</strong></span></div>
                  <div><CloudRain size={18} /><span><small>Rain</small><strong>{weather.daily[0].precipitationChance}%</strong></span></div>
                </div>
              </article>

              <article className="card today-card">
                <div className="card-heading"><div><span className="eyebrow">Today’s overview</span><h2>Weather details</h2></div><span className="date-chip">{new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}</span></div>
                <div className="detail-grid">
                  <Detail icon={Wind} label="Wind" value={`${Math.round(weather.current.windSpeed)} km/h`} note={`From ${compassDirection(weather.current.windDirection)}`} />
                  <Detail icon={Droplets} label="Humidity" value={`${weather.current.humidity}%`} note={weather.current.humidity > 75 ? 'Quite humid' : 'Comfortable'} />
                  <Detail icon={Eye} label="Visibility" value={`${Math.round((nextHours[0]?.visibility ?? 0) / 1000)} km`} note="Current range" />
                  <Detail icon={Gauge} label="Pressure" value={`${Math.round(weather.current.pressure)} hPa`} note="At surface" />
                  <Detail icon={ThermometerSun} label="UV index" value={`${Math.round(weather.daily[0].uvIndex)}`} note={weather.daily[0].uvIndex >= 6 ? 'Protection needed' : 'Low to moderate'} />
                  <Detail icon={Wind} label="Gusts" value={`${Math.round(weather.current.windGusts)} km/h`} note="Peak current gust" />
                </div>
              </article>
            </section>

            {alerts.some((alert) => alert.level !== 'info') && (
              <button className="alert-banner" onClick={() => changeTab('alerts')}>
                <span className="alert-icon"><ShieldAlert size={20} /></span>
                <span><strong>{alerts[0].title}</strong><small>{alerts[0].message}</small></span>
                <span className="view-alert">View alert <span>→</span></span>
              </button>
            )}

            <section className="card forecast-card">
              <div className="card-heading">
                <div><span className="eyebrow">Next 12 hours</span><h2>Hourly forecast</h2></div>
                <button className="text-button" onClick={() => changeTab('forecast')}>Full forecast <span>→</span></button>
              </div>
              <div className="hourly-scroll">
                {nextHours.map((hour, index) => (
                  <div className={index === 0 ? 'hour-card active' : 'hour-card'} key={hour.time}>
                    <span>{index === 0 ? 'Now' : formatHour(hour.time)}</span>
                    <WeatherIcon code={hour.weatherCode} isDay={new Date(hour.time).getHours() > 6 && new Date(hour.time).getHours() < 19} />
                    <strong>{formatTemperature(hour.temperature, preferences.unit)}</strong>
                    <small><Droplets size={12} /> {hour.precipitationChance}%</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="bottom-grid">
              <article className="card weekly-card">
                <div className="card-heading"><div><span className="eyebrow">The week ahead</span><h2>7-day forecast</h2></div></div>
                <div className="week-list">
                  {weather.daily.map((day, index) => {
                    const totalRange = Math.max(...weather.daily.map((d) => d.maxTemperature)) - Math.min(...weather.daily.map((d) => d.minTemperature)) || 1
                    const left = ((day.minTemperature - Math.min(...weather.daily.map((d) => d.minTemperature))) / totalRange) * 30
                    const width = ((day.maxTemperature - day.minTemperature) / totalRange) * 60 + 18
                    return (
                      <button key={day.date} onClick={() => { setSelectedDay(index); changeTab('forecast') }}>
                        <span className="day-name">{dayLabel(day.date, index)}</span>
                        <span className="day-weather"><WeatherIcon code={day.weatherCode} size={22} /><small>{weatherLabel(day.weatherCode)}</small></span>
                        <span className="rain-chance"><Droplets size={13} />{day.precipitationChance}%</span>
                        <span className="temp-low">{formatTemperature(day.minTemperature, preferences.unit)}</span>
                        <span className="temp-track"><i style={{ left: `${left}%`, width: `${width}%` }} /></span>
                        <strong>{formatTemperature(day.maxTemperature, preferences.unit)}</strong>
                      </button>
                    )
                  })}
                </div>
              </article>

              <div className="side-stack">
                <article className="card sun-card">
                  <div className="card-heading compact"><div><span className="eyebrow">Daylight</span><h2>Sun & moon</h2></div><Sunrise size={23} /></div>
                  <div className="sun-arc"><div className="arc-line"><span className="sun-dot" /></div></div>
                  <div className="sun-times">
                    <div><Sunrise size={19} /><span><small>Sunrise</small><strong>{new Date(weather.daily[0].sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span></div>
                    <div><Sunset size={19} /><span><small>Sunset</small><strong>{new Date(weather.daily[0].sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span></div>
                  </div>
                </article>
                <AirQualityCard weather={weather} />
              </div>
            </section>
          </div>
        )}

        {weather && activeTab === 'forecast' && (
          <ForecastPage weather={weather} unit={preferences.unit} selectedDay={selectedDay} setSelectedDay={setSelectedDay} />
        )}

        {activeTab === 'places' && (
          <PlacesPage places={savedPlaces} current={location} onSelect={chooseLocation} onRemove={(id) => setSavedPlaces((items) => items.filter((item) => item.id !== id))} onSearch={() => { setActiveTab('weather'); setTimeout(() => document.querySelector<HTMLInputElement>('.search-wrap input')?.focus(), 0) }} />
        )}

        {activeTab === 'alerts' && (
          <AlertsPage alerts={alerts} location={location} enabled={preferences.weatherAlerts} setEnabled={(value) => setPreferences((p) => ({ ...p, weatherAlerts: value }))} />
        )}
      </main>

      <footer><div className="brand mini"><span className="brand-mark"><Sun size={16} /></span><span>Weatherly</span></div><p>Live forecasts powered by Open-Meteo · Built for clearer days ahead.</p></footer>

      {settingsOpen && <SettingsPanel preferences={preferences} setPreferences={setPreferences} close={() => setSettingsOpen(false)} />}
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
  )
}

function Detail({ icon: Icon, label, value, note }: { icon: typeof Wind; label: string; value: string; note: string }) {
  return <div className="detail-item"><span className="detail-icon"><Icon size={19} /></span><span><small>{label}</small><strong>{value}</strong><em>{note}</em></span></div>
}

function AirQualityCard({ weather }: { weather: WeatherData }) {
  const details = aqiDetails(weather.airQuality?.aqi)
  const score = Math.min(weather.airQuality?.aqi ?? 0, 200)
  return (
    <article className="card air-card">
      <div className="card-heading compact"><div><span className="eyebrow">Air quality</span><h2>{details.label}</h2></div><Wind size={23} /></div>
      <div className="aqi-row"><strong style={{ color: details.color }}>{weather.airQuality?.aqi ?? '—'}</strong><span><small>US AQI</small><p>{details.description}</p></span></div>
      <div className="aqi-scale"><i style={{ left: `${score / 2}%` }} /></div>
      <div className="aqi-labels"><span>Good</span><span>Moderate</span><span>Unhealthy</span></div>
    </article>
  )
}

function ForecastPage({ weather, unit, selectedDay, setSelectedDay }: { weather: WeatherData; unit: Unit; selectedDay: number; setSelectedDay: (day: number) => void }) {
  const day = weather.daily[selectedDay]
  const dayHours = weather.hourly.filter((hour) => hour.time.startsWith(day.date))
  const chartHours = dayHours.filter((_, index) => index % 3 === 0)
  const values = chartHours.map((hour) => hour.temperature)
  const min = Math.min(...values) - 2
  const max = Math.max(...values) + 2
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${80 - ((value - min) / (max - min || 1)) * 60}`).join(' ')

  return (
    <div className="content-page page-enter">
      <div className="page-title"><span className="eyebrow"><CloudSun size={14} /> Detailed forecast</span><h1>{weather.location.name}</h1><p>Explore conditions throughout the week.</p></div>
      <div className="day-tabs">
        {weather.daily.map((item, index) => (
          <button key={item.date} className={selectedDay === index ? 'active' : ''} onClick={() => setSelectedDay(index)}>
            <span>{dayLabel(item.date, index)}</span><WeatherIcon code={item.weatherCode} size={27} /><strong>{Math.round(item.maxTemperature)}°</strong><small>{Math.round(item.minTemperature)}°</small>
          </button>
        ))}
      </div>
      <section className="forecast-detail-grid">
        <article className="card chart-card">
          <div className="card-heading"><div><span className="eyebrow">Temperature trend</span><h2>{new Date(`${day.date}T12:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div><div className="condition-pill"><WeatherIcon code={day.weatherCode} size={18} />{weatherLabel(day.weatherCode)}</div></div>
          <div className="temperature-chart">
            <svg viewBox="0 0 100 90" preserveAspectRatio="none" aria-label="Temperature trend chart">
              <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#efad5d" stopOpacity=".35"/><stop offset="100%" stopColor="#efad5d" stopOpacity="0"/></linearGradient></defs>
              <polygon points={`0,88 ${points} 100,88`} fill="url(#chartFill)" />
              <polyline points={points} fill="none" stroke="#e79b43" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
              {values.map((value, index) => <circle key={index} cx={(index / Math.max(values.length - 1, 1)) * 100} cy={80 - ((value - min) / (max - min || 1)) * 60} r="1.4" fill="#fff" stroke="#e79b43" strokeWidth=".8" vectorEffect="non-scaling-stroke" />)}
            </svg>
            <div className="chart-labels">{chartHours.map((hour) => <span key={hour.time}>{formatHour(hour.time)}<strong>{formatTemperature(hour.temperature, unit)}</strong></span>)}</div>
          </div>
        </article>
        <article className="card day-summary">
          <div className="card-heading"><div><span className="eyebrow">Daily summary</span><h2>At a glance</h2></div></div>
          <div className="summary-temp"><WeatherIcon code={day.weatherCode} size={55} /><div><strong>{Math.round(day.maxTemperature)}°</strong><span>/ {Math.round(day.minTemperature)}°</span></div></div>
          <div className="summary-list">
            <div><Droplets size={18} /><span>Rain chance</span><strong>{day.precipitationChance}%</strong></div>
            <div><Wind size={18} /><span>Max wind</span><strong>{Math.round(day.maxWindSpeed)} km/h</strong></div>
            <div><ThermometerSun size={18} /><span>UV index</span><strong>{Math.round(day.uvIndex)}</strong></div>
            <div><Sunrise size={18} /><span>Sunrise</span><strong>{new Date(day.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
          </div>
        </article>
      </section>
      <section className="card hourly-table-card">
        <div className="card-heading"><div><span className="eyebrow">Hour by hour</span><h2>Complete daily outlook</h2></div></div>
        <div className="hourly-table">
          {dayHours.map((hour) => <div key={hour.time}><strong>{formatHour(hour.time)}</strong><span className="table-condition"><WeatherIcon code={hour.weatherCode} size={22} />{weatherLabel(hour.weatherCode)}</span><span>{formatTemperature(hour.temperature, unit)}</span><span><Droplets size={14} />{hour.precipitationChance}%</span><span><Wind size={14} />{Math.round(hour.windSpeed)} km/h</span></div>)}
        </div>
      </section>
    </div>
  )
}

function PlacesPage({ places, current, onSelect, onRemove, onSearch }: { places: SavedPlace[]; current: LocationResult; onSelect: (p: LocationResult) => void; onRemove: (id: number) => void; onSearch: () => void }) {
  return (
    <div className="content-page page-enter">
      <div className="page-title"><span className="eyebrow"><Heart size={14} /> Your weather map</span><h1>Saved places</h1><p>Keep the places that matter within easy reach.</p></div>
      {!places.length ? (
        <div className="empty-state"><span><MapPin size={34} /></span><h2>No saved places yet</h2><p>Search for a city and select “Save place” to add it here.</p><button className="primary-button" onClick={onSearch}><Search size={17} /> Find a city</button></div>
      ) : (
        <div className="places-grid">
          {places.map((place) => <article className="card place-card" key={place.id}><div className="place-art"><CloudSun size={42} /><span>{place.name.charAt(0)}</span></div><div><small>{place.country}</small><h2>{place.name}</h2><p>{place.admin1 || 'Saved location'}</p></div><div className="place-actions"><button className="primary-button" onClick={() => onSelect(place)}>{current.id === place.id ? 'Viewing' : 'View weather'}</button><button className="icon-button" onClick={() => onRemove(place.id)} aria-label={`Remove ${place.name}`}><X size={18} /></button></div></article>)}
          <button className="add-place" onClick={onSearch}><span><Search size={24} /></span><strong>Add another place</strong><small>Search cities worldwide</small></button>
        </div>
      )}
    </div>
  )
}

function AlertsPage({ alerts, location, enabled, setEnabled }: { alerts: Array<{ level: 'warning' | 'watch' | 'info'; title: string; message: string }>; location: LocationResult; enabled: boolean; setEnabled: (v: boolean) => void }) {
  return (
    <div className="content-page page-enter">
      <div className="page-title alert-page-title"><div><span className="eyebrow"><BellRing size={14} /> Stay prepared</span><h1>Weather alerts</h1><p>Important conditions and advisories for {location.name}.</p></div><label className="notification-toggle"><span><strong>Push alerts</strong><small>{enabled ? 'Notifications are on' : 'Notifications are paused'}</small></span><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /><i /></label></div>
      <div className="alerts-list">
        {alerts.map((alert, index) => <article className={`alert-card ${alert.level}`} key={`${alert.title}-${index}`}><span className="large-alert-icon">{alert.level === 'info' ? <Sparkles size={24} /> : <ShieldAlert size={24} />}</span><div><span className="alert-level">{alert.level === 'warning' ? 'Weather warning' : alert.level === 'watch' ? 'Weather watch' : 'All clear'}</span><h2>{alert.title}</h2><p>{alert.message}</p><small>Based on the latest forecast · Checked just now</small></div></article>)}
      </div>
      <article className="card preparedness"><div><span className="eyebrow">Be weather ready</span><h2>Simple preparedness tips</h2></div><div className="tip-grid"><div><span>01</span><strong>Check updates</strong><p>Review changing conditions before travel.</p></div><div><span>02</span><strong>Plan ahead</strong><p>Keep essentials and phone power ready.</p></div><div><span>03</span><strong>Stay sheltered</strong><p>Follow local guidance during severe weather.</p></div></div></article>
    </div>
  )
}

function SettingsPanel({ preferences, setPreferences, close }: { preferences: UserPreferences; setPreferences: (p: UserPreferences) => void; close: () => void }) {
  function update(key: keyof UserPreferences, value: boolean | Unit) { setPreferences({ ...preferences, [key]: value }) }
  return <div className="overlay" onMouseDown={close}><aside className="settings-panel" onMouseDown={(e) => e.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">Personalize</span><h2>Settings</h2></div><button className="icon-button" onClick={close}><X size={19} /></button></div><div className="settings-section"><label>Temperature unit</label><div className="unit-picker"><button className={preferences.unit === 'celsius' ? 'active' : ''} onClick={() => update('unit', 'celsius')}>Celsius <span>°C</span></button><button className={preferences.unit === 'fahrenheit' ? 'active' : ''} onClick={() => update('unit', 'fahrenheit')}>Fahrenheit <span>°F</span></button></div></div><div className="settings-section"><label>Experience</label><SettingToggle title="Dark appearance" subtitle="Easier on the eyes at night" checked={preferences.darkMode} onChange={(v) => update('darkMode', v)} /><SettingToggle title="Weather alerts" subtitle="Show important advisories" checked={preferences.weatherAlerts} onChange={(v) => update('weatherAlerts', v)} /><SettingToggle title="Daily summary" subtitle="A quick morning outlook" checked={preferences.dailySummary} onChange={(v) => update('dailySummary', v)} /></div><button className="primary-button full" onClick={close}>Save preferences</button></aside></div>
}

function SettingToggle({ title, subtitle, checked, onChange }: { title: string; subtitle: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="setting-toggle"><span><strong>{title}</strong><small>{subtitle}</small></span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i /></label>
}

function LoadingState() {
  return <div className="dashboard loading-dashboard"><div className="skeleton heading-skeleton" /><div className="hero-grid"><div className="skeleton hero-skeleton" /><div className="skeleton hero-skeleton" /></div><div className="skeleton strip-skeleton" /><div className="bottom-grid"><div className="skeleton block-skeleton" /><div className="skeleton block-skeleton" /></div></div>
}

export default App
