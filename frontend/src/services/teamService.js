import API from '../api/api'

// ── Teams ──────────────────────────────────────────────────────────────────────
export const getMyTeams   = ()           => API.get('/teams/mine')
export const createTeam   = (data)       => API.post('/teams', data)
export const getTeam      = (id)         => API.get(`/teams/${id}`)
export const deleteTeam   = (id)         => API.delete(`/teams/${id}`)
export const kickMember   = (teamId, userId) => API.delete(`/teams/${teamId}/members/${userId}`)
