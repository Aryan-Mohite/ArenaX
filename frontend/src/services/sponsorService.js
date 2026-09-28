import API from '../api/api'

export const applyForSponsor     = (data) => API.post('/sponsors/apply', data)
export const getMySponsorProfile = ()     => API.get('/sponsors/me')
