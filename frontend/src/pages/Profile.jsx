import { useEffect, useState } from 'react'
import { getMe } from '../services/authService'
import { updateProfile, upsertGameProfile, getUserProfile } from '../services/userService'
import { getMyGames } from '../services/gameService'
import { PageLoader, ErrorMessage, StatCard } from '../components/UI'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user: authUser, login, token } = useAuth()

  const [profile, setProfile]   = useState(null)
  const [games, setGames]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm]         = useState({})
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, gamesRes] = await Promise.all([getMe(), getMyGames()])
        const p = meRes.data.user
        setProfile(p)
        setForm({
          username: p.username || '',
          bio:      p.bio      || '',
          country:  p.country  || '',
          region:   p.region   || '',
        })
        setGames(gamesRes.data.games || [])
      } catch {
        setError('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await updateProfile(form)
      const updated = res.data.user
      setProfile(p => ({ ...p, ...updated }))
      // Keep auth context in sync
      login({ ...authUser, username: updated.username }, token)
      setEditMode(false)
      showToast('Profile updated!')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoader />

  const totalMatches  = games.reduce((s, g) => s + (g.matches_played || 0), 0)
  const avgWinRate    = games.length
    ? (games.reduce((s, g) => s + Number(g.win_rate || 0), 0) / games.length).toFixed(1)
    : null
  const avgElo        = games.length
    ? Math.round(games.reduce((s, g) => s + (g.elo_rating || 1000), 0) / games.length)
    : null

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-red/30 text-white text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">
          {toast}
        </div>
      )}

      {/* Profile header card */}
      <div className="card mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-red-glow pointer-events-none opacity-50" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-red/20 border-2 border-red/40 flex items-center justify-center text-red font-display font-bold text-3xl shrink-0 glow-red">
            {profile?.username?.[0]?.toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-3xl text-white">{profile?.username}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{profile?.email}</p>
            {profile?.bio && <p className="text-gray-300 text-sm mt-2 max-w-lg">{profile.bio}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {profile?.country && <span className="badge-gray">📍 {profile.country}</span>}
              {profile?.region  && <span className="badge-gray">🌐 {profile.region}</span>}
              <span className="badge-gray">
                Joined {new Date(profile?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>

          <button
            onClick={() => setEditMode(!editMode)}
            className="btn-secondary text-sm shrink-0 self-start"
          >
            {editMode ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="card mb-6 animate-slide-up">
          <h3 className="font-display font-bold text-lg text-white mb-4">Edit Profile</h3>
          <ErrorMessage message={error} />
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Username</label>
              <input className="input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Country</label>
              <input className="input" placeholder="India" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Region</label>
              <input className="input" placeholder="South Asia" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">Bio</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Tell the community about yourself..."
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Matches" value={totalMatches} />
        <StatCard label="Avg Win Rate"  value={avgWinRate ? `${avgWinRate}%` : '—'} />
        <StatCard label="Avg ELO"       value={avgElo} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-card rounded-lg p-1 mb-6 self-start w-fit">
        {['overview', 'games'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${
              activeTab === t ? 'bg-red text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-3 animate-fade-in">
          {games.length === 0 ? (
            <div className="card text-center py-10 text-gray-500">
              No game profiles yet.{' '}
              <a href="/games" className="text-red hover:underline">Add games to your library</a> to see stats here.
            </div>
          ) : (
            games.map(game => (
              <div key={game.game_id} className="card flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{game.game_name}</p>
                  <p className="text-xs text-gray-500">{game.genre}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {game.rank     && <span className="badge-blue">{game.rank}</span>}
                  {game.role     && <span className="badge-gray">{game.role}</span>}
                  {game.elo_rating && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">ELO</p>
                      <p className="font-bold text-white text-sm">{game.elo_rating}</p>
                    </div>
                  )}
                  {game.win_rate && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Win Rate</p>
                      <p className="font-bold text-red text-sm">{Number(game.win_rate).toFixed(1)}%</p>
                    </div>
                  )}
                  {game.matches_played > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Matches</p>
                      <p className="font-bold text-white text-sm">{game.matches_played}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Games tab */}
      {activeTab === 'games' && (
        <div className="space-y-3 animate-fade-in">
          {games.length === 0 ? (
            <div className="card text-center py-10 text-gray-500">
              No games in library. <a href="/games" className="text-red hover:underline">Browse games →</a>
            </div>
          ) : (
            games.map(game => (
              <div key={game.game_id} className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-navy flex items-center justify-center text-xl">🎮</div>
                <div>
                  <p className="font-semibold text-white">{game.game_name}</p>
                  <p className="text-xs text-gray-500">{game.developer || game.genre}</p>
                </div>
                {game.rank && <span className="ml-auto badge-blue">{game.rank}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
