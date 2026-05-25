import axios from 'axios'

// In dev, Vite proxy rewrites /api → localhost:5000.
// In production, set VITE_API_URL=https://yourbackend.com/api in your .env
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global response error handling
API.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only redirect to login on 401 if the user was actually logged in.
    // Avoids kicking guests mid-registration if any auth-adjacent route
    // returns 401 (e.g. expired OTP session).
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default API