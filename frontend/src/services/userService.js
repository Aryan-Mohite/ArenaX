import API from '../api/api'

export const getUserProfile    = (id)       => API.get(`/users/${id}`)
export const updateProfile     = (data)     => API.put('/users/me', data)
export const upsertGameProfile = (data)     => API.post('/users/me/game-profile', data)
export const searchUsers       = (q)        => API.get('/users', { params: { q } })
