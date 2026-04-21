import API from '../api/api'

export const getPosts              = (params)       => API.get('/teamfinder', { params })
export const createPost            = (data)         => API.post('/teamfinder', data)
export const applyToPost           = (id, data)     => API.post(`/teamfinder/${id}/apply`, data)
export const closePost             = (id)           => API.patch(`/teamfinder/${id}/close`)
export const getApplications       = (id)           => API.get(`/teamfinder/${id}/applications`)
export const getMyApplications     = ()             => API.get('/teamfinder/my-applications')
export const draftAcceptApplication = (postId, appId) => API.patch(`/teamfinder/${postId}/applications/${appId}/draft-accept`)
export const finalAcceptApplication = (postId, appId) => API.patch(`/teamfinder/${postId}/applications/${appId}/final-accept`)
export const rejectApplication     = (postId, appId) => API.patch(`/teamfinder/${postId}/applications/${appId}/reject`)
