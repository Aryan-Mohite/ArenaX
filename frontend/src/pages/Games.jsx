import { useEffect, useState, useCallback } from 'react'
import { getGames, getMyGames, addFavouriteGame, removeFavGame } from '../services/gameService'
import GameCard from '../components/GameCard'
import { PageLoader, PageHeader, EmptyState, ErrorMessage } from '../components/UI'
import { useAuth } from '../context/AuthContext'

const FALLBACK_GAMES = [
  { game_id: 1, game_name: 'Valorant',          genre: 'Tactical FPS',  developer: 'Riot Games' },
  { game_id: 2, game_name: 'CS2',               genre: 'FPS',           developer: 'Valve' },
  { game_id: 3, game_name: 'League of Legends', genre: 'MOBA',          developer: 'Riot Games' },
  { game_id: 4, game_name: 'Dota 2',            genre: 'MOBA',          developer: 'Valve' },
  { game_id: 5, game_name: 'PUBG',              genre: 'Battle Royale',  developer: 'Krafton' },
  { game_id: 6, game_name: 'Fortnite',          genre: 'Battle Royale',  developer: 'Epic Games' },
]

export default function Games() {
  const { isAuthenticated } = useAuth()

  const [games, setGames]       = useState([])
  const [myGameIds, setMyGameIds] = useState(new Set())
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [genre, setGenre]       = useState('')
  const [tab, setTab]           = useState('all')   // 'all' | 'my'
  const [error, setError]       = useState('')
  const [toast, setToast]       = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (genre)  params.genre = genre
      if (search) params.q     = search

      const [gRes, myRes] = await Promise.allSettled([
        getGames(params),
        isAuthenticated ? getMyGames() : Promise.resolve(null),
      ])

      const gameList = gRes.status === 'fulfilled'
        ? (gRes.value.data.games || [])
        : FALLBACK_GAMES

      setGames(gameList.length ? gameList : FALLBACK_GAMES)

      if (myRes.status === 'fulfilled' && myRes.value) {
        setMyGameIds(new Set((myRes.value.data.games || []).map(g => g.game_id)))
      }
    } catch {
      setGames(FALLBACK_GAMES)
    } finally {
      setLoading(false)
    }
  }, [genre, search, isAuthenticated])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const handleAdd = async (game) => {
    if (!isAuthenticated) return
    try {
      await addFavouriteGame({ game_id: game.game_id })
      setMyGameIds(prev => new Set([...prev, game.game_id]))
      showToast(`${game.game_name} added to your library`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add game')
    }
  }

  const handleRemove = async (game_id) => {
    try {
      await removeFavGame(game_id)
      setMyGameIds(prev => { const s = new Set(prev); s.delete(game_id); return s })
      showToast('Game removed from library')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove game')
    }
  }

  const genres = [...new Set(games.map(g => g.genre).filter(Boolean))]
  const myGames = games.filter(g => myGameIds.has(g.game_id))
  const displayGames = tab === 'my' ? myGames : games

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <PageHeader
        title="Games"
        subtitle="Pick your games to get personalised tournament and team finder results"
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-red/30 text-white text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">
          {toast}
        </div>
      )}

      <ErrorMessage message={error} />

      {/* Tabs + filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 mt-4">
        <div className="flex gap-1 bg-surface-card rounded-lg p-1 self-start">
          {['all', 'my'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-red text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'all' ? 'All Games' : `My Library (${myGameIds.size})`}
            </button>
          ))}
        </div>

        <div className="flex gap-3 flex-1">
          <input
            className="input flex-1"
            placeholder="Search games..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="input w-44"
            value={genre}
            onChange={e => setGenre(e.target.value)}
          >
            <option value="">All genres</option>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : displayGames.length === 0 ? (
        <EmptyState
          icon="🎮"
          title={tab === 'my' ? "Your library is empty" : "No games found"}
          subtitle={tab === 'my' ? "Add games from the All Games tab" : "Try a different search"}
          action={tab === 'my' ? <button onClick={() => setTab('all')} className="btn-primary">Browse Games</button> : null}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {displayGames.map(game => (
            <GameCard
              key={game.game_id}
              game={game}
              isFav={myGameIds.has(game.game_id)}
              onAdd={handleAdd}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}
