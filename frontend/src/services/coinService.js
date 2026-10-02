import API from '../api/api'

export const getMyCoins        = ()          => API.get('/coins/me')
export const getCoinLedger     = (params)    => API.get('/coins/ledger', { params })
export const redeemReward      = (reward_id) => API.post('/coins/redeem', { reward_id })
export const getMyRedemptions  = ()          => API.get('/coins/redemptions')
