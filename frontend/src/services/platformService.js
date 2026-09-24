import API from '../api/api'

export const getPlatformStats = () => API.get('/platform/stats')
