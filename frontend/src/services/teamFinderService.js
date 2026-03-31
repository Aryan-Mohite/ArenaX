import API from '../api/api'

export const getPosts            = (params) => API.get('/teamfinder', { params })
export const createPost          = (data)   => API.post('/teamfinder', data)
export const applyToPost         = (id, data) => API.post(`/teamfinder/${id}/apply`, data)
export const closePost           = (id)     => API.patch(`/teamfinder/${id}/close`)
export const getApplications     = (id)     => API.get(`/teamfinder/${id}/applications`)
