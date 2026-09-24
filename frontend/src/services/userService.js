import API from '../api/api'

export const getUserProfile    = (id)   => API.get(`/users/${id}`)
export const updateProfile     = (data) => API.put('/users/me', data)
export const upsertGameProfile = (data) => API.post('/users/me/game-profile', data)
export const searchUsers       = (q)    => API.get('/users', { params: { q } })
export const getUserActivity   = (id)   => API.get(`/users/${id}/activity`)

// ── In-Game IDs ───────────────────────────────────────────────────────────────
export const getMyGameIds      = ()     => API.get('/users/me/game-ids')
export const updateGameIds     = (data) => API.put('/users/me/game-ids', data)

// ── Follow / Unfollow ─────────────────────────────────────────────────────────
export const followUser        = (id)   => API.post(`/users/${id}/follow`)
export const unfollowUser      = (id)   => API.delete(`/users/${id}/follow`)
export const getFollowStatus   = (id)   => API.get(`/users/${id}/follow-status`)
export const getFollowers      = (id)   => API.get(`/users/${id}/followers`)
export const getFollowing      = (id)   => API.get(`/users/${id}/following`)