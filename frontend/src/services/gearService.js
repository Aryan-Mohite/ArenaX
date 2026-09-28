import API from '../api/api'

export const getGear = (category) => API.get('/gear', category ? { params: { category } } : undefined)
// Click-tracked affiliate redirect — link to this URL, don't fetch it.
export const gearRedirectUrl = (id) => `/api/gear/${id}/redirect`
