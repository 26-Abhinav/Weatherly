import { FormEvent, useState } from 'react'
import { Sun, Mail, Lock, User, Eye, EyeOff, ArrowRight, CloudSun, Cloud, Droplets } from 'lucide-react'

export interface AuthUser {
  name: string
  email: string
}

interface AuthPageProps {
  onAuth: (user: AuthUser) => void
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function getStoredAccounts(): Record<string, { name: string; password: string }> {
    try {
      return JSON.parse(localStorage.getItem('weatherly_accounts') ?? '{}')
    } catch {
      return {}
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email')).trim().toLowerCase()
    const password = String(data.get('password'))
    const accounts = getStoredAccounts()

    setLoading(true)
    // Simulate a brief async delay for UX
    setTimeout(() => {
      setLoading(false)
      if (mode === 'signup') {
        const name = String(data.get('name')).trim()
        if (!name) { setError('Please enter your name.'); return }
        if (accounts[email]) { setError('An account with this email already exists.'); return }
        accounts[email] = { name, password }
        localStorage.setItem('weatherly_accounts', JSON.stringify(accounts))
        onAuth({ name: capitalize(name), email })
      } else {
        const account = accounts[email]
        if (!account) { setError('No account found with this email. Please sign up.'); return }
        if (account.password !== password) { setError('Incorrect password. Please try again.'); return }
        onAuth({ name: capitalize(account.name), email })
      }
    }, 600)
  }

  function capitalize(str: string) {
    return str.replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <div className="auth-shell">
      {/* Animated background */}
      <div className="auth-bg">
        <div className="auth-blob blob-1" />
        <div className="auth-blob blob-2" />
        <div className="auth-blob blob-3" />
        <div className="auth-scene-icons">
          <CloudSun className="scene-icon si-1" size={52} />
          <Cloud className="scene-icon si-2" size={38} />
          <Droplets className="scene-icon si-3" size={30} />
          <Sun className="scene-icon si-4" size={44} />
          <Cloud className="scene-icon si-5" size={28} />
        </div>
      </div>

      {/* Card */}
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-brand">
          <span className="auth-brand-mark"><Sun size={22} /></span>
          <span>Weatherly</span>
        </div>

        {/* Heading */}
        <div className="auth-heading">
          <h1>{mode === 'signin' ? 'Welcome back' : 'Create account'}</h1>
          <p>
            {mode === 'signin'
              ? 'Sign in to access your saved locations and preferences.'
              : 'Join Weatherly to save locations and personalise your forecast.'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={mode === 'signin' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => { setMode('signin'); setError('') }}
            type="button"
          >
            Sign in
          </button>
          <button
            className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => { setMode('signup'); setError('') }}
            type="button"
          >
            Sign up
          </button>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={submit} noValidate>
          {mode === 'signup' && (
            <div className="auth-field">
              <label htmlFor="auth-name">Full name</label>
              <div className="auth-input-wrap">
                <User size={17} />
                <input
                  id="auth-name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  required
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <div className="auth-input-wrap">
              <Mail size={17} />
              <input
                id="auth-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete={mode === 'signin' ? 'email' : 'new-email'}
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-input-wrap">
              <Lock size={17} />
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button
            className={loading ? 'auth-submit loading' : 'auth-submit'}
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-spinner" />
            ) : (
              <>
                {mode === 'signin' ? 'Sign in' : 'Create account'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? 'New to Weatherly?' : 'Already have an account?'}
          {' '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError('') }}
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>

        {/* Feature pills */}
        <div className="auth-features">
          <span>🌍 Global cities</span>
          <span>📍 Saved places</span>
          <span>🔔 Weather alerts</span>
          <span>🌙 Dark mode</span>
        </div>
      </div>
    </div>
  )
}
