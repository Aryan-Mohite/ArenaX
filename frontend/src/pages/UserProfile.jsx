import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getUserProfile,
  getUserActivity,
  followUser,
  unfollowUser,
  getFollowStatus,
} from "../services/userService";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { themeStyles } from "../utils/themeStyles";
import TeamIdBadge from "../components/TeamIdBadge";
import { GameIdsDisplay } from "./Profile";
import { getKarmaBadge } from "../utils/karma";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (d) => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
};

const deadlineBadge = (deadline) => {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { text: "Expired", color: "#ef4444" };
  const h = Math.floor(diff / 3600000);
  if (h < 24) return { text: `${h}h left`, color: "#f59e0b" };
  return { text: `${Math.floor(h / 24)}d left`, color: "#10b981" };
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user, sizePx = 96 }) {
  const style = {
    width: sizePx + "px",
    height: sizePx + "px",
    fontSize: Math.round(sizePx * 0.38) + "px",
  };
  if (user?.profile_picture)
    return (
      <img
          loading="lazy"
        src={user.profile_picture}
        alt={user.username}
        className="rounded-full object-cover border-2 border-red/40 shrink-0"
        style={style}
      />
    );
  return (
    <div
      className="rounded-full bg-red/20 border-2 border-red/40 flex items-center justify-center font-display font-bold text-red shrink-0"
      style={style}
    >
      {user?.username?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

// ─── Stat Pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon, label, value, accent = "#ff4655" }) {
  const { theme } = useTheme();
  const cardBg =
    theme === "light"
      ? "var(--bg-card)"
      : "linear-gradient(145deg,#1a2340,#131a2e)";
  return (
    <div
      className="flex flex-col items-center gap-1 px-5 py-4 rounded-2xl border border-surface-border flex-1"
      style={{ background: cardBg }}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xl font-bold text-white tabular-nums">
        {value ?? "—"}
      </span>
      <span className="text-xs text-gray-500 uppercase tracking-wider text-center">
        {label}
      </span>
    </div>
  );
}

// ─── Community Post Card ───────────────────────────────────────────────────────
function CommunityPostCard({ post }) {
  const { theme } = useTheme();
  const cardBg =
    theme === "light"
      ? "var(--bg-card)"
      : "linear-gradient(145deg,#1a2340,#131a2e)";
  return (
    <div
      className="rounded-xl border border-surface-border p-4 transition-all hover:border-red/30"
      style={{ background: cardBg }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {post.community_name && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-red/30 bg-red/10 text-red-light font-medium">
                🎮 {post.game_name || post.community_name}
              </span>
            )}
            <span className="text-xs text-gray-600">
              {timeAgo(post.created_at)}
            </span>
          </div>
          <h4 className="font-semibold text-white text-sm leading-snug">
            {post.title}
          </h4>
          {post.content && (
            <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-2">
              {post.content}
            </p>
          )}
        </div>
        {post.image_url && (
          <img
          loading="lazy"
            src={post.image_url}
            alt=""
            className="w-14 h-14 rounded-lg object-cover border border-surface-border shrink-0"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        )}
      </div>
      <div className="flex items-center gap-4 pt-2 border-t border-surface-border/50">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <span className="text-green-400">▲</span> {post.upvotes || 0}
        </span>
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <span className="text-blue-400">▼</span> {post.downvotes || 0}
        </span>
        <span className="text-xs text-gray-500 flex items-center gap-1 ml-auto">
          💬 {post.comment_count || 0}
        </span>
      </div>
    </div>
  );
}

// ─── Team Finder Card ─────────────────────────────────────────────────────────
function TeamFinderCard({ post }) {
  const { theme } = useTheme();
  const cardBg =
    theme === "light"
      ? "var(--bg-card)"
      : "linear-gradient(145deg,#1a2340,#131a2e)";
  const accentMap = ["#ff4655", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];
  const accent = accentMap[(post.post_id || 0) % accentMap.length];
  const dl = deadlineBadge(post.deadline);
  const isOpen = post.status === "open";

  return (
    <div
      className="rounded-xl border border-surface-border overflow-hidden transition-all hover:border-red/30"
      style={{ background: cardBg }}
    >
      <div
        className="h-0.5"
        style={{ background: `linear-gradient(90deg,${accent},transparent)` }}
      />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-semibold text-white text-sm">{post.game_name}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {timeAgo(post.created_at)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={
                isOpen
                  ? {
                      background: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      color: "#10b981",
                    }
                  : {
                      background: "rgba(255,70,85,0.1)",
                      border: "1px solid rgba(255,70,85,0.3)",
                      color: "#ff4655",
                    }
              }
            >
              {isOpen ? "● Open" : "✕ Closed"}
            </span>
            {dl && (
              <span className="text-xs font-medium" style={{ color: dl.color }}>
                ⏱ {dl.text}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.role_required && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-red/30 bg-red/10 text-red-light">
              {post.role_required}
            </span>
          )}
          {post.rank_required && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
              {post.rank_required}
            </span>
          )}
          {post.region && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-surface-border bg-white/5 text-gray-400">
              📍 {post.region}
            </span>
          )}
        </div>
        {post.description && (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
            {post.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Game Profile Row ─────────────────────────────────────────────────────────
function GameProfileRow({ gp }) {
  const { theme } = useTheme();
  const cardBg =
    theme === "light"
      ? "var(--bg-card)"
      : "linear-gradient(145deg,#1a2340,#131a2e)";
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-border"
      style={{ background: cardBg }}
    >
      {gp.icon ? (
        <img
          loading="lazy"
          src={gp.icon}
          alt={gp.game_name}
          className="w-8 h-8 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-red/20 border border-red/30 flex items-center justify-center text-sm shrink-0">
          🎮
        </div>
      )}
      <span className="font-medium text-white text-sm flex-1 truncate">
        {gp.game_name}
      </span>
      <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
        {gp.rank && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
            {gp.rank}
          </span>
        )}
        {gp.role && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-red/30 bg-red/10 text-red-light">
            {gp.role}
          </span>
        )}
        {gp.matches_played > 0 && (
          <span className="text-xs text-gray-600">
            {gp.matches_played} matches
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function Skeleton() {
  const { theme } = useTheme();
  const cardBg =
    theme === "light"
      ? "var(--bg-card)"
      : "linear-gradient(145deg,#1a2340,#131a2e)";
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-pulse">
      <div
        className="rounded-2xl border border-surface-border p-6 mb-6"
        style={{ background: cardBg }}
      >
        <div className="flex gap-5">
          <div className="w-24 h-24 rounded-full bg-white/5 shrink-0" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-7 bg-white/5 rounded-lg w-48" />
            <div className="h-4 bg-white/5 rounded w-32" />
            <div className="h-4 bg-white/5 rounded w-64" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

// ─── Main UserProfile Page ────────────────────────────────────────────────────
export default function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user: currentUser } = useAuth();
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";
  const cardBg = isLight
    ? "var(--bg-card)"
    : "linear-gradient(145deg,#1a2340,#131a2e)";

  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState({
    community_posts: [],
    team_finder_posts: [],
    game_profiles: [],
    teams: [],
  });
  const [followStatus, setFollowStatus] = useState({
    following: false,
    followers: 0,
    following_count: 0,
    community_posts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState("");

  const isSelf = currentUser && String(currentUser.id) === String(id);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch profile first — if this fails (404), show error immediately
      const profileRes = await getUserProfile(id);
      setProfile(profileRes.data.profile);

      // Fetch activity + follow status in parallel — failures are non-fatal
      const [activityRes, statusRes] = await Promise.allSettled([
        getUserActivity(id),
        isAuthenticated && !isSelf
          ? getFollowStatus(id)
          : Promise.resolve(null),
      ]);

      if (activityRes.status === "fulfilled" && activityRes.value) {
        const d = activityRes.value.data;
        setActivity({
          community_posts: d.community_posts || [],
          team_finder_posts: d.team_finder_posts || [],
          game_profiles: d.game_profiles || [],
          teams: d.teams || [],
        });
      }

      if (statusRes.status === "fulfilled" && statusRes.value) {
        const d = statusRes.value.data;
        setFollowStatus({
          following: d.following,
          followers: Number(d.followers),
          following_count: Number(d.following_count),
          community_posts: Number(d.community_posts),
        });
      }
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 404
          ? "This player doesn't exist or has been removed."
          : "Could not load this player's profile.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated, isSelf]);

  useEffect(() => {
    load();
  }, [load]);

  // If it's the logged-in user's own profile, redirect to /profile
  useEffect(() => {
    if (!loading && isSelf) {
      navigate("/profile", { replace: true });
    }
  }, [loading, isSelf, navigate]);

  const handleFollowToggle = async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (followStatus.following) {
        await unfollowUser(id);
        setFollowStatus((s) => ({
          ...s,
          following: false,
          followers: Math.max(0, s.followers - 1),
        }));
        showToast("Unfollowed");
      } else {
        await followUser(id);
        setFollowStatus((s) => ({
          ...s,
          following: true,
          followers: s.followers + 1,
        }));
        showToast("Now following!");
      }
    } catch (err) {
      const status = err?.response?.status;
      showToast(
        status === 401
          ? "Session expired — please log in again"
          : "Action failed, try again",
      );
      console.error("[Follow toggle error]", status, err?.response?.data);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) return <Skeleton />;
  if (error)
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4 opacity-20">😕</div>
        <p className="text-gray-300 text-xl font-display font-bold mb-2">
          Player not found
        </p>
        <p className="text-gray-500 text-sm mb-6">{error}</p>
        <button onClick={() => navigate(-1)} className="btn-secondary">
          ← Back to Base
        </button>
      </div>
    );

  // const totalMatches = activity.game_profiles.reduce(
  //   (s, g) => s + (g.matches_played || 0),
  //   0,
  // );
  // const avgWinRate = activity.game_profiles.length
  //   ? (
  //       activity.game_profiles.reduce(
  //         (s, g) => s + Number(g.win_rate || 0),
  //         0,
  //       ) / activity.game_profiles.length
  //     ).toFixed(1)
  //   : null;

  const TABS = [
    {
      id: "overview",
      label: "🎮 Service Record",
      count: activity.game_profiles.length,
    },
    { id: "posts", label: "💬 Comms", count: activity.community_posts.length },
    {
      id: "teamfinder",
      label: "⚔️ Recruitments",
      count: activity.team_finder_posts.length,
    },
    { id: "teams", label: "🛡️ Teams", count: activity.teams.length },
    ...(isAuthenticated &&
    !isSelf &&
    profile?.game_ids &&
    Object.keys(profile.game_ids).length > 0
      ? [
          {
            id: "gameids",
            label: "🆔 Game IDs",
            count: Object.keys(profile.game_ids).length,
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-green-500/30 text-green-400 text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">
          {toast}
        </div>
      )}

      {/* ── Back Button ── */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm mb-6 group"
      >
        <span className="group-hover:-translate-x-0.5 transition-transform">
          ←
        </span>
        Back
      </button>

      {/* ── Profile Header Card ── */}
      <div
        className="rounded-2xl border border-surface-border overflow-hidden mb-6 relative"
        style={{
          background: isLight
            ? "var(--bg-card)"
            : "linear-gradient(145deg,#1a2340,#0f172a)",
        }}
      >
        {/* Hero gradient strip */}
        <div
          className="h-28 relative"
          style={{
            background:
              "linear-gradient(135deg,rgba(255,70,85,0.3) 0%,rgba(139,92,246,0.2) 50%,rgba(26,35,64,1) 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(255,70,85,0.5) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        </div>

        {/* Avatar + info */}
        <div className="px-6 pb-6 -mt-12 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar with ring */}
            <div
              className="shrink-0 p-1 rounded-full"
              style={{
                background: "linear-gradient(135deg,#ff4655,#8b5cf6)",
                display: "inline-block",
              }}
            >
              <div
                className="p-0.5 rounded-full"
                style={{ background: isLight ? "var(--bg-card)" : "#0f172a" }}
              >
                <Avatar user={profile} sizePx={80} />
              </div>
            </div>

            <div className="flex-1 min-w-0 sm:pb-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display font-bold text-3xl text-white leading-tight">
                    {profile?.username}
                  </h1>
                  {(() => {
                    const badge = getKarmaBadge(profile?.karma_positive, profile?.karma_negative);
                    return badge ? (
                      <p className="text-xs font-semibold mt-1" style={{ color: "#4ade80" }}>
                        {badge.icon} {badge.label}
                      </p>
                    ) : null;
                  })()}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {profile?.country && (
                      <span className="text-xs text-gray-500">
                        🌍 {profile.country}
                      </span>
                    )}
                    {profile?.region && (
                      <span className="text-xs text-gray-500">
                        📍 {profile.region}
                      </span>
                    )}
                    <span className="text-xs text-gray-600">
                      Member since{" "}
                      {new Date(profile?.created_at).toLocaleDateString(
                        "en-US",
                        { month: "short", year: "numeric" },
                      )}
                    </span>
                  </div>
                </div>

                {/* Follow / unfollow button */}
                {!isSelf && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-60"
                    style={
                      followStatus.following
                        ? {
                            background: "rgba(255,70,85,0.1)",
                            border: "1px solid rgba(255,70,85,0.4)",
                            color: "#ff4655",
                          }
                        : {
                            background:
                              "linear-gradient(135deg,#ff4655,#c8313e)",
                            border: "none",
                            color: "#fff",
                          }
                    }
                  >
                    {followLoading ? (
                      <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    ) : followStatus.following ? (
                      "✓ Following"
                    ) : (
                      "+ Follow"
                    )}
                  </button>
                )}
              </div>

              {profile?.bio && (
                <p className="text-sm text-gray-400 mt-3 leading-relaxed max-w-xl">
                  {profile.bio}
                </p>
              )}

              {/* Follower counts */}
              <div className="flex items-center gap-5 mt-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-lg tabular-nums">
                    {followStatus.followers.toLocaleString()}
                  </span>
                  <span className="text-gray-500 text-sm">Followers</span>
                </div>
                <span className="text-surface-border">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-lg tabular-nums">
                    {activity.community_posts.length}
                  </span>
                  <span className="text-gray-500 text-sm">Posts</span>
                </div>
                <span className="text-surface-border">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-lg tabular-nums">
                    {activity.game_profiles.length}
                  </span>
                  <span className="text-gray-500 text-sm">Games</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <StatPill
          icon="🎮"
          label="Games Played"
          value={activity.game_profiles.length}
        />
        <StatPill
          icon="💬"
          label="Posts"
          value={activity.community_posts.length}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-surface-card rounded-xl p-1 mb-6 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? "bg-red text-white shadow-md"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === t.id
                    ? "bg-white/20"
                    : "bg-white/10 text-gray-500"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview / Games ── */}
      {activeTab === "overview" && (
        <div className="animate-fade-in space-y-3">
          {activity.game_profiles.length === 0 ? (
            <div
              className="rounded-2xl border border-surface-border flex flex-col items-center justify-center py-16 text-center"
              style={{ background: cardBg }}
            >
              <div className="text-5xl mb-3 opacity-20">🎮</div>
              <p className="text-gray-400 font-medium">No service record yet</p>
              <p className="text-gray-600 text-sm mt-1">
                This player hasn't linked any games
              </p>
            </div>
          ) : (
            activity.game_profiles.map((gp, i) => (
              <GameProfileRow key={i} gp={gp} />
            ))
          )}
        </div>
      )}

      {/* ── Tab: Community Posts ── */}
      {activeTab === "posts" && (
        <div className="animate-fade-in space-y-3">
          {activity.community_posts.length === 0 ? (
            <div
              className="rounded-2xl border border-surface-border flex flex-col items-center justify-center py-16 text-center"
              style={{ background: cardBg }}
            >
              <div className="text-5xl mb-3 opacity-20">💬</div>
              <p className="text-gray-400 font-medium">No comms yet</p>
              <p className="text-gray-600 text-sm mt-1">
                This player hasn't posted in any community
              </p>
            </div>
          ) : (
            activity.community_posts.map((post) => (
              <CommunityPostCard key={post.post_id} post={post} />
            ))
          )}
        </div>
      )}

      {/* ── Tab: Team Finder ── */}

      {/* ── Tab: Teams ── */}
      {activeTab === "teams" && (
        <div className="animate-fade-in space-y-3">
          {activity.teams.length === 0 ? (
            <div
              className="rounded-2xl border border-surface-border flex flex-col items-center justify-center py-16 text-center"
              style={{ background: cardBg }}
            >
              <div className="text-5xl mb-3 opacity-20">🛡️</div>
              <p className="text-gray-400 font-medium">Not on any teams yet</p>
            </div>
          ) : (
            activity.teams.map((team, i) => (
              <div
                key={team.team_id || i}
                className="rounded-xl border border-surface-border px-4 py-3 flex items-center gap-3 hover:border-red/30 transition-all"
                style={{
                  background: cardBg,
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-red/20 border border-red/30 flex items-center justify-center text-lg shrink-0">
                  {team.game_icon ? (
                    <img
          loading="lazy"
                      src={team.game_icon}
                      alt=""
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    "⚔️"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white text-sm">
                      {team.team_name}
                    </p>
                    <TeamIdBadge teamId={team.team_id} />
                    {team.game_name && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-red/30 bg-red/10 text-red-light">
                        🎮 {team.game_name}
                      </span>
                    )}
                    {team.region && (
                      <span className="text-xs text-gray-500">
                        📍 {team.region}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {team.member_count || 0} member
                    {team.member_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium shrink-0"
                  style={
                    team.member_role === "captain"
                      ? {
                          background: "rgba(255,70,85,0.1)",
                          border: "1px solid rgba(255,70,85,0.3)",
                          color: "#ff4655",
                        }
                      : {
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "#9ca3af",
                        }
                  }
                >
                  {team.member_role === "captain" ? "⭐ Captain" : "Member"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
      {activeTab === "teamfinder" && (
        <div className="animate-fade-in">
          {activity.team_finder_posts.length === 0 ? (
            <div
              className="rounded-2xl border border-surface-border flex flex-col items-center justify-center py-16 text-center"
              style={{ background: cardBg }}
            >
              <div className="text-5xl mb-3 opacity-20">⚔️</div>
              <p className="text-gray-400 font-medium">No recruitments yet</p>
              <p className="text-gray-600 text-sm mt-1">
                This player hasn't posted any recruitment listings
              </p>
            </div>
          ) : (
            <>
              {/* Open listings */}
              {activity.team_finder_posts.filter((p) => p.status === "open")
                .length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
                    Active Recruitments
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {activity.team_finder_posts
                      .filter((p) => p.status === "open")
                      .map((post) => (
                        <TeamFinderCard key={post.post_id} post={post} />
                      ))}
                  </div>
                </div>
              )}
              {/* Past listings */}
              {activity.team_finder_posts.filter((p) => p.status !== "open")
                .length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">
                    Past Recruitments
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {activity.team_finder_posts
                      .filter((p) => p.status !== "open")
                      .map((post) => (
                        <TeamFinderCard key={post.post_id} post={post} />
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Game IDs (only for logged-in users viewing someone else) ── */}
      {activeTab === "gameids" && isAuthenticated && !isSelf && (
        <div className="animate-fade-in space-y-4">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 flex items-start gap-3">
            <span className="text-blue-400 text-lg shrink-0 mt-0.5">🔒</span>
            <p className="text-sm text-gray-400 leading-relaxed">
              In-game IDs are only visible to logged-in players. Click any ID to
              copy it to your clipboard.
            </p>
          </div>
          <div
            className="rounded-xl border border-surface-border p-5"
            style={{ background: cardBg }}
          >
            <h3 className="font-display font-bold text-base text-white mb-4">
              {profile?.username}'s Game IDs
            </h3>
            <GameIdsDisplay gameIds={profile?.game_ids || {}} />
          </div>
        </div>
      )}
    </div>
  );
}
