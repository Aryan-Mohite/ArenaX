import { useEffect, useState, useCallback } from 'react'
import { getPosts, createPost, applyToPost } from '../services/teamFinderService'
import { getMyGames } from '../services/gameService'
import { ErrorMessage } from '../components/UI'
import { useAuth } from '../context/AuthContext'

function GridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div style={{
        position:'absolute',inset:0,
        backgroundImage:'radial-gradient(circle,rgba(255,70,85,0.12) 1px,transparent 1px)',
        backgroundSize:'36px 36px',
        maskImage:'radial-gradient(ellipse 80% 60% at 50% 0%,black 40%,transparent 100%)',
      }}/>
      <div style={{
        position:'absolute',top:'-120px',left:'50%',transform:'translateX(-50%)',
        width:'700px',height:'300px',
        background:'radial-gradient(ellipse,rgba(255,70,85,0.18) 0%,transparent 70%)',
      }}/>
    </div>
  )
}

function PushRequestModal({ post, onClose, onSubmit }) {
  const [msg, setMsg]         = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async () => {
    setLoading(true)
    await onSubmit(post.post_id, msg || 'I would like to join your team!')
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{backdropFilter:'blur(8px)',background:'rgba(2,6,23,0.75)'}}>
      <div className="animate-slide-up w-full max-w-md rounded-2xl border border-surface-border bg-surface-card"
        style={{boxShadow:'0 0 0 1px rgba(255,70,85,0.15),0 24px 80px rgba(0,0,0,0.6)'}}>
        <div className="relative overflow-hidden rounded-t-2xl px-6 pt-6 pb-4"
          style={{background:'linear-gradient(135deg,rgba(255,70,85,0.12) 0%,transparent 60%)'}}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full"
            style={{background:'radial-gradient(circle,rgba(255,70,85,0.2) 0%,transparent 70%)',transform:'translate(30%,-30%)'}}/>
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
            &#10005;
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold">
              {post.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Sending Request To</p>
              <p className="font-display font-bold text-white text-lg">{post.username}</p>
            </div>
          </div>
        </div>
        <div className="mx-6 mb-5 rounded-xl bg-navy/60 border border-surface-border px-4 py-3 flex flex-wrap gap-2 items-center">
          <span className="text-sm font-semibold text-white">{post.game_name}</span>
          {post.role_required && <span className="badge-red text-xs">{post.role_required}</span>}
          {post.rank_required && <span className="badge-blue text-xs">{post.rank_required}</span>}
          {post.region        && <span className="badge-gray text-xs">{post.region}</span>}
        </div>
        <div className="px-6 pb-6">
          <label className="block text-sm text-gray-400 mb-2">Message <span className="text-gray-600">(optional)</span></label>
          <textarea className="input resize-none" rows={3}
            placeholder="Introduce yourself — your role, rank, playstyle..."
            value={msg} onChange={e => setMsg(e.target.value)}/>
          <div className="flex gap-3 mt-4">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handle} disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Sending...</>
                : <><span>&#128640;</span>Push Request</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EnhancedCard({ post, onPushRequest, alreadyApplied, isAuthenticated }) {
  const { username, game_name, rank_required, role_required, region,
          description, poster_rank, poster_elo, created_at, post_id } = post

  const timeAgo = (d) => {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 60) return m + 'm ago'
    const h = Math.floor(m / 60)
    if (h < 24) return h + 'h ago'
    return Math.floor(h / 24) + 'd ago'
  }

  const accents = ['#ff4655','#3b82f6','#8b5cf6','#10b981','#f59e0b']
  const accent  = accents[(post_id || 0) % accents.length]

  return (
    <div className="relative flex flex-col gap-3 rounded-xl border border-surface-border overflow-hidden transition-all duration-300 hover:border-red/40 hover:-translate-y-0.5"
      style={{background:'linear-gradient(145deg,#1a2340,#131a2e)'}}>
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,' + accent + ',transparent)'}}/>
      <div className="px-4 pb-4 flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-3 pt-1">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{background:accent+'22',border:'1px solid '+accent+'44',color:accent}}>
            {username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm truncate">{username}</p>
            <p className="text-xs text-gray-500 truncate">{game_name}</p>
          </div>
          <span className="text-xs text-gray-600 shrink-0">{timeAgo(created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {role_required && <span className="badge-red">{role_required}</span>}
          {rank_required && <span className="badge-blue">{rank_required}</span>}
          {region        && <span className="badge-gray">&#128205; {region}</span>}
          {poster_elo    && <span className="badge-gray">ELO {poster_elo}</span>}
          {poster_rank   && <span className="badge-gray">&#127885; {poster_rank}</span>}
        </div>
        {description && (
          <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 flex-1">{description}</p>
        )}
        {isAuthenticated && (
          alreadyApplied ? (
            <div className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-lg border border-green-500/20 bg-green-500/5 text-green-400 text-sm font-medium">
              <span>&#10003;</span> Request Sent
            </div>
          ) : (
            <button onClick={onPushRequest}
              className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-95"
              style={{background:'linear-gradient(135deg,'+accent+'22,'+accent+'10)',border:'1px solid '+accent+'33',color:accent}}>
              <span>&#128640;</span> Push Request
            </button>
          )
        )}
        {!isAuthenticated && (
          <a href="/login"
            className="mt-auto text-center block w-full py-2.5 rounded-lg border border-surface-border text-gray-500 text-sm hover:border-red/30 hover:text-gray-300 transition-colors">
            Login to Apply
          </a>
        )}
      </div>
    </div>
  )
}

export default function TeamFinder() {
  const { isAuthenticated } = useAuth()

  const [posts, setPosts]             = useState([])
  const [myGames, setMyGames]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [filters, setFilters]         = useState({ game_id:'', region:'' })
  const [error, setError]             = useState('')
  const [toast, setToast]             = useState({ msg:'', type:'success' })
  const [requestPost, setRequestPost] = useState(null)
  const [appliedIds, setAppliedIds]   = useState(new Set())

  const [form, setForm] = useState({
    game_id:'', rank_required:'', role_required:'', region:'', description:'',
  })

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg:'', type:'success' }), 3000)
  }

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.game_id) params.game_id = filters.game_id
      if (filters.region)  params.region  = filters.region
      const res = await getPosts(params)
      setPosts(res.data.posts || [])
    } catch { setPosts([]) }
    finally  { setLoading(false) }
  }, [filters])

  useEffect(() => { loadPosts() }, [loadPosts])
  useEffect(() => {
    if (isAuthenticated) {
      getMyGames().then(r => setMyGames(r.data.games || [])).catch(() => {})
    }
  }, [isAuthenticated])

  const handlePushRequest = async (postId, message) => {
    try {
      await applyToPost(postId, { message })
      setAppliedIds(prev => new Set([...prev, postId]))
      showToast('Request sent! The team leader will review it.', 'success')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send request', 'error')
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await createPost(form)
      setShowForm(false)
      setForm({ game_id:'', rank_required:'', role_required:'', region:'', description:'' })
      showToast('Listing published!', 'success')
      loadPosts()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create post')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">

      {toast.msg && (
        <div className={
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 text-sm px-5 py-3 rounded-full shadow-card animate-fade-in border ' +
          (toast.type === 'error'
            ? 'bg-red/20 border-red/40 text-red-light'
            : 'bg-surface-card border-green-500/30 text-green-400')
        }>
          {toast.msg}
        </div>
      )}

      {requestPost && (
        <PushRequestModal
          post={requestPost}
          onClose={() => setRequestPost(null)}
          onSubmit={handlePushRequest}
        />
      )}

      {/* Hero banner */}
      <div className="relative mb-10 rounded-2xl overflow-hidden border border-surface-border"
        style={{background:'linear-gradient(135deg,#0f172a 0%,#1a2340 50%,#130a1a 100%)'}}>
        <GridBackground/>
        <div className="relative z-10 px-8 py-12 sm:py-16 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-red/10 border border-red/20 rounded-full px-3 py-1 mb-4">
              <span className="live-dot"/>
              <span className="text-xs text-red-light font-semibold tracking-wider uppercase">Player Recruitment</span>
            </div>
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-white leading-tight">
              Find Your <span className="text-gradient">Perfect Squad</span>
            </h1>
            <p className="text-gray-400 mt-3 max-w-lg text-sm leading-relaxed">
              Push join requests, post recruitment listings, and build your dream team.
              Filter by game, rank, role, and region.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {isAuthenticated
                ? <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
                    <span>&#128203;</span> Post a Listing
                  </button>
                : <a href="/login" className="btn-primary">Login to Post</a>
              }
              <div className="flex items-center gap-2 text-sm text-gray-500 self-center">
                <span>&#127919;</span> Push requests to any open listing
              </div>
            </div>
          </div>
          <div className="flex sm:flex-col gap-3 shrink-0">
            {[['&#9876;','Active Listings'],['&#129309;','Push Requests'],['&#127942;','Teams Formed']].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                <span className="text-xl" dangerouslySetInnerHTML={{__html: icon}}/>
                <span className="text-xs text-gray-400 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-8 rounded-2xl border border-red/20 overflow-hidden animate-slide-up"
          style={{background:'linear-gradient(135deg,rgba(255,70,85,0.06) 0%,rgba(26,35,64,0.9) 50%)'}}>
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-surface-border">
            <div>
              <h3 className="font-display font-bold text-xl text-white">Create a Listing</h3>
              <p className="text-xs text-gray-500 mt-0.5">Fill in the details to find your ideal teammate</p>
            </div>
            <button onClick={() => setShowForm(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
              &#10005;
            </button>
          </div>
          <div className="p-6">
            <ErrorMessage message={error}/>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Game <span className="text-red">*</span></label>
                <select className="input" value={form.game_id}
                  onChange={e => setForm(f => ({...f, game_id:e.target.value}))} required>
                  <option value="">Select game</option>
                  {myGames.map(g => <option key={g.game_id} value={g.game_id}>{g.game_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Region</label>
                <input className="input" placeholder="e.g. South Asia, NA-East"
                  value={form.region} onChange={e => setForm(f => ({...f, region:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Role Required</label>
                <input className="input" placeholder="e.g. IGL, Support, Entry Fragger"
                  value={form.role_required} onChange={e => setForm(f => ({...f, role_required:e.target.value}))}/>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Rank Required</label>
                <input className="input" placeholder="e.g. Diamond+, Plat-Gold"
                  value={form.rank_required} onChange={e => setForm(f => ({...f, rank_required:e.target.value}))}/>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-400 mb-1.5">Description</label>
                <textarea className="input resize-none" rows={3}
                  placeholder="Tell players about your team, requirements, schedule..."
                  value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))}/>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary flex items-center gap-2">
                  <span>&#128203;</span> Publish Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">&#128269;</span>
          <input className="input pl-9 w-52" placeholder="Filter by region..."
            value={filters.region} onChange={e => setFilters(f => ({...f, region:e.target.value}))}/>
        </div>
        {myGames.length > 0 && (
          <select className="input w-48" value={filters.game_id}
            onChange={e => setFilters(f => ({...f, game_id:e.target.value}))}>
            <option value="">All Games</option>
            {myGames.map(g => <option key={g.game_id} value={g.game_id}>{g.game_name}</option>)}
          </select>
        )}
        {(filters.region || filters.game_id) && (
          <button onClick={() => setFilters({game_id:'',region:''})}
            className="btn-ghost text-sm text-red-light">&#10005; Clear filters</button>
        )}
      </div>

      <ErrorMessage message={error}/>

      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-2 border-surface-border border-t-red rounded-full animate-spin"/>
          <p className="text-gray-500 text-sm">Searching for squads...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4 opacity-20">&#127919;</div>
          <p className="text-gray-300 font-medium text-xl font-display">No listings found</p>
          <p className="text-gray-500 text-sm mt-2 max-w-xs">
            {(filters.region || filters.game_id) ? 'Try removing filters to see all listings' : 'Be the first to post a team finder listing'}
          </p>
          {isAuthenticated && (
            <button onClick={() => setShowForm(true)} className="btn-primary mt-6">Post a Listing</button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              <span className="text-white font-semibold">{posts.length}</span>{' '}
              listing{posts.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map(post => (
              <EnhancedCard
                key={post.post_id}
                post={post}
                onPushRequest={() => setRequestPost(post)}
                alreadyApplied={appliedIds.has(post.post_id)}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
