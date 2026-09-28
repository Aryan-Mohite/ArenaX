import API from '../api/api'

export const getMyReferralCode = () => API.get('/referrals/mine/code')
export const getMyReferrals    = () => API.get('/referrals/mine')
