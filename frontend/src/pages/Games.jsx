import { useEffect, useState, useCallback } from 'react'
import { getGames, getMyGames, addFavouriteGame, removeFavGame } from '../services/gameService'
import GameCard from '../components/GameCard'
import { PageLoader, PageHeader, EmptyState, ErrorMessage } from '../components/UI'
import { useAuth } from '../context/AuthContext'

// ─── Genre accent colors ──────────────────────────────────────────────────────
const GENRE_COLORS = {
  'Tactical FPS':  '#ff4655',
  'FPS':           '#ff4655',
  'MOBA':          '#c89b3c',
  'Battle Royale': '#0082ff',
  'Sports':        '#1D9E75',
  'Fighting':      '#fc4b08',
  'RPG':           '#a855f7',
  'Strategy':      '#14b8a6',
  'Simulation':    '#f4a523',
  'default':       '#888780',
}
const genreColor = (g) => GENRE_COLORS[g] || GENRE_COLORS.default

// ─── Fallback games (used only if the backend is completely unreachable) ──────
const FALLBACK_GAMES = [
  { game_id: 1,  game_name: 'Valorant',          genre: 'Tactical FPS',  developer: 'Riot Games',  cover_color: ['#ff4655','#1a0a0c'] },
  { game_id: 2,  game_name: 'CS2',               genre: 'FPS',           developer: 'Valve',       cover_color: ['#f4a523','#1a1000'] },
  { game_id: 3,  game_name: 'League of Legends', genre: 'MOBA',          developer: 'Riot Games',  cover_color: ['#c89b3c','#1a1500'] },
  { game_id: 4,  game_name: 'Dota 2',            genre: 'MOBA',          developer: 'Valve',       cover_color: ['#c23c2a','#1a0800'] },
  { game_id: 5,  game_name: 'PUBG',              genre: 'Battle Royale', developer: 'Krafton',     cover_color: ['#f4a523','#1a1200'] },
  { game_id: 6,  game_name: 'Fortnite',          genre: 'Battle Royale', developer: 'Epic Games',  cover_color: ['#00d4ff','#001a20'] },
  { game_id: 7,  game_name: 'Apex Legends',      genre: 'Battle Royale', developer: 'EA Respawn',  cover_color: ['#fc4b08','#1a0a00'] },
  { game_id: 8,  game_name: 'Overwatch 2',       genre: 'FPS',           developer: 'Blizzard',    cover_color: ['#f99e1a','#1a1100'] },
  { game_id: 9,  game_name: 'Rocket League',     genre: 'Sports',        developer: 'Psyonix',     cover_color: ['#0082ff','#000f1a'] },
  { game_id: 10, game_name: 'Street Fighter 6',  genre: 'Fighting',      developer: 'Capcom',      cover_color: ['#fc4b08','#1a0500'] },
]

// ─── Popular spotlight (shown while DB may be empty, uses RAWG data if present) ──
const POPULAR_IDS = [1, 2, 3, 6, 7] // game_ids that map to top esports titles

// ─── Skeleton card ────────────────────────────────────────────────────────────
function GameSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden animate-pulse" style={{ background: '#1a2340', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="h-44 bg-surface-border/30" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 rounded bg-surface-border/40" />
        <div className="h-2.5 w-1/2 rounded bg-surface-border/40" />
        <div className="flex gap-1 pt-1">
          {[...Array(5)].map((_, i) => <div key={i} className="w-2.5 h-2.5 rounded-sm bg-surface-border/40" />)}
        </div>
      </div>
    </div>
  )
}

