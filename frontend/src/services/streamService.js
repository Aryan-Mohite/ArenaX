import API from '../api/api'

export const getLiveStreams  = (params) => API.get('/streams', { params })
export const goLive         = (data)   => API.post('/streams/go-live', data)
export const endStream      = ()       => API.patch('/streams/end')
