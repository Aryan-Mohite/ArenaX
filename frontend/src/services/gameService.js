import API from '../api/api'

// ─── Existing endpoints (unchanged) ──────────────────────────────────────────
export const getGames         = (params)  => API.get('/games', { params })
export const getGameById      = (id)      => API.get(`/games/${id}`)
export const getMyGames       = ()        => API.get('/games/my')
export const addFavouriteGame = (data)    => API.post('/games/my', data)
export const removeFavGame    = (game_id) => API.delete(`/games/my/${game_id}`)

// ─── RAWG proxy endpoints (API key stays on the server) ──────────────────────
// Live search against RAWG — used for the search-as-you-type feature
export const rawgSearch     = (q, page = 1, pageSize = 20) =>
  API.get('/games/rawg/search', { params: { q, page, page_size: pageSize } })

// Full detail for a single game by slug
export const rawgGameDetail = (slug) => API.get(`/games/rawg/${slug}`)

// Trigger a DB sync from RAWG (admin / first-time setup)
export const syncGamesFromRawg = (syncSecret) =>
  API.post('/games/sync', {}, {
    headers: syncSecret ? { 'X-Sync-Secret': syncSecret } : {},
  })
