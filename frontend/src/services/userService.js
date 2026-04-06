import API from '../api/api'

export const getUserProfile    = (id)       => API.get(`/users/${id}`)
export const updateProfile     = (data)     => API.put('/users/me', data)
export const upsertGameProfile = (data)     => API.post('/users/me/game-profile', data)
export const searchUsers       = (q)        => API.get('/users', { params: { q } })

// ── Follow / Unfollow ──────────────────────────────────────────────────────────
export const followUser        = (id)       => API.post(`/users/${id}/follow`)
export const unfollowUser      = (id)       => API.delete(`/users/${id}/follow`)
export const getFollowStatus   = (id)       => API.get(`/users/${id}/follow-status`)

// ── Own stats (followers / following / community_posts) ───────────────────────
export const getMyStats        = ()         => API.get('/users/me/stats')
