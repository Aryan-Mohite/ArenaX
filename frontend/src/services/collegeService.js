import API from '../api/api'

export const listColleges          = (params) => API.get('/colleges', { params })
export const getCollegeLeaderboard = (limit)  => API.get('/colleges/leaderboard', limit ? { params: { limit } } : undefined)
export const getCollegeBySlug      = (slug)   => API.get(`/colleges/${slug}`)
export const claimCollege          = (data)   => API.post('/colleges/claim', data)
export const joinCollege           = (id)     => API.post(`/colleges/${id}/join`)
export const leaveCollege          = ()       => API.post('/colleges/leave')
export const getCollegeStandings   = (tournamentId) => API.get(`/tournaments/${tournamentId}/college-standings`)
