import { useEffect, useState } from 'react'
import { getCommunities, getCommunityPosts, createCommunityPost, addComment, votePost } from '../services/communityService'
import { PageLoader, EmptyState, ErrorMessage, Spinner } from '../components/UI'
import { useAuth } from '../context/AuthContext'

function PostCard({ post, onVote, onOpenComments }) {
  return (
    <div className="card group">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold text-sm shrink-0">
          {post.username?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{post.username}</span>
            <span className="text-xs text-gray-600">
              {new Date(post.created_at).toLocaleDateString()}
            </span>
          </div>
          <h3 className="font-semibold text-gray-200 mb-1 leading-snug">{post.title}</h3>
          <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">{post.content}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 pt-3 divider">
        <button
          onClick={() => onVote(post.post_id, 'up')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red transition-colors"
        >
          ▲ <span>{post.upvotes || 0}</span>
        </button>
        <button
          onClick={() => onVote(post.post_id, 'down')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ▼ <span>{post.downvotes || 0}</span>
        </button>
        <button
          onClick={() => onOpenComments(post)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors ml-auto"
        >
          💬 {post.comment_count || 0} comments
        </button>
      </div>
    </div>
  )
}

function CommentPanel({ post, onClose }) {
  const { isAuthenticated } = useAuth()
  const [comments, setComments] = useState(post.comments || [])
  const [text, setText]         = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await addComment(post.post_id, { content: text })
      setComments(c => [...c, res.data.comment])
      setText('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div className="card w-full max-w-lg max-h-[80vh] flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-white">{post.title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
          {comments.length === 0
            ? <p className="text-gray-600 text-sm text-center py-6">No comments yet. Be first!</p>
            : comments.map(c => (
              <div key={c.comment_id} className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-surface-border flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                  {c.username?.[0]?.toUpperCase()}
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-300 mr-2">{c.username}</span>
                  <span className="text-sm text-gray-400">{c.content}</span>
                </div>
              </div>
            ))
          }
        </div>

        {isAuthenticated && (
          <form onSubmit={handleSubmit} className="flex gap-2 pt-3 divider">
            <input
              className="input flex-1 text-sm"
              placeholder="Write a comment..."
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <button type="submit" disabled={loading || !text.trim()} className="btn-primary shrink-0 text-sm">
              {loading ? <Spinner size="sm" /> : 'Post'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Communities() {
  const { isAuthenticated } = useAuth()

  const [communities, setCommunities]   = useState([])
  const [activeCommunity, setActive]    = useState(null)
  const [posts, setPosts]               = useState([])
  const [loadingCom, setLoadingCom]     = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState({ title: '', content: '' })
  const [error, setError]               = useState('')
  const [activePost, setActivePost]     = useState(null)

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
      setPosts(ps => ps.map(p =>
        p.post_id === postId ? { ...p, ...res.data.votes } : p
      ))
    } catch {}
  }

  const handleCreatePost = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await createCommunityPost(activeCommunity.community_id, form)
      setShowForm(false)
      setForm({ title: '', content: '' })
      const res = await getCommunityPosts(activeCommunity.community_id)
      setPosts(res.data.posts || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post')
    }
  }

  if (loadingCom) return <PageLoader />

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      {activePost && (
        <CommentPanel post={activePost} onClose={() => setActivePost(null)} />
      )}

      <h1 className="section-title mb-2">Communities</h1>
      <p className="section-subtitle mb-8">Discuss strategies, share clips, and connect with players</p>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar — community list */}
        <aside className="lg:w-56 shrink-0">
          <div className="card p-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">Communities</p>
            {communities.length === 0
              ? <p className="text-gray-600 text-sm px-3 py-2">No communities yet</p>
              : communities.map(c => (
                <button
                  key={c.community_id}
                  onClick={() => setActive(c)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    activeCommunity?.community_id === c.community_id
                      ? 'bg-red/10 text-red font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-surface-border'
                  }`}
                >
                  <span className="truncate">{c.name || c.game_name}</span>
                  <span className="ml-auto text-xs text-gray-600 shrink-0">{c.post_count || 0}</span>
                </button>
              ))
            }
          </div>
        </aside>

        {/* Main — posts */}
        <div className="flex-1 min-w-0">
          {activeCommunity && (
            <>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-display font-bold text-xl text-white">
                    {activeCommunity.name || activeCommunity.game_name}
                  </h2>
                  {activeCommunity.description && (
                    <p className="text-gray-500 text-sm">{activeCommunity.description}</p>
                  )}
                </div>
                {isAuthenticated && (
                  <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
                    {showForm ? 'Cancel' : '+ New Post'}
                  </button>
                )}
              </div>

              {showForm && (
                <div className="card mb-5 animate-slide-up">
                  <ErrorMessage message={error} />
                  <form onSubmit={handleCreatePost} className="flex flex-col gap-3 mt-2">
                    <input
                      className="input"
                      placeholder="Post title"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      required
                    />
                    <textarea
                      className="input resize-none"
                      rows={4}
                      placeholder="Share your thoughts, clips, strategies..."
                      value={form.content}
                      onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                      required
                    />
                    <div className="flex justify-end">
                      <button type="submit" className="btn-primary text-sm">Publish</button>
                    </div>
                  </form>
                </div>
              )}

              {loadingPosts ? (
                <PageLoader />
              ) : posts.length === 0 ? (
                <EmptyState
                  icon="💬"
                  title="No posts yet"
                  subtitle="Start the conversation"
                  action={isAuthenticated
                    ? <button onClick={() => setShowForm(true)} className="btn-primary">Write first post</button>
                    : null
                  }
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {posts.map(post => (
                    <PostCard
                      key={post.post_id}
                      post={post}
                      onVote={handleVote}
                      onOpenComments={setActivePost}
                    />
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
