import API from '../api/api'

export const getTournaments         = (params)         => API.get('/tournaments', { params })
export const getTournamentById      = (id)             => API.get(`/tournaments/${id}`)
export const createTournament       = (data)           => API.post('/tournaments', data)
export const registerForTournament  = (id, data)       => API.post(`/tournaments/${id}/register`, data)
export const updateTournamentStatus = (id, status)     => API.patch(`/tournaments/${id}/status`, { status })
export const deleteTournament       = (id)             => API.delete(`/archive/tournaments/${id}`)
export const getFeaturedTournaments = ()              => API.get('/tournaments/featured')

// Check-in (attendance)
export const getCheckIn          = (id)                 => API.get(`/tournaments/${id}/check-in`)
export const setCheckInOpen      = (id, open)           => API.patch(`/tournaments/${id}/check-in`, { open })
export const checkInTeam         = (id, team_id)        => API.post(`/tournaments/${id}/check-in`, { team_id })
export const setTeamCheckIn      = (id, teamId, checked_in) => API.patch(`/tournaments/${id}/check-in/teams/${teamId}`, { checked_in })
export const finalizeCheckIn     = (id)                 => API.post(`/tournaments/${id}/check-in/finalize`)
