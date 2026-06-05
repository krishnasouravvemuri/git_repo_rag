import { useState } from 'react'
import { login, register, setSession } from './api'

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = mode === 'login' ? login : register
      const data = await fn(email.trim().toLowerCase(), password)
      setSession(data.access, data.email)
      onAuth(data.email)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container narrow">
      <h1>Git Repo RAG</h1>
      <section className="card">
        <h2>{mode === 'login' ? 'Log In' : 'Register'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Register'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="switch">
          {mode === 'login' ? "No account?" : 'Have an account?'}{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
            }}
          >
            {mode === 'login' ? 'Register' : 'Log In'}
          </button>
        </p>
      </section>
    </div>
  )
}
