import API from '../api/api'

export const getGames          = (params)   => API.get('/games', { params })
export const getGameById       = (id)       => API.get(`/games/${id}`)
export const getMyGames        = ()         => API.get('/games/my')
export const addFavouriteGame  = (data)     => API.post('/games/my', data)
export const removeFavGame     = (game_id)  => API.delete(`/games/my/${game_id}`)
