import API from '../api/api'

export const requestVerification   = ()               => API.post('/organizers/verification-request')
export const getVerificationStatus = ()               => API.get('/organizers/verification-status')

export const getMyTournaments        = ()             => API.get('/tournaments/mine')
export const getMyTournamentsSummary = ()             => API.get('/tournaments/mine/summary')
export const updateTournamentBranding = (id, data)    => API.patch(`/tournaments/${id}/branding`, data)
export const getTournamentAnalytics   = (id)          => API.get(`/tournaments/${id}/analytics`)
export const announceToTournament     = (id, message) => API.post(`/tournaments/${id}/announce`, { message })
