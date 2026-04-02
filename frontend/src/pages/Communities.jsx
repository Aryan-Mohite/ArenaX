import { useEffect, useState, useRef } from 'react'
import { getCommunities, getCommunityPosts, createCommunityPost, addComment, votePost } from '../services/communityService'
import { PageLoader, EmptyState, ErrorMessage, Spinner } from '../components/UI'
import { useAuth } from '../context/AuthContext'

// ── Image upload helper (converts file → base64 data-URL for preview,
//    sends the raw URL/base64 string as image_url in the post body) ───────────
function useImagePicker() {
  const [preview, setPreview] = useState(null)   // data-URL for <img>
  const [value,   setValue]   = useState('')      // what gets sent to API
  const [urlMode, setUrlMode] = useState(false)   // true = URL input, false = file picker
  const inputRef = useRef(null)

  const pickFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target.result)
      setValue(e.target.result)   // send base64 as image_url
    }
    reader.readAsDataURL(file)
  }

  const setUrl = (url) => {
    setValue(url)
    setPreview(url)
  }

  const clear = () => {
    setPreview(null)
    setValue('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return { preview, value, urlMode, setUrlMode, pickFile, setUrl, clear, inputRef }
}

// ── Avatar component — shows profile_picture if set, else initial ─────────────
function Avatar({ user, size = 9 }) {
  const s = `w-${size} h-${size}`
  if (user?.profile_picture) {
    return (
      <img src={user.profile_picture} alt={user.username}
        className={`${s} rounded-full object-cover border border-surface-border shrink-0`} />
    )
  }
  return (
    <div className={`${s} rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold text-sm shrink-0`}
      style={{ fontSize: size <= 8 ? '0.7rem' : undefined }}>
      {user?.username?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// ── Post card ────────────────────────────────────────────────────────────────
function PostCard({ post, onVote, onOpenComments }) {
  const [imgExpanded, setImgExpanded] = useState(false)

  return (
    <div className="card group transition-all duration-200 hover:border-red/20">
      <div className="flex items-start gap-3">
        <Avatar user={{ username: post.username, profile_picture: post.profile_picture }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-white">{post.username}</span>
            <span className="text-xs text-gray-600">
              {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <h3 className="font-semibold text-gray-200 mb-1 leading-snug">{post.title}</h3>
          {post.content && (
            <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">{post.content}</p>
          )}
        </div>
      </div>

      {/* Attached image / GIF */}
      {post.image_url && (
        <div className="mt-3 rounded-xl overflow-hidden border border-surface-border cursor-pointer"
          onClick={() => setImgExpanded(!imgExpanded)}>
          <img
            src={post.image_url}
            alt="post media"
            className={'w-full object-cover transition-all duration-300 ' + (imgExpanded ? 'max-h-[600px]' : 'max-h-64')}
            onError={e => { e.target.parentElement.style.display = 'none' }}
          />
          {!imgExpanded && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end justify-center pb-2 pointer-events-none">
              <span className="text-xs text-white/70 bg-black/40 px-2 py-0.5 rounded-full">tap to expand</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 mt-4 pt-3 divider">
        <button onClick={() => onVote(post.post_id, 'up')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red transition-colors group/vote">
          <span className="group-hover/vote:scale-125 transition-transform inline-block">▲</span>
          <span>{post.upvotes || 0}</span>
        </button>
        <button onClick={() => onVote(post.post_id, 'down')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-400 transition-colors group/vote">
          <span className="group-hover/vote:scale-125 transition-transform inline-block">▼</span>
          <span>{post.downvotes || 0}</span>
        </button>
        <button onClick={() => onOpenComments(post)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors ml-auto">
          &#128172; {post.comment_count || 0} comments
        </button>
      </div>
    </div>
  )
}

// ── Comment panel ────────────────────────────────────────────────────────────
function CommentPanel({ post, onClose }) {
  const { isAuthenticated } = useAuth()
  const [comments, setComments] = useState(post.comments || [])
  const [text,     setText]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const endRef = useRef(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await addComment(post.post_id, { content: text })
      setComments(c => [...c, res.data.comment])
      setText('')
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(2,6,23,0.7)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-surface-border overflow-hidden animate-slide-up"
        style={{ background: 'linear-gradient(145deg,#1a2340,#131a2e)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-surface-border shrink-0">
          {post.image_url && (
            <img src={post.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-surface-border shrink-0"
              onError={e => { e.target.style.display = 'none' }} />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-white text-sm leading-snug line-clamp-2">{post.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">by {post.username}</p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors shrink-0 text-lg">
            &#10005;
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto space-y-3 px-5 py-4">
          {comments.length === 0
            ? <p className="text-gray-600 text-sm text-center py-8">No comments yet — be the first!</p>
            : comments.map(c => (
              <div key={c.comment_id} className="flex gap-2.5">
                <Avatar user={{ username: c.username, profile_picture: c.profile_picture }} size={7} />
                <div className="bg-navy/60 rounded-xl px-3 py-2 flex-1 min-w-0">
                  <span className="text-xs font-semibold text-gray-300">{c.username}</span>
                  <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))
          }
          <div ref={endRef} />
        </div>

        {/* Comment input */}
        {isAuthenticated && (
          <form onSubmit={handleSubmit} className="flex gap-2 px-5 py-4 border-t border-surface-border shrink-0">
            <input className="input flex-1 text-sm" placeholder="Write a comment..."
              value={text} onChange={e => setText(e.target.value)} />
            <button type="submit" disabled={loading || !text.trim()} className="btn-primary shrink-0 text-sm">
              {loading ? <Spinner size="sm" /> : 'Post'}
            </button>
          </form>
        )}
        {!isAuthenticated && (
          <p className="text-center text-gray-600 text-xs py-3 border-t border-surface-border shrink-0">
            <a href="/login" className="text-red hover:underline">Sign in</a> to comment
          </p>
        )}
      </div>
    </div>
  )
}

// ── New Post Form ─────────────────────────────────────────────────────────────
function NewPostForm({ communityName, onSubmit, onCancel, error }) {
  const [form, setForm]   = useState({ title: '', content: '' })
  const [submitting, setSub] = useState(false)
  const img = useImagePicker()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSub(true)
    await onSubmit({ ...form, image_url: img.value || null })
    setSub(false)
    setForm({ title: '', content: '' })
    img.clear()
  }

  return (
    <div className="rounded-2xl border border-red/20 mb-6 overflow-hidden animate-slide-up"
      style={{ background: 'linear-gradient(135deg,rgba(255,70,85,0.06) 0%,rgba(26,35,64,0.9) 50%)' }}>

      {/* Form header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-border">
        <div>
          <h3 className="font-display font-bold text-white text-base">New Post</h3>
          <p className="text-xs text-gray-500 mt-0.5">Posting to {communityName}</p>
        </div>
        <button onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
          &#10005;
        </button>
      </div>

      <div className="p-5">
        <ErrorMessage message={error} />
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-1">
          <input className="input" placeholder="Post title *"
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />

          <textarea className="input resize-none" rows={3}
            placeholder="Share your thoughts, clips, strategies..."
            value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />

          {/* ── Media attachment ── */}
          <div className="rounded-xl border border-surface-border bg-navy/40 p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-400 font-medium">&#128247; Attach Image / GIF</span>
              <div className="flex gap-1 ml-auto">
                <button type="button"
                  onClick={() => { img.setUrlMode(false); img.clear() }}
                  className={'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ' +
                    (!img.urlMode ? 'bg-red/20 text-red border border-red/30' : 'text-gray-500 hover:text-white border border-surface-border')}>
                  Upload file
                </button>
                <button type="button"
                  onClick={() => { img.setUrlMode(true); img.clear() }}
                  className={'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ' +
                    (img.urlMode ? 'bg-red/20 text-red border border-red/30' : 'text-gray-500 hover:text-white border border-surface-border')}>
                  Paste URL
                </button>
              </div>
            </div>

            {/* File picker */}
            {!img.urlMode && (
              <div>
                <input ref={img.inputRef} type="file" accept="image/*,.gif" className="hidden"
                  onChange={e => img.pickFile(e.target.files?.[0])} />
                <button type="button"
                  onClick={() => img.inputRef.current?.click()}
                  className="w-full border-2 border-dashed border-surface-border rounded-xl py-5 flex flex-col items-center gap-2 text-gray-500 hover:border-red/40 hover:text-gray-300 transition-colors">
                  <span className="text-2xl">&#128190;</span>
                  <span className="text-xs">Click to browse — PNG, JPG, GIF, WEBP</span>
                </button>
              </div>
            )}

            {/* URL input */}
            {img.urlMode && (
              <input className="input text-sm" placeholder="https://i.imgur.com/example.gif or any image URL"
                value={img.value}
                onChange={e => img.setUrl(e.target.value)} />
            )}

            {/* Preview */}
            {img.preview && (
              <div className="mt-3 relative">
                <img src={img.preview} alt="preview"
                  className="w-full max-h-48 object-cover rounded-lg border border-surface-border"
                  onError={e => { e.target.style.display = 'none' }} />
                <button type="button" onClick={img.clear}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-red/80 transition-colors">
                  &#10005;
                </button>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400">Media attached</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary text-sm flex items-center gap-2">
              {submitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Publishing...</> : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Communities page ─────────────────────────────────────────────────────
export default function Communities() {
  const { isAuthenticated } = useAuth()

  const [communities,   setCommunities]   = useState([])
  const [activeCommunity, setActive]      = useState(null)
  const [posts,         setPosts]         = useState([])
  const [loadingCom,    setLoadingCom]    = useState(true)
  const [loadingPosts,  setLoadingPosts]  = useState(false)
  const [showForm,      setShowForm]      = useState(false)
  const [error,         setError]         = useState('')
  const [activePost,    setActivePost]    = useState(null)
  const [toast,         setToast]         = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    getCommunities()
      .then(res => {
        const list = res.data.communities || []
        setCommunities(list)
        if (list.length > 0) setActive(list[0])
      })
      .finally(() => setLoadingCom(false))
  }, [])

  useEffect(() => {
    if (!activeCommunity) return
    setLoadingPosts(true)
    getCommunityPosts(activeCommunity.community_id)
      .then(res => setPosts(res.data.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false))
  }, [activeCommunity])

  const handleVote = async (postId, vote) => {
    try {
      const res = await votePost(postId, vote)
      setPosts(ps => ps.map(p => p.post_id === postId ? { ...p, ...res.data.votes } : p))
    } catch {}
  }

  const handleCreatePost = async (formData) => {
    setError('')
    try {
      const res = await createCommunityPost(activeCommunity.community_id, formData)
      // Prepend new post immediately so user sees it without full reload
      setPosts(prev => [{
        ...res.data.post,
        username: '',          // will show on next reload
        comment_count: 0,
      }, ...prev])
      // Reload to get username populated
      const refreshed = await getCommunityPosts(activeCommunity.community_id)
      setPosts(refreshed.data.posts || [])
      setShowForm(false)
      showToast('Post published!')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post')
      throw err   // keep form open
    }
  }

  if (loadingCom) return <PageLoader />

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-green-500/30 text-green-400 text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">
          &#10003; {toast}
        </div>
      )}

      {activePost && (
        <CommentPanel post={activePost} onClose={() => setActivePost(null)} />
      )}

      <h1 className="section-title mb-1">Communities</h1>
      <p className="section-subtitle mb-8">Discuss strategies, share clips and GIFs, connect with players</p>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <aside className="lg:w-60 shrink-0">
          <div className="card p-2 sticky top-20">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">Communities</p>
            {communities.length === 0
              ? <p className="text-gray-600 text-sm px-3 py-2">No communities yet</p>
              : communities.map(c => (
                <button key={c.community_id} onClick={() => { setActive(c); setShowForm(false) }}
                  className={'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ' +
                    (activeCommunity?.community_id === c.community_id
                      ? 'bg-red/10 text-red font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-surface-border')
                  }>
                  <span className="truncate">{c.name || c.game_name}</span>
                  <span className="ml-auto text-xs text-gray-600 shrink-0 tabular-nums">{c.post_count || 0}</span>
                </button>
              ))
            }
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {activeCommunity && (
            <>
              <div className="flex items-center justify-between mb-5 gap-4">
                <div>
                  <h2 className="font-display font-bold text-xl text-white">
                    {activeCommunity.name || activeCommunity.game_name}
                  </h2>
                  {activeCommunity.description && (
                    <p className="text-gray-500 text-sm mt-0.5">{activeCommunity.description}</p>
                  )}
                </div>
                {isAuthenticated && (
                  <button onClick={() => setShowForm(!showForm)}
                    className={'text-sm shrink-0 ' + (showForm ? 'btn-secondary' : 'btn-primary')}>
                    {showForm ? 'Cancel' : '+ New Post'}
                  </button>
                )}
              </div>

              {showForm && (
                <NewPostForm
                  communityName={activeCommunity.name || activeCommunity.game_name}
                  onSubmit={handleCreatePost}
                  onCancel={() => setShowForm(false)}
                  error={error}
                />
              )}

              {loadingPosts ? (
                <PageLoader />
              ) : posts.length === 0 ? (
                <EmptyState icon="&#128172;" title="No posts yet" subtitle="Start the conversation"
                  action={isAuthenticated
                    ? <button onClick={() => setShowForm(true)} className="btn-primary">Write first post</button>
                    : null
                  }
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {posts.map(post => (
                    <PostCard key={post.post_id} post={post} onVote={handleVote} onOpenComments={setActivePost} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
