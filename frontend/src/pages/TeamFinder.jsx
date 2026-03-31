import { useEffect, useState, useCallback } from 'react'
import { getPosts, createPost, applyToPost } from '../services/teamFinderService'
import { getMyGames } from '../services/gameService'
import TeamFinderCard from '../components/TeamFinderCard'
import { PageLoader, PageHeader, EmptyState, ErrorMessage } from '../components/UI'
import { useAuth } from '../context/AuthContext'

export default function TeamFinder() {
  const { isAuthenticated } = useAuth()

  const [posts, setPosts]     = useState([])
  const [myGames, setMyGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({ game_id: '', region: '' })
  const [error, setError]     = useState('')
  const [toast, setToast]     = useState('')

  const [form, setForm] = useState({
    game_id: '', rank_required: '', role_required: '', region: '', description: '',
  })

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.game_id) params.game_id = filters.game_id
      if (filters.region)  params.region  = filters.region
      const res = await getPosts(params)
      setPosts(res.data.posts || [])
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { loadPosts() }, [loadPosts])

  useEffect(() => {
    if (isAuthenticated) {
      getMyGames()
        .then(res => setMyGames(res.data.games || []))
        .catch(() => {})
    }
  }, [isAuthenticated])

  const handleApply = async (postId) => {
    try {
      await applyToPost(postId, { message: 'I would like to join your team!' })
      showToast('Application sent!')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to apply')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await createPost(form)
      setShowForm(false)
      setForm({ game_id: '', rank_required: '', role_required: '', region: '', description: '' })
      showToast('Post created!')
      loadPosts()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create post')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-red/30 text-white text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">
          {toast}
        </div>
      )}

      <PageHeader
        title="Team Finder"
        subtitle="Find your perfect squad or post a listing to recruit players"
        action={
          isAuthenticated && (
            <button onClick={() => setShowForm(!showForm)} className="btn-primary">
              {showForm ? 'Cancel' : '+ Post Listing'}
            </button>
          )
        }
      />

      {/* Create post form */}
      {showForm && (
        <div className="card mb-8 animate-slide-up">
          <h3 className="font-display font-bold text-lg text-white mb-4">Create a Listing</h3>
          <ErrorMessage message={error} />
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Game *</label>
              <select
                className="input"
                value={form.game_id}
                onChange={e => setForm(f => ({ ...f, game_id: e.target.value }))}
                required
              >
                <option value="">Select game</option>
                {myGames.map(g => (
                  <option key={g.game_id} value={g.game_id}>{g.game_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Region</label>
              <input className="input" placeholder="e.g. South Asia" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Role Required</label>
              <input className="input" placeholder="e.g. IGL, Entry Fragger" value={form.role_required} onChange={e => setForm(f => ({ ...f, role_required: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Rank Required</label>
              <input className="input" placeholder="e.g. Diamond+" value={form.rank_required} onChange={e => setForm(f => ({ ...f, rank_required: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">Description</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Tell players about your team, requirements, schedule..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" className="btn-primary">Publish Listing</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          className="input w-48"
          placeholder="Filter by region..."
          value={filters.region}
          onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}
        />
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <PageLoader />
      ) : posts.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No listings found"
          subtitle="Be the first to post a team finder listing"
          action={isAuthenticated
            ? <button onClick={() => setShowForm(true)} className="btn-primary">Post a Listing</button>
            : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map(post => (
            <TeamFinderCard key={post.post_id} post={post} onApply={handleApply} />
          ))}
        </div>
      )}
    </div>
  )
}
