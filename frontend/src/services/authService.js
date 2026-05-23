import API from '../api/api'

// Registration (2-step)
export const sendRegisterOtp  = (data) => API.post('/auth/register/send-otp', data)
export const verifyRegisterOtp = (data) => API.post('/auth/register/verify', data)
export const resendRegisterOtp = (data) => API.post('/auth/register/resend-otp', data)

// Login
export const loginUser = (data) => API.post('/auth/login', data)

// Current user
export const getMe = () => API.get('/auth/me')

// Forgot / reset password (3-step)
export const forgotPassword    = (data) => API.post('/auth/forgot-password', data)
export const verifyResetOtp    = (data) => API.post('/auth/forgot-password/verify', data)
export const resetPassword     = (data) => API.post('/auth/forgot-password/reset', data)
