import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import { ErrorMessage } from '../components/UI'

export default function Register() {
  const { login }   = useAuth()
  const navigate    = useNavigate()

  const [form, setForm]       = useState({ username: '', email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters')
    }
    setLoading(true)
    setError('')
    try {
      const res = await registerUser(form)
      login(res.data.user, res.data.token)
      navigate('/games')  // Send to games page to pick favourites right away
    } catch (err) {
      const errs = err.response?.data?.errors
      setError(errs ? errs[0]?.message : (err.response?.data?.message || 'Registration failed'))
    } finally {
      setLoading(false)
    }
  }

  const requirements = [
    { label: '8+ characters',    met: form.password.length >= 8 },
    { label: 'One uppercase',     met: /[A-Z]/.test(form.password) },
    { label: 'One number',        met: /[0-9]/.test(form.password) },
  ]

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-4xl text-white tracking-wide mb-2">
            Join ArenaX
          </h1>
          <p className="text-gray-400">Create your Player Card</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <ErrorMessage message={error} />

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Username</label>
              <input
                name="username"
                placeholder="your_gamertag"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="username"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                className="input"
              />
              {form.password.length > 0 && (
                <div className="flex gap-3 mt-2">
                  {requirements.map(r => (
                    <span key={r.label} className={`text-xs flex items-center gap-1 ${r.met ? 'text-green-400' : 'text-gray-600'}`}>
                      <span>{r.met ? '✓' : '○'}</span> {r.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enlisting...' : 'Enlist Now'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-red hover:text-red-light font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
