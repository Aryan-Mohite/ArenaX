import API from '../api/api'

// ─── Gamer DNA profile ────────────────────────────────────────────────────────
export const getMyDna      = ()     => API.get('/gamer-dna/me')
export const saveMyDna     = (data) => API.post('/gamer-dna', data)

// ─── Swipe candidates & actions ───────────────────────────────────────────────
export const getCandidates = (params) => API.get('/gamer-dna/candidates', { params })
export const swipeUser     = (target_id, action) => API.post('/gamer-dna/swipe', { target_id, action })

// ─── Matches ──────────────────────────────────────────────────────────────────
export const getMyMatches  = () => API.get('/gamer-dna/matches')

// ─── Post-match karma rating ──────────────────────────────────────────────────
export const rateTeammate   = (matchId, score, tag = null) =>
  API.post(`/gamer-dna/matches/${matchId}/rate`, { score, tag })
export const getMatchRating = (matchId) =>
  API.get(`/gamer-dna/matches/${matchId}/rating`)
