import API from '../api/api'

export const getLiveStreams    = (params)              => API.get('/streams', { params })
export const goLive           = (data)                => API.post('/streams/go-live', data)
export const endStream        = ()                    => API.patch('/streams/end')
export const updateViewerCount = (id, viewer_count)  => API.patch(`/streams/${id}/viewers`, { viewer_count })
