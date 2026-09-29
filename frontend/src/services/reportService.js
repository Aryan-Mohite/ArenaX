import API from '../api/api'

// §9: player-side and organizer-side abuse reports
export const reportUser       = (userId, data)       => API.post(`/reports/user/${userId}`, data)
export const reportTournament = (tournamentId, data) => API.post(`/reports/tournament/${tournamentId}`, data)
