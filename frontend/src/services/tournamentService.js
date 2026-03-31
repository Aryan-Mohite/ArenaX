import API from '../api/api'

export const getTournaments       = (params) => API.get('/tournaments', { params })
export const getTournamentById    = (id)     => API.get(`/tournaments/${id}`)
export const createTournament     = (data)   => API.post('/tournaments', data)
export const registerForTournament = (id, data) => API.post(`/tournaments/${id}/register`, data)