// ─── Cover art for spotlight (uses real image if available) ───────────────────
function SpotlightCover({ game }) {
  const [err, setErr] = useState(false)
  const color  = genreColor(game.genre)
  const colors = game.cover_color || [color, '#0a0a0a']
  const abbr   = game.game_name.split(' ').map(w => w[0]).join('').slice(0,3).toUpperCase()
  const src    = !err && (game.cover_image || game.icon)

  return (
    <div className="relative w-full h-40 overflow-hidden">
      {src ? (
        <img src={src} alt={game.game_name}
          className="w-full h-full object-cover"
          onError={() => setErr(true)} />
      ) : (
        <div className="w-full h-full flex items-center justify-center"
          style={{ background: `linear-gradient(160deg, ${colors[0]}40 0%, ${colors[1]} 100%)` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm"
            style={{ background: color+'25', border: `1.5px solid ${color}60`, color }}>
            {abbr}
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #1a2340, transparent)' }} />
    </div>
  )
}

// ─── Spotlight card (top 5 popular games) ────────────────────────────────────
function SpotlightCard({ game, rank }) {
  const color = genreColor(game.genre)
  return (
    <div className="relative rounded-xl overflow-hidden flex-shrink-0 w-36 transition-transform duration-200 hover:-translate-y-1"
      style={{ border: `1px solid ${color}30`, background: '#1a2340' }}>
      <SpotlightCover game={game} />

      {/* Rank badge */}
      <div className="absolute top-2 left-2 z-20 w-6 h-6 rounded-full flex items-center justify-center font-display font-black text-xs text-white"
        style={{ background: color }}>
        {rank}
      </div>

      {/* Metacritic score */}
      {game.metacritic && (
        <div className="absolute top-2 right-2 z-20">
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
            style={{
              background: game.metacritic >= 75 ? '#1D9E7520' : '#f4a52320',
              color: game.metacritic >= 75 ? '#1D9E75' : '#f4a523',
              border: `1px solid ${game.metacritic >= 75 ? '#1D9E7540' : '#f4a52340'}`,
            }}>
            {game.metacritic}
          </span>
        </div>
      )}

      {/* Rating below image */}
      {game.rating && (
        <div className="absolute bottom-[44px] left-2 z-20">
          <span className="text-[9px] font-bold text-yellow-400">
            {'★'.repeat(Math.round(game.rating))}{'☆'.repeat(5 - Math.round(game.rating))}
          </span>
        </div>
      )}

      <div className="p-2">
        <p className="text-white text-[11px] font-semibold truncate">{game.game_name}</p>
        <p className="text-gray-500 text-[9px]">{game.genre}</p>
      </div>
    </div>
  )
}

// ─── Active filter chip ───────────────────────────────────────────────────────
function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-red/30 text-red bg-red/10">
      {label}
      <button onClick={onRemove} className="hover:opacity-70 leading-none">×</button>
    </span>
  )
}

// ─── Sync status banner ───────────────────────────────────────────────────────
function SyncBanner({ gameCount, onSync, syncing }) {
  if (gameCount > 5) return null // DB already has games — no banner needed
  return (
    <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="text-yellow-400 text-sm font-semibold">Games library is empty</p>
        <p className="text-gray-400 text-xs mt-0.5">
          Run a one-time sync to populate your DB with real game data from RAWG.
        </p>
      </div>
      <button
        onClick={onSync}
        disabled={syncing}
        className="shrink-0 text-xs px-4 py-2 rounded-lg font-bold transition-all"
        style={{ background: '#f4a52320', color: '#f4a523', border: '1px solid #f4a52340' }}
      >
        {syncing ? '⏳ Syncing…' : '⚡ Sync from RAWG'}
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Games() {
  const { isAuthenticated } = useAuth()

  const [games,      setGames]      = useState([])
  const [myGameIds,  setMyGameIds]  = useState(new Set())
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [genre,      setGenre]      = useState('')
  const [tab,        setTab]        = useState('all')
  const [error,      setError]      = useState('')
  const [toast,      setToast]      = useState('')
  const [sort,       setSort]       = useState('rating')
  const [page,       setPage]       = useState(1)
  const [syncing,    setSyncing]    = useState(false)
  const PAGE_SIZE = 16

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // ── Load games from backend ──────────────────────────────────────────────
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

  useEffect(() => { setPage(1) }, [genre, search, tab, sort])

  // ── RAWG sync ────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true)
    try {
      const { syncGamesFromRawg } = await import('../services/gameService')
      await syncGamesFromRawg()
      showToast('✅ Games synced from RAWG!')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Sync failed — check RAWG_API_KEY in backend .env')
    } finally {
      setSyncing(false)
    }
  }

  // ── Add / remove favourites ──────────────────────────────────────────────
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

  // ── Derived data ─────────────────────────────────────────────────────────
  const genres      = [...new Set(games.map(g => g.genre).filter(Boolean))]
  const myGames     = games.filter(g => myGameIds.has(g.game_id))
  const baseGames   = tab === 'my' ? myGames : games

  const sortedGames = [...baseGames].sort((a, b) => {
    if (sort === 'az')     return a.game_name.localeCompare(b.game_name)
    if (sort === 'za')     return b.game_name.localeCompare(a.game_name)
    if (sort === 'rating') return (b.rating || 0) - (a.rating || 0)
    if (sort === 'meta')   return (b.metacritic || 0) - (a.metacritic || 0)
    return 0
  })

  const totalPages   = Math.ceil(sortedGames.length / PAGE_SIZE)
  const displayGames = sortedGames.slice(0, page * PAGE_SIZE)
  const hasMore      = page < totalPages

  // Top 5 rated games for the spotlight
  const spotlightGames = [...games]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5)

  return (
    <div className="animate-fade-in">

      {/* ── Hero banner ── */}
      <div className="relative border-b border-surface-border bg-surface-card/40 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 20% 50%, #ff465512 0%, transparent 60%)' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 relative">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold tracking-widest text-gray-500 uppercase">eSports Platform</span>
                <span className="h-px w-8 bg-surface-border" />
                <span className="text-xs text-gray-600">Games Library</span>
              </div>
              <h1 className="font-display font-bold text-4xl md:text-5xl text-white tracking-tight">
                ALL <span className="text-gradient">GAMES</span>
              </h1>
              <p className="text-gray-400 mt-2 text-sm">
                Pick your games to get personalised tournament and team finder results
              </p>
              {/* RAWG attribution */}
              <p className="text-gray-600 text-[10px] mt-1 flex items-center gap-1">
                <span>Game data powered by</span>
                <a href="https://rawg.io" target="_blank" rel="noreferrer"
                  className="text-gray-500 hover:text-white transition-colors underline underline-offset-2">
                  RAWG
                </a>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-2 rounded-xl border border-surface-border bg-surface-card/60">
                <p className="font-display font-bold text-xl text-white">{games.length || '25'}+</p>
                <p className="text-xs text-gray-500">Games</p>
              </div>
              <div className="text-center px-4 py-2 rounded-xl border border-surface-border bg-surface-card/60">
                <p className="font-display font-bold text-xl text-white">{myGameIds.size}</p>
                <p className="text-xs text-gray-500">In Library</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sync banner (only shows when DB has < 6 games) ── */}
      {!loading && (
        <SyncBanner gameCount={games.length} onSync={handleSync} syncing={syncing} />
      )}

      {/* ── Popular Games Spotlight ── */}
      <div className="border-b border-surface-border bg-surface-card/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-4 bg-red rounded-full inline-block" />
              Top Rated Games
            </h2>
            <span className="text-xs text-gray-500">By RAWG community rating</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {loading
              ? [...Array(5)].map((_, i) => (
                  <div key={i} className="w-36 flex-shrink-0 rounded-xl overflow-hidden animate-pulse"
                    style={{ background: '#1a2340', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="h-40 bg-surface-border/30" />
                    <div className="p-2 space-y-1">
                      <div className="h-2.5 w-3/4 rounded bg-surface-border/40" />
                      <div className="h-2 w-1/2 rounded bg-surface-border/40" />
                    </div>
                  </div>
                ))
              : spotlightGames.map((game, i) => (
                  <SpotlightCard key={game.game_id} game={game} rank={i + 1} />
                ))
            }
          </div>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-red/30 text-white text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">
          {toast}
        </div>
      )}

      <ErrorMessage message={error} />

      {/* ── Main layout: grid + sidebar ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-8 items-start">

          {/* ── Left: main content ── */}
          <div className="flex-1 min-w-0">

            {/* Tabs + search */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="flex gap-1 bg-surface-card rounded-lg p-1 self-start shrink-0">
                {['all', 'my'].map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                      tab === t ? 'bg-red text-white' : 'text-gray-400 hover:text-white'
                    }`}>
                    {t === 'all' ? 'All Games' : 'My Library'}
                    {t === 'my' && myGameIds.size > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === 'my' ? 'bg-white/20 text-white' : 'bg-red/20 text-red'}`}>
                        {myGameIds.size}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <input className="input flex-1" placeholder="Search games…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Genre pills */}
            <div className="flex gap-2 flex-wrap mb-4">
              <button onClick={() => setGenre('')}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                  genre === '' ? 'bg-red text-white border-red' : 'border-surface-border text-gray-400 hover:text-white hover:border-gray-500'
                }`}>All</button>
              {genres.map(g => (
                <button key={g} onClick={() => setGenre(genre === g ? '' : g)}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold border transition-all"
                  style={genre === g
                    ? { background: genreColor(g), color: '#fff', borderColor: genreColor(g) }
                    : { borderColor: 'rgba(255,255,255,0.1)', color: '#9ca3af' }
                  }>{g}</button>
              ))}
            </div>

            {/* Filter chips + count + sort */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {!loading && (
                  <span className="text-xs text-gray-500">
                    Showing <span className="text-white font-semibold">{displayGames.length}</span> of <span className="text-white font-semibold">{sortedGames.length}</span> games
                  </span>
                )}
                {genre  && <FilterChip label={genre} onRemove={() => setGenre('')} />}
                {search && <FilterChip label={`"${search}"`} onRemove={() => setSearch('')} />}
              </div>
              <select className="input text-xs py-1.5 h-auto w-auto pr-8"
                value={sort} onChange={e => setSort(e.target.value)}>
                <option value="rating">Top Rated</option>
                <option value="meta">Metacritic</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
              </select>
            </div>

            {/* Game grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <GameSkeleton key={i} />)}
              </div>
            ) : displayGames.length === 0 ? (
              <EmptyState
                icon="🎮"
                title={tab === 'my' ? 'Your library is empty' : 'No games found'}
                subtitle={tab === 'my' ? 'Add games from the All Games tab' : 'Try a different search or genre'}
                action={tab === 'my'
                  ? <button onClick={() => setTab('all')} className="btn-primary">Browse Games</button>
                  : <button onClick={() => { setSearch(''); setGenre('') }} className="btn-secondary">Clear filters</button>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {displayGames.map(game => (
                    <GameCard
                      key={game.game_id}
                      game={game}
                      isFav={myGameIds.has(game.game_id)}
                      onAdd={isAuthenticated ? handleAdd : undefined}
                      onRemove={isAuthenticated ? handleRemove : undefined}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <button onClick={() => setPage(p => p + 1)}
                      className="btn-secondary px-10 py-3 text-sm flex items-center gap-2">
                      Load more
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Right: sticky sidebar ── */}
          <div className="hidden lg:block w-56 shrink-0 sticky top-6 space-y-4">

            {/* Genre filter */}
            <div className="card py-4 px-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Genre</p>
              <div className="space-y-1">
                <button onClick={() => setGenre('')}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-all ${genre === '' ? 'bg-red/15 text-red font-semibold' : 'text-gray-400 hover:text-white hover:bg-surface-border/30'}`}>
                  All genres
                </button>
                {genres.map(g => (
                  <button key={g} onClick={() => setGenre(genre === g ? '' : g)}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg transition-all flex items-center justify-between"
                    style={genre === g
                      ? { background: genreColor(g) + '20', color: genreColor(g), fontWeight: 600 }
                      : { color: '#9ca3af' }
                    }>
                    <span>{g}</span>
                    {genre === g && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Library summary */}
            {isAuthenticated && myGameIds.size > 0 && (
              <div className="card py-4 px-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">My Library</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4655" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg leading-none">{myGameIds.size}</p>
                    <p className="text-gray-500 text-xs">games saved</p>
                  </div>
                </div>
                <button onClick={() => setTab('my')} className="w-full btn-ghost text-xs mt-3 py-1.5">
                  View library →
                </button>
              </div>
            )}

            {/* Platform stats */}
            <div className="card py-4 px-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Platform</p>
              <div className="space-y-2">
                {[
                  { label: 'Total games', value: games.length || '25+' },
                  { label: 'Genres',      value: genres.length || '8'  },
                  { label: 'Tournaments', value: '1,200+'              },
                ].map(s => (
                  <div key={s.label} className="flex justify-between text-xs">
                    <span className="text-gray-500">{s.label}</span>
                    <span className="text-white font-semibold">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RAWG attribution card */}
            <div className="card py-3 px-4">
              <p className="text-[10px] text-gray-600 leading-relaxed">
                Game data & ratings provided by{' '}
                <a href="https://rawg.io" target="_blank" rel="noreferrer"
                  className="text-gray-500 hover:text-white transition-colors underline">
                  RAWG.io
                </a>
                {' '}— the largest video game database.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="relative border-t border-surface-border bg-surface-card/40 overflow-hidden mt-8">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 120%, #ff465510 0%, transparent 60%)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M20 4L36 13V27L20 36L4 27V13L20 4Z" stroke="#ff4655" strokeWidth="1.5" fill="none" opacity="0.5"/>
              <path d="M20 10L30 16V24L20 30L10 24V16L20 10Z" fill="#ff4655" fillOpacity="0.12"/>
              <circle cx="20" cy="20" r="4" fill="#ff4655"/>
              <line x1="20" y1="10" x2="20" y2="14" stroke="#ff4655" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="20" y1="26" x2="20" y2="30" stroke="#ff4655" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10" y1="20" x2="14" y2="20" stroke="#ff4655" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="26" y1="20" x2="30" y2="20" stroke="#ff4655" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div className="flex items-baseline gap-[2px]">
              <span className="font-display font-bold text-2xl text-white tracking-tight">Arena</span>
              <span className="font-display font-bold text-2xl tracking-tight text-red">X</span>
            </div>
          </div>
          <div className="w-16 h-px bg-surface-border" />
          <p className="text-sm text-gray-400 text-center">
            Copyright © {new Date().getFullYear()} ArenaX. All Rights Reserved.
          </p>
          <p className="text-xs text-gray-600 text-center max-w-xl leading-relaxed">
            ArenaX is an independent eSports platform. All trademarks, game names, and logos
            are the property of their respective owners. Prize pools are subject to tournament rules.
          </p>
        </div>
      </footer>

    </div>
  )
}
