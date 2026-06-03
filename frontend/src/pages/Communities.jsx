import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCommunities,
  getCommunityPosts,
  createCommunityPost,
  addComment,
  votePost,
  getAllFavGamesPosts,
  deleteCommunityPost,
  deleteComment,
} from "../services/communityService";
import { getMyGames } from "../services/gameService";
import {
  PageLoader,
  EmptyState,
  ErrorMessage,
  Spinner,
} from "../components/UI";
import { useAuth } from "../context/AuthContext";
import { useImageUpload } from "../hooks/useImageUpload";
import { useTheme } from "../context/ThemeContext";
import { themeStyles } from "../utils/themeStyles";

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 9, onClick }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";

  const s = `w-${size} h-${size}`;
  const clickable = !!onClick;
  const base = `${s} rounded-full shrink-0 ${clickable ? "cursor-pointer hover:ring-2 hover:ring-red/50 transition-all hover:scale-110" : ""}`;
  if (user?.profile_picture)
    return (
      <img
        src={user.profile_picture}
        alt={user.username}
        onClick={onClick}
        className={`${base} object-cover border border-surface-border`}
      />
    );
  return (
    <div
      onClick={onClick}
      className={`${base} bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold`}
      style={{ fontSize: size <= 8 ? "0.7rem" : undefined }}
    >
      {user?.username?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

// ── Local image map — keys = exact game_name from backend (lowercased) ──────────
const LOCAL_IMAGES = {
  "apex legends": "/ApexLegends.jpg",
  "battlegrounds mobile india": "/BGMI.jpg",
  "brawl stars": "/BrawlStars_1.jpg",
  "call of duty: mobile": "/COD_Mobile_1.jpg",
  "call of duty: warzone": "/COD_Warzone.jpg",
  "dota 2": "/dota_2.jpg",
  "ea sports fc": "/EA-Sports.jpg",
  fortnite: "/Frotnite.jpg",
  "free fire": "/FreeFire.jpg",
  "league of legends": "/league-of-legends_1.jpg",
  "pubg: battlegrounds": "/PUBG.jpg",
  "rocket league": "/Rocket_League_1.jpg",
  valorant: "/Valorant.jpg",
};
const getLocalImage = (name) =>
  name ? LOCAL_IMAGES[name.toLowerCase().trim()] || null : null;

// ── Game Community Banner (HoYoLAB-style) ─────────────────────────────────────
function CommunityBanner({ community, isActive, onClick }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";
  const gameName = community?.name || community?.game_name || "Unknown";
  const initial = gameName[0]?.toUpperCase();
  const localImg = getLocalImage(community?.game_name);
  const [imgErr, setImgErr] = useState(false);
  const imgSrc = (!imgErr && (localImg || community?.icon)) || null;

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-xl transition-all group shrink-0 ${isActive ? "opacity-100" : "opacity-60 hover:opacity-90"}`}
    >
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-all overflow-hidden ${isActive ? "border-red shadow-lg shadow-red/30 scale-105" : "border-surface-border group-hover:border-red/40"}`}
        style={ts.communitySectionBg(isActive)}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={gameName}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <span style={{ color: isActive ? "#ff4655" : "#9ca3af" }}>
            {initial}
          </span>
        )}
      </div>
      <span
        className={`text-xs text-center leading-tight max-w-[72px] truncate font-medium ${isActive ? "text-red" : "text-gray-500 group-hover:text-gray-300"}`}
      >
        {gameName}
      </span>
      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-red" />}
    </button>
  );
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({
  post,
  onVote,
  onOpenComments,
  onDelete,
  currentUserId,
  showGameTag = false,
  onViewProfile,
}) {
  const [imgExpanded, setImgExpanded] = useState(false);
  const isOwner = currentUserId && post.user_id === currentUserId;

  return (
    <div className="card group transition-all duration-200 hover:border-red/20">
      <div className="flex items-start gap-3">
        <Avatar
          user={{
            username: post.username,
            profile_picture: post.profile_picture,
          }}
          onClick={() => onViewProfile && onViewProfile(post.user_id)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-white">
              {post.username}
            </span>
            {showGameTag && post.game_name && (
              <span className="badge-red text-xs">🎮 {post.game_name}</span>
            )}
            <span className="text-xs text-gray-600">
              {new Date(post.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <h3 className="font-semibold text-gray-200 mb-1 leading-snug">
            {post.title}
          </h3>
          {post.content && (
            <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">
              {post.content}
            </p>
          )}
        </div>

        {/* Delete button — only visible to post owner */}
        {isOwner && (
          <button
            onClick={() => onDelete(post.post_id)}
            title="Delete post"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red hover:bg-red/10 transition-colors shrink-0"
          >
            🗑️
          </button>
        )}
      </div>

      {post.image_url && (
        <div
          className="mt-3 rounded-xl overflow-hidden border border-surface-border cursor-pointer relative"
          onClick={() => setImgExpanded(!imgExpanded)}
        >
          <img
            src={post.image_url}
            alt="post media"
            className={
              "w-full object-cover transition-all duration-300 " +
              (imgExpanded ? "max-h-[600px]" : "max-h-64")
            }
            onError={(e) => {
              e.target.parentElement.style.display = "none";
            }}
          />
          {!imgExpanded && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end justify-center pb-2 pointer-events-none">
              <span className="text-xs text-white/70 bg-black/40 px-2 py-0.5 rounded-full">
                tap to expand
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 mt-4 pt-3 divider">
        {/* Upvote — highlighted red when user has already upvoted */}
        <button
          onClick={() => onVote(post.post_id, "up")}
          className={`flex items-center gap-1.5 text-sm transition-colors group/vote ${post.userVote === "up" ? "text-red" : "text-gray-500 hover:text-red"}`}
        >
          <span className="group-hover/vote:scale-125 transition-transform inline-block">
            ▲
          </span>
          <span>{post.upvotes || 0}</span>
        </button>

        {/* Downvote — highlighted blue when user has already downvoted */}
        <button
          onClick={() => onVote(post.post_id, "down")}
          className={`flex items-center gap-1.5 text-sm transition-colors group/vote ${post.userVote === "down" ? "text-blue-400" : "text-gray-500 hover:text-blue-400"}`}
        >
          <span className="group-hover/vote:scale-125 transition-transform inline-block">
            ▼
          </span>
          <span>{post.downvotes || 0}</span>
        </button>

        <button
          onClick={() => onOpenComments(post)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors ml-auto"
        >
          💬 {post.comment_count || 0} comms
        </button>
      </div>
    </div>
  );
}

// ── Comment Panel ─────────────────────────────────────────────────────────────
function CommentPanel({ post, onClose, currentUserId, onViewProfile }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";

  const { isAuthenticated } = useAuth();
  const [comms, setComments] = useState(post.comms || []);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await addComment(post.post_id, { content: text });
      setComments((c) => [...c, res.data.comment]);
      setText("");
      setTimeout(
        () => endRef.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (comment_id) => {
    try {
      await deleteComment(comment_id);
      setComments((c) => c.filter((x) => x.comment_id !== comment_id));
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={ts.modalBackdropSm}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-surface-border overflow-hidden animate-slide-up"
        style={ts.cardBg}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-surface-border shrink-0">
          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              className="w-12 h-12 rounded-lg object-cover border border-surface-border shrink-0"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-white text-sm leading-snug line-clamp-2">
              {post.title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">by {post.username}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors shrink-0 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto space-y-3 px-5 py-4">
          {comms.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">
              No comms yet — drop the first one!
            </p>
          ) : (
            comms.map((c) => (
              <div key={c.comment_id} className="flex gap-2.5 group/comment">
                <Avatar
                  user={{
                    username: c.username,
                    profile_picture: c.profile_picture,
                  }}
                  size={7}
                  onClick={() => onViewProfile && onViewProfile(c.user_id)}
                />
                <div className="bg-navy/60 rounded-xl px-3 py-2 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-300">
                      {c.username}
                    </span>
                    {/* Delete comment button — only for comment owner, appears on hover */}
                    {currentUserId && c.user_id === currentUserId && (
                      <button
                        onClick={() => handleDeleteComment(c.comment_id)}
                        title="Delete comment"
                        className="opacity-0 group-hover/comment:opacity-100 text-gray-600 hover:text-red transition-all text-xs"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">
                    {c.content}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        {/* Comment input */}
        {isAuthenticated && (
          <form
            onSubmit={handleSubmit}
            className="flex gap-2 px-5 py-4 border-t border-surface-border shrink-0"
          >
            <input
              className="input flex-1 text-sm"
              placeholder="Drop a comment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="btn-primary shrink-0 text-sm"
            >
              {loading ? <Spinner size="sm" /> : "Post"}
            </button>
          </form>
        )}
        {!isAuthenticated && (
          <p className="text-center text-gray-600 text-xs py-3 border-t border-surface-border shrink-0">
            <a href="/login" className="text-red hover:underline">
              Sign in
            </a>{" "}
            to comment
          </p>
        )}
      </div>
    </div>
  );
}

// ── Drop a Post Form ─────────────────────────────────────────────────────────────
function NewPostForm({ communityName, onSubmit, onCancel, error }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";

  const [form, setForm] = useState({ title: "", content: "" });
  const [submitting, setSub] = useState(false);
  const img = useImageUpload();
  // urlMode lives locally since the hook doesn't need it
  const [imgUrlMode, setImgUrlMode] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSub(true);
    await onSubmit({ ...form, image_url: img.value || null });
    setSub(false);
    setForm({ title: "", content: "" });
    img.clear();
  };

  return (
    <div
      className="rounded-2xl border border-red/20 mb-6 overflow-hidden animate-slide-up"
      style={ts.cardBg}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-border">
        <div>
          <h3 className="font-display font-bold text-white text-base">
            Drop a Post
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Posting to {communityName}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="p-5">
        <ErrorMessage message={error} />
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-1">
          <input
            className="input"
            placeholder="Post title *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Share your thoughts, clips, strategies..."
            value={form.content}
            onChange={(e) =>
              setForm((f) => ({ ...f, content: e.target.value }))
            }
          />
          <div className="rounded-xl border border-surface-border bg-navy/40 p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-400 font-medium">
                📷 Attach Image / GIF
              </span>
              <div className="flex gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setImgUrlMode(false);
                    img.clear();
                  }}
                  className={
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors " +
                    (!imgUrlMode
                      ? "bg-red/20 text-red border border-red/30"
                      : "text-gray-500 hover:text-white border border-surface-border")
                  }
                >
                  Upload file
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImgUrlMode(true);
                    img.clear();
                  }}
                  className={
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors " +
                    (imgUrlMode
                      ? "bg-red/20 text-red border border-red/30"
                      : "text-gray-500 hover:text-white border border-surface-border")
                  }
                >
                  Paste URL
                </button>
              </div>
            </div>
            {!imgUrlMode ? (
              <div>
                <input
                  type="file"
                  accept="image/*,.gif"
                  className="hidden"
                  id="comm-img-upload"
                  onChange={(e) => {
                    img.clear();
                    img.pickFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <label
                  htmlFor="comm-img-upload"
                  className="w-full border-2 border-dashed border-surface-border rounded-xl py-5 flex flex-col items-center gap-2 text-gray-500 hover:border-red/40 hover:text-gray-300 transition-colors cursor-pointer"
                  style={{ display: "flex" }}
                >
                  <span className="text-2xl">
                    {img.processing ? "⏳" : "💾"}
                  </span>
                  <span className="text-xs">
                    {img.processing
                      ? "Optimising image..."
                      : "Browse image — JPEG, PNG, GIF, WEBP, HEIC (max 100 MB)"}
                  </span>
                  {img.processing && (
                    <div className="w-40 h-1.5 bg-surface-border rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-red rounded-full transition-all duration-300"
                        style={{ width: img.progress + "%" }}
                      />
                    </div>
                  )}
                </label>
                {img.error && (
                  <p
                    className="text-xs mt-1.5 flex items-center gap-1"
                    style={{ color: "#ff4655" }}
                  >
                    ⚠ {img.error}
                  </p>
                )}
              </div>
            ) : (
              <input
                className="input text-sm"
                placeholder="https://i.imgur.com/example.gif or any image URL"
                value={img.value}
                onChange={(e) => img.setUrl(e.target.value)}
              />
            )}
            {img.preview && (
              <div className="mt-3 relative">
                <img
                  src={img.preview}
                  alt="preview"
                  className="w-full max-h-48 object-cover rounded-lg border border-surface-border"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={img.clear}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-red/80 transition-colors"
                >
                  ✕
                </button>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400">Media attached</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary text-sm"
            >
              Abort
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Publishing...
                </>
              ) : (
                "Publish"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Communities page ─────────────────────────────────────────────────────
export default function Communities() {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [communities, setCommunities] = useState([]);
  const [favGameIds, setFavGameIds] = useState([]);
  const [activeCommunity, setActive] = useState(null);
  const [posts, setPosts] = useState([]);
  const [allGamesPosts, setAllGamesPosts] = useState([]);
  const [loadingCom, setLoadingCom] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [activePost, setActivePost] = useState(null);
  const [toast, setToast] = useState("");
  const [postFilter, setPostFilter] = useState("all"); // 'all' | 'following'
  const [viewMode, setViewMode] = useState("community"); // 'community' | 'all'

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // Load communities + fav game ids
  useEffect(() => {
    const load = async () => {
      try {
        const [comRes] = await Promise.all([getCommunities()]);
        const list = comRes.data.communities || [];
        setCommunities(list);
        try {
          const gamesRes = await getMyGames();
          const myGameIds = (gamesRes.data.games || []).map((g) => g.game_id);
          setFavGameIds(myGameIds);
        } catch {}
        if (list.length > 0) setActive(list[0]);
      } finally {
        setLoadingCom(false);
      }
    };
    load();
  }, []);

  // Posts for selected community
  useEffect(() => {
    if (!activeCommunity || viewMode !== "community") return;
    setLoadingPosts(true);
    getCommunityPosts(activeCommunity.community_id)
      .then((res) => setPosts(res.data.posts || []))
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false));
  }, [activeCommunity, viewMode]);

  // All fav-game posts
  useEffect(() => {
    if (viewMode !== "all" || favGameIds.length === 0) {
      if (viewMode === "all") setAllGamesPosts([]);
      return;
    }
    setLoadingPosts(true);
    getAllFavGamesPosts({
        game_ids: favGameIds.join(","),
        following: postFilter === "following" ? "true" : "false",
      })
        .then((res) => setAllGamesPosts(res.data.posts || []))
        .catch(() => setAllGamesPosts([]))
        .finally(() => setLoadingPosts(false));
  }, [viewMode, favGameIds, postFilter]);

  // Vote handler — one vote per user; clicking same vote toggles it off, opposite vote switches
  const handleVote = async (postId, vote) => {
    try {
      const res = await votePost(postId, vote);
      const { votes, userVote } = res.data;
      const updater = (ps) =>
        ps.map((p) =>
          p.post_id === postId ? { ...p, ...votes, userVote } : p,
        );
      setPosts(updater);
      setAllGamesPosts(updater);
    } catch {}
  };

  // Delete post handler
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await deleteCommunityPost(postId);
      setPosts((ps) => ps.filter((p) => p.post_id !== postId));
      setAllGamesPosts((ps) => ps.filter((p) => p.post_id !== postId));
      showToast("Post deleted");
    } catch {}
  };

  const handleCreatePost = async (formData) => {
    setError("");
    try {
      await createCommunityPost(activeCommunity.community_id, formData);
      const refreshed = await getCommunityPosts(activeCommunity.community_id);
      setPosts(refreshed.data.posts || []);
      setShowForm(false);
      showToast("Post published!");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to post");
      throw err;
    }
  };

  // Communities to show in banner: prefer fav-game communities, otherwise all
  const favCommunities =
    favGameIds.length > 0
      ? communities.filter((c) => favGameIds.includes(c.game_id))
      : communities;
  const displayCommunities =
    favCommunities.length > 0 ? favCommunities : communities;

  if (loadingCom) return <PageLoader />;

  const displayPosts = viewMode === "all" ? allGamesPosts : posts;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-green-500/30 text-green-400 text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">
          ✓ {toast}
        </div>
      )}

      {/* Comment panel overlay */}
      {activePost && (
        <CommentPanel
          post={activePost}
          onClose={() => setActivePost(null)}
          currentUserId={user?.id}
          onViewProfile={(uid) => navigate(`/users/${uid}`)}
        />
      )}

      <h1 className="section-title mb-1">Communities</h1>
      <p className="section-subtitle mb-6">
        Your between-matches Tavern — strategy, clips, comms, and banter
      </p>

      {/* ── HoYoLAB-style game community row ── */}
      <div className="card mb-6 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {favGameIds.length > 0
              ? "⭐ Your Game Communities"
              : "All Communities"}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => {
                setViewMode("community");
                setShowForm(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "community" ? "bg-red text-white" : "text-gray-500 hover:text-white border border-surface-border"}`}
            >
              Community
            </button>
            <button
              onClick={() => {
                setViewMode("all");
                setShowForm(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "all" ? "bg-red text-white" : "text-gray-500 hover:text-white border border-surface-border"}`}
            >
              All Games Feed
            </button>
          </div>
        </div>

        {/* Horizontally scrollable community icon row */}
        <div
          className="flex gap-1 overflow-x-auto pb-1 scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {displayCommunities.length === 0 ? (
            <p className="text-gray-600 text-sm py-2">
              No communities found. Add games to your library to see your game
              communities here.
            </p>
          ) : (
            displayCommunities.map((c) => (
              <CommunityBanner
                key={c.community_id}
                community={c}
                isActive={
                  viewMode === "community" &&
                  activeCommunity?.community_id === c.community_id
                }
                onClick={() => {
                  setActive(c);
                  setViewMode("community");
                  setShowForm(false);
                }}
              />
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Main feed ── */}
        <div className="flex-1 min-w-0">
          {/* Feed header */}
          <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
            <div>
              {viewMode === "community" && activeCommunity ? (
                <>
                  <h2 className="font-display font-bold text-xl text-white">
                    {activeCommunity.name || activeCommunity.game_name}
                  </h2>
                  {activeCommunity.description && (
                    <p className="text-gray-500 text-sm mt-0.5">
                      {activeCommunity.description}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h2 className="font-display font-bold text-xl text-white">
                    Global Feed
                  </h2>
                  <p className="text-gray-500 text-sm mt-0.5">
                    Posts from your favourite game communities
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* All Posts / Following filter */}
              {isAuthenticated && (
                <div className="flex gap-1 bg-surface-card rounded-lg p-1">
                  <button
                    onClick={() => setPostFilter("all")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${postFilter === "all" ? "bg-red/20 text-red" : "text-gray-500 hover:text-white"}`}
                  >
                    Global Feed
                  </button>
                  <button
                    onClick={() => setPostFilter("following")}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${postFilter === "following" ? "bg-red/20 text-red" : "text-gray-500 hover:text-white"}`}
                  >
                    📡 Comms
                  </button>
                </div>
              )}

              {/* New post button — community mode only */}
              {viewMode === "community" && isAuthenticated && (
                <button
                  onClick={() => activeCommunity && setShowForm(!showForm)}
                  disabled={!activeCommunity}
                  title={!activeCommunity ? "Add games to your library to unlock communities" : undefined}
                  className={
                    "text-sm shrink-0 " +
                    (showForm ? "btn-secondary" : "btn-primary") +
                    (!activeCommunity ? " opacity-40 cursor-not-allowed" : "")
                  }
                >
                  {showForm ? "Cancel" : "+ Drop a Post"}
                </button>
              )}
            </div>
          </div>

          {viewMode === "community" && showForm && (
            <NewPostForm
              communityName={
                activeCommunity?.name || activeCommunity?.game_name
              }
              onSubmit={handleCreatePost}
              onCancel={() => setShowForm(false)}
              error={error}
            />
          )}

          {loadingPosts ? (
            <PageLoader />
          ) : displayPosts.length === 0 ? (
            <EmptyState
              icon="💬"
              title={
                postFilter === "following"
                  ? "No posts from people you follow"
                  : "No comms yet"
              }
              subtitle={
                postFilter === "following"
                  ? "Follow players to see their posts here"
                  : "First to the mic"
              }
              action={
                viewMode === "community" && isAuthenticated ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="btn-primary"
                  >
                    Break the Silence
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              {displayPosts.map((post) => (
                <PostCard
                  key={post.post_id}
                  post={post}
                  onVote={handleVote}
                  onOpenComments={setActivePost}
                  onDelete={handleDeletePost}
                  currentUserId={user?.id}
                  showGameTag={viewMode === "all"}
                  onViewProfile={(uid) => navigate(`/users/${uid}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <aside className="lg:w-64 shrink-0">
          <div className="card sticky top-20 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                All Communities
              </p>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {communities.length === 0 ? (
                  <p className="text-gray-600 text-sm py-1">No channels yet</p>
                ) : (
                  communities.map((c) => (
                    <button
                      key={c.community_id}
                      onClick={() => {
                        setActive(c);
                        setViewMode("community");
                        setShowForm(false);
                      }}
                      className={
                        "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 " +
                        (viewMode === "community" &&
                        activeCommunity?.community_id === c.community_id
                          ? "bg-red/10 text-red font-medium"
                          : "text-gray-400 hover:text-white hover:bg-surface-border")
                      }
                    >
                      <span className="truncate">{c.name || c.game_name}</span>
                      <span className="ml-auto text-xs text-gray-600 shrink-0 tabular-nums">
                        {c.post_count || 0}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Community info */}
            {activeCommunity && viewMode === "community" && (
              <div className="border-t border-surface-border pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Channel Info
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Posts</span>
                    <span className="text-white font-semibold">
                      {activeCommunity.post_count || 0}
                    </span>
                  </div>
                  {activeCommunity.description && (
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {activeCommunity.description}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}