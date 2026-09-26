import API from '../api/api'

export const getPlans           = (category)  => API.get('/payments/plans', category ? { params: { category } } : undefined)
export const getMySubscription  = ()          => API.get('/payments/subscription')
export const createPaymentOrder = (plan_id)   => API.post('/payments/orders', { plan_id })
export const verifyPayment      = (data)      => API.post('/payments/verify', data)
export const cancelSubscription = ()          => API.post('/payments/cancel')
