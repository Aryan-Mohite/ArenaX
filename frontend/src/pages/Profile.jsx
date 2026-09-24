import { useEffect, useState, useRef } from "react";
import { useImageUpload } from "../hooks/useImageUpload";
import { Link } from "react-router-dom";
import { getMe } from "../services/authService";
import {
  updateProfile,
  getFollowers,
  getFollowing,
  getMyGameIds,
  updateGameIds,
} from "../services/userService";
import { getMyGames } from "../services/gameService";
import { PageLoader, ErrorMessage, StatCard } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import API from "../api/api";
import { useTheme } from "../context/ThemeContext";
import { themeStyles } from "../utils/themeStyles";
import { useChatContext } from "../context/ChatContext";
import ChatDrawer from "../components/ChatDrawer";
import TeamIdBadge from "../components/TeamIdBadge";
import FollowStatsModal from "../components/FollowStatsModal";
import AchievementsTab from "../components/AchievementsTab";

// ─── Platform config ──────────────────────────────────────────────────────────
export const GAME_PLATFORMS = [
  { key: "steam",     label: "Steam",           icon: "🖥️",  placeholder: "76561198XXXXXXXXX" },
  { key: "riot",      label: "Riot ID",         icon: "⚔️",  placeholder: "Username#TAG" },
  { key: "epic",      label: "Epic Games",      icon: "🎯",  placeholder: "EpicUsername" },
  { key: "battlenet", label: "Battle.net",      icon: "🔵",  placeholder: "Username#1234" },
  { key: "psn",       label: "PSN",             icon: "🎮",  placeholder: "PSN_Username" },
  { key: "xbox",      label: "Xbox Gamertag",   icon: "🟢",  placeholder: "XboxGamertag" },
  { key: "ubisoft",   label: "Ubisoft Connect", icon: "🟠",  placeholder: "UbisoftUsername" },
  { key: "ea",        label: "EA / Origin",     icon: "🟡",  placeholder: "EA_Username" },
  { key: "faceit",    label: "Faceit",          icon: "🔶",  placeholder: "FaceitUsername" },
  { key: "bgmi",      label: "BGMI / PUBG",     icon: "🪖",  placeholder: "Player ID" },
];

// ─── GameIdsTab component ─────────────────────────────────────────────────────
function GameIdsTab({ gameIds, gameIdsForm, setGameIdsForm, savingGameIds, onSave }) {
  const hasAny = GAME_PLATFORMS.some(p => gameIds[p.key]);
  const isDirty = GAME_PLATFORMS.some(
    p => (gameIdsForm[p.key] || "") !== (gameIds[p.key] || "")
  );

  return (
    <div className="animate-fade-in space-y-4">
      {/* Info banner */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 flex items-start gap-3">
        <span className="text-blue-400 text-lg shrink-0 mt-0.5">💡</span>
        <p className="text-sm text-gray-400 leading-relaxed">
          Add your in-game IDs so teammates can find and add you after being matched.
          Only logged-in players can see this section on other profiles.
        </p>
      </div>

      {/* Platform grid */}
      <div className="card">
        <h3 className="font-display font-bold text-lg text-white mb-4">Your Game IDs</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {GAME_PLATFORMS.map(({ key, label, icon, placeholder }) => (
            <div key={key}>
              <label className="flex items-center gap-2 text-sm text-gray-400 mb-1.5">
                <span>{icon}</span>
                <span>{label}</span>
                {gameIds[key] && (
                  <span className="ml-auto text-xs text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    Set
                  </span>
                )}
              </label>
              <input
                className="input text-sm"
                placeholder={placeholder}
                value={gameIdsForm[key] || ""}
                onChange={e => setGameIdsForm(f => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-surface-border">
          <p className="text-xs text-gray-600">Clear a field and save to remove that ID</p>
          <button
            onClick={onSave}
            disabled={savingGameIds || !isDirty}
            className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savingGameIds ? "Saving..." : "Save IDs"}
          </button>
        </div>
      </div>

      {/* Preview — what others will see */}
      {hasAny && (
        <div className="card">
          <h3 className="font-display font-bold text-base text-white mb-3">
            👁️ Preview — what teammates see
          </h3>
          <GameIdsDisplay gameIds={gameIds} />
        </div>
      )}
    </div>
  );
}

// ─── GameIdsDisplay — shared read-only display ────────────────────────────────
export function GameIdsDisplay({ gameIds }) {
  const [copied, setCopied] = useState(null);
  const entries = GAME_PLATFORMS.filter(p => gameIds?.[p.key]);
  if (entries.length === 0) return null;

  const copy = (key, val) => {
    navigator.clipboard.writeText(val).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {entries.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => copy(key, gameIds[key])}
          title="Click to copy"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-surface-border bg-navy/40 hover:border-red/30 hover:bg-red/5 transition-all group text-left w-full"
        >
          <span className="text-lg shrink-0">{icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500 leading-none mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-white truncate">{gameIds[key]}</p>
          </div>
          <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors shrink-0">
            {copied === key ? "✓ Copied!" : "copy"}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function Profile() {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const { user: authUser, login, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUrlMode, setAvatarUrlMode] = useState(false);
  const avatarFileRef = useRef(null);
  const [followStats, setFollowStats] = useState({
    followers: 0,
    following: 0,
    community_posts: 0,
  });
  const [showShare, setShowShare] = useState(false);
  const [followModal, setFollowModal] = useState(null);
  const [myTeams, setMyTeams] = useState([]);
  const [gameIds, setGameIds] = useState({});
  const [gameIdsForm, setGameIdsForm] = useState({});
  const [savingGameIds, setSavingGameIds] = useState(false);
  const [teamChatOpen, setTeamChatOpen] = useState(false);
  const [activeChatTeam, setActiveChatTeam] = useState(null);
  const { unread } = useChatContext();

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, gamesRes] = await Promise.all([getMe(), getMyGames()]);
        const p = meRes.data.user;
        setProfile(p);
        setForm({
          username: p.username || "",
          bio: p.bio || "",
          country: p.country || "",
          region: p.region || "",
          profile_picture: p.profile_picture || "",
        });
        if (p.profile_picture) setAvatarPreview(p.profile_picture);
        setGames(gamesRes.data.games || []);
        try {
          const td = await API.get("/teams/mine");
          setMyTeams(td.data.teams || []);
        } catch {}
        try {
          const gidsRes = await getMyGameIds();
          const ids = gidsRes.data.game_ids || {};
          setGameIds(ids);
          setGameIdsForm(ids);
        } catch {}
        try {
          const statsRes = await API.get("/users/me/stats");
          if (statsRes.data?.stats) {
            setFollowStats({
              followers: Number(statsRes.data.stats.followers) || 0,
              following: Number(statsRes.data.stats.following) || 0,
              community_posts: Number(statsRes.data.stats.community_posts) || 0,
            });
          }
        } catch {}
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // avatarUpload — shared hook handles compression, validation, progress (up to 5 MB)
  const avatarUpload = useImageUpload();
  // Keep form.profile_picture in sync whenever the hook produces a new value
  useEffect(() => {
    if (avatarUpload.value) {
      setAvatarPreview(avatarUpload.value);
      setForm((f) => ({ ...f, profile_picture: avatarUpload.value }));
    }
  }, [avatarUpload.value]);

  const handleAvatarUrl = (url) => {
    avatarUpload.setUrl(url);
    setAvatarPreview(url);
    setForm((f) => ({ ...f, profile_picture: url }));
  };
  const clearAvatar = () => {
    avatarUpload.clear();
    setAvatarPreview(null);
    setForm((f) => ({ ...f, profile_picture: "" }));
    if (avatarFileRef.current) avatarFileRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await updateProfile(form);
      const updated = res.data.user;
      setProfile((p) => ({ ...p, ...updated }));
      login(
        {
          ...authUser,
          username: updated.username,
          profile_picture:
            updated.profile_picture || authUser?.profile_picture || null,
        },
        token,
      );
      setEditMode(false);
      showToast("Loadout updated!");
    } catch (err) {
      setError(err.response?.data?.message || "Loadout save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  // const totalMatches = games.reduce((s, g) => s + (g.matches_played || 0), 0);
  // const avgWinRate = games.length
  //   ? (
  //       games.reduce((s, g) => s + Number(g.win_rate || 0), 0) / games.length
  //     ).toFixed(1)
  //   : null;
  // const avgElo = games.length
  //   ? Math.round(
  //       games.reduce((s, g) => s + (g.elo_rating || 1000), 0) / games.length,
  //     )
  //   : null;
  const TABS = [
    { id: "overview", label: "Service Record" },
    { id: "games", label: "Arsenal" },
    { id: "gameids", label: "🎮 Game IDs" },
    { id: "achievements", label: "🏆 Achievements" },
    {
      id: "teams",
      label: `🛡️ Teams${myTeams.length ? ` (${myTeams.length})` : ""}`,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      {showShare && (
        <ShareModal profile={profile} onClose={() => setShowShare(false)} />
      )}
      {followModal && (
        <FollowStatsModal
          type={followModal}
          userId={profile?.user_id}
          onClose={() => setFollowModal(null)}
        />
      )}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-green-500/30 text-green-400 text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">
          {toast}
        </div>
      )}

      {/* Profile Header */}
      <div className="card mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-red-glow pointer-events-none opacity-50" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative w-20 h-20 shrink-0 group">
            {profile?.profile_picture ? (
              <img
          loading="lazy"
                src={profile.profile_picture}
                alt={profile.username}
                className="w-20 h-20 rounded-full object-cover border-2 border-red/40 glow-red"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className={
                "w-20 h-20 rounded-full bg-red/20 border-2 border-red/40 items-center justify-center text-red font-display font-bold text-3xl glow-red " +
                (profile?.profile_picture ? "hidden" : "flex")
              }
            >
              {profile?.username?.[0]?.toUpperCase()}
            </div>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <span className="text-white text-xs font-medium">✎ Edit</span>
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-3xl text-white">
              {profile?.username}
            </h1>
            <p className="text-gray-400 text-sm mt-0.5">{profile?.email}</p>
            {profile?.bio && (
              <p className="text-gray-300 text-sm mt-2 max-w-lg">
                {profile.bio}
              </p>
            )}

            {/* ── Followers / Following / Posts ── */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <button
                onClick={() => setFollowModal("followers")}
                className="flex items-center gap-1.5 group"
              >
                <span className="font-bold text-white text-lg leading-none tabular-nums group-hover:text-red transition-colors">
                  {followStats.followers.toLocaleString()}
                </span>
                <span className="text-gray-500 text-sm group-hover:text-gray-300 transition-colors">
                  Followers
                </span>
              </button>
              <span className="text-surface-border text-lg">·</span>
              <button
                onClick={() => setFollowModal("following")}
                className="flex items-center gap-1.5 group"
              >
                <span className="font-bold text-white text-lg leading-none tabular-nums group-hover:text-red transition-colors">
                  {followStats.following.toLocaleString()}
                </span>
                <span className="text-gray-500 text-sm group-hover:text-gray-300 transition-colors">
                  Following
                </span>
              </button>
              <span className="text-surface-border text-lg">·</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-lg leading-none tabular-nums">
                  {followStats.community_posts.toLocaleString()}
                </span>
                <span className="text-gray-500 text-sm">Posts</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {profile?.country && (
                <span className="badge-gray">📍 {profile.country}</span>
              )}
              {profile?.region && (
                <span className="badge-gray">🌏 {profile.region}</span>
              )}
              <span className="badge-gray">
                Joined{" "}
                {new Date(profile?.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start shrink-0 flex-wrap justify-end">
            <button
              onClick={() => setShowShare(true)}
              title="Share profile"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-surface-border text-gray-400 hover:text-white hover:border-red/40 hover:bg-red/5 transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>

            <button
              onClick={() => setEditMode(!editMode)}
              className="btn-secondary text-sm"
            >
              {editMode ? "Cancel" : "Edit Loadout"}
            </button>
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="card mb-6 animate-slide-up">
          <h3 className="font-display font-bold text-lg text-white mb-4">
            Edit Loadout
          </h3>
          <ErrorMessage message={error} />
          <div className="rounded-xl border border-surface-border bg-navy/40 p-4 mb-4">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-3">
              📷 Profile Picture
            </label>
            <div className="flex items-start gap-4">
              {/* Live preview */}
              <div className="w-16 h-16 rounded-full border-2 border-surface-border overflow-hidden shrink-0 bg-red/10 flex items-center justify-center relative">
                {avatarPreview ? (
                  <img
          loading="lazy"
                    src={avatarPreview}
                    alt="preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-red font-bold text-2xl font-display">
                    {profile?.username?.[0]?.toUpperCase()}
                  </span>
                )}
                {avatarUpload.processing && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {/* Mode toggle */}
                <div className="flex gap-1 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrlMode(false);
                      clearAvatar();
                    }}
                    className={
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors " +
                      (!avatarUrlMode
                        ? "bg-red/20 text-red border border-red/30"
                        : "text-gray-500 hover:text-white border border-surface-border")
                    }
                  >
                    Upload file
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrlMode(true);
                      clearAvatar();
                    }}
                    className={
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors " +
                      (avatarUrlMode
                        ? "bg-red/20 text-red border border-red/30"
                        : "text-gray-500 hover:text-white border border-surface-border")
                    }
                  >
                    Paste URL
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={clearAvatar}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-red border border-red/30 hover:bg-red/10 transition-colors ml-auto"
                    >
                      ✕ Remove
                    </button>
                  )}
                </div>

                {!avatarUrlMode ? (
                  <div>
                    <input
                      ref={avatarFileRef}
                      type="file"
                      accept="image/*,.gif,.heic,.heif,.avif"
                      className="hidden"
                      onChange={(e) => {
                        avatarUpload.pickFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => avatarFileRef.current?.click()}
                      disabled={avatarUpload.processing}
                      className="w-full border border-dashed border-surface-border rounded-lg py-3 text-xs text-gray-500 hover:border-red/40 hover:text-gray-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
                    >
                      <span>{avatarUpload.processing ? "⏳" : "💾"}</span>
                      {avatarUpload.processing
                        ? "Optimising image..."
                        : "Browse image — JPEG, PNG, WEBP, GIF, HEIC (max 5 MB)"}
                    </button>

                    {/* Progress bar */}
                    {avatarUpload.processing && (
                      <div className="mt-2 h-1 w-full rounded-full bg-surface-border overflow-hidden">
                        <div
                          className="h-full bg-red rounded-full transition-all duration-300"
                          style={{ width: avatarUpload.progress + "%" }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    className="input text-sm"
                    placeholder="https://example.com/avatar.jpg"
                    value={form.profile_picture || ""}
                    onChange={(e) => handleAvatarUrl(e.target.value)}
                  />
                )}

                {/* Error */}
                {avatarUpload.error && (
                  <p
                    className="text-xs mt-1.5 flex items-center gap-1"
                    style={{ color: "#ff4655" }}
                  >
                    ⚠ {avatarUpload.error}
                  </p>
                )}

                {/* Success */}
                {avatarPreview &&
                  !avatarUpload.processing &&
                  !avatarUpload.error && (
                    <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />{" "}
                      Ready to save
                    </p>
                  )}
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Username
              </label>
              <input
                className="input"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({ ...f, username: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Country
              </label>
              <input
                className="input"
                placeholder="India"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Region
              </label>
              <input
                className="input"
                placeholder="South Asia"
                value={form.region}
                onChange={(e) =>
                  setForm((f) => ({ ...f, region: e.target.value }))
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">Bio</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Tell the community about yourself..."
                value={form.bio}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bio: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Saving..." : "Save Loadout"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-card rounded-lg p-1 mb-6 self-start w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={
              "px-4 py-2 rounded-md text-sm font-medium transition-all " +
              (activeTab === t.id
                ? "bg-red text-white"
                : "text-gray-400 hover:text-white")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-3 animate-fade-in">
          {games.length === 0 ? (
            <div className="card text-center py-10 text-gray-500">
              No game profiles yet.{" "}
              <a href="/games" className="text-red hover:underline">
                Add games to your library
              </a>{" "}
              to see stats here.
            </div>
          ) : (
            games.map((game) => (
              <div
                key={game.game_id}
                className="card flex flex-wrap items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{game.game_name}</p>
                  <p className="text-xs text-gray-500">{game.genre}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {game.rank && <span className="badge-blue">{game.rank}</span>}
                  {game.role && <span className="badge-gray">{game.role}</span>}
                  {game.matches_played > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Matches</p>
                      <p className="font-bold text-white text-sm">
                        {game.matches_played}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "games" && (
        <div className="space-y-3 animate-fade-in">
          {games.length === 0 ? (
            <div className="card text-center py-10 text-gray-500">
              No games in library.{" "}
              <a href="/games" className="text-red hover:underline">
                Explore the Grid →
              </a>
            </div>
          ) : (
            games.map((game) => (
              <div key={game.game_id} className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-navy flex items-center justify-center text-xl">
                  🎮
                </div>
                <div>
                  <p className="font-semibold text-white">{game.game_name}</p>
                  <p className="text-xs text-gray-500">
                    {game.developer || game.genre}
                  </p>
                </div>
                {game.rank && (
                  <span className="ml-auto badge-blue">{game.rank}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "gameids" && (
        <GameIdsTab
          gameIds={gameIds}
          gameIdsForm={gameIdsForm}
          setGameIdsForm={setGameIdsForm}
          savingGameIds={savingGameIds}
          onSave={async () => {
            setSavingGameIds(true);
            try {
              const res = await updateGameIds(gameIdsForm);
              const updated = res.data.game_ids || {};
              setGameIds(updated);
              setGameIdsForm(updated);
              showToast("Game IDs saved!");
            } catch {
              showToast("Failed to save Game IDs");
            } finally {
              setSavingGameIds(false);
            }
          }}
        />
      )}

      {activeTab === "achievements" && (
        <AchievementsTab username={profile?.username} />
      )}

      {activeTab === "teams" && (
        <>
        <div className="space-y-3 animate-fade-in">
          {myTeams.length === 0 ? (
            <div className="card text-center py-10 text-gray-500">
              <div className="text-4xl mb-3 opacity-30">🛡️</div>
              <p className="font-medium text-gray-400">
                You're not on any teams yet
              </p>
              <p className="text-sm mt-1">
                Create a team in{" "}
                <a href="/teamfinder" className="text-red hover:underline">
                  TeamUP Arena
                </a>{" "}
                to start recruiting
              </p>
            </div>
          ) : (
            myTeams.map((team) => (
              <div
                key={team.team_id}
                className="card flex flex-wrap items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-red/10 border border-red/20">
                  {team.game_icon ? (
                    <img
          loading="lazy"
                      src={team.game_icon}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg">⚔️</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{team.team_name}</p>
                    <TeamIdBadge teamId={team.team_id} />
                    {team.game_name && (
                      <span className="badge-red text-xs">
                        🎮 {team.game_name}
                      </span>
                    )}
                    {team.region && (
                      <span className="badge-gray text-xs">
                        📍 {team.region}
                      </span>
                    )}
                  </div>
                  {/* Member avatars */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {(team.members || []).slice(0, 6).map((m) => (
                      <a
                        key={m.user_id}
                        href={`/users/${m.user_id}`}
                        title={m.username}
                        className="relative hover:scale-110 transition-transform"
                      >
                        <div className="w-6 h-6 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-xs font-bold text-red overflow-hidden">
                          {m.profile_picture ? (
                            <img
          loading="lazy"
                              src={m.profile_picture}
                              alt={m.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            m.username?.[0]?.toUpperCase()
                          )}
                        </div>
                        {m.role === "captain" && (
                          <span className="absolute -top-0.5 -right-0.5 text-[7px] leading-none">
                            ⭐
                          </span>
                        )}
                      </a>
                    ))}
                    {(team.members || []).length > 6 && (
                      <span className="text-xs text-gray-500">
                        +{team.members.length - 6}
                      </span>
                    )}
                    <span className="text-xs text-gray-600 ml-1">
                      {(team.members || []).length} members
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold ${team.my_role === "captain" ? "bg-red/15 border border-red/30 text-red" : "bg-white/5 border border-white/10 text-gray-400"}`}
                  >
                    {team.my_role === "captain" ? "⭐ Captain" : "Member"}
                  </span>
                  <button
                    onClick={() => { setActiveChatTeam(team); setTeamChatOpen(true); }}
                    className="relative text-xs px-2.5 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                  >
                    💬 Chat
                    {unread.teams[team.team_id] > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red text-white text-[9px] flex items-center justify-center font-bold">
                        {unread.teams[team.team_id] > 9 ? "9+" : unread.teams[team.team_id]}
                      </span>
                    )}
                  </button>
                  <a
                    href="/teamfinder"
                    className="text-xs px-2.5 py-1 rounded-lg border border-surface-border text-gray-500 hover:text-white hover:border-red/30 transition-colors"
                  >
                    Manage
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
        <ChatDrawer
          open={teamChatOpen}
          onClose={() => setTeamChatOpen(false)}
          chatType="team"
          chatId={activeChatTeam?.team_id}
          title={activeChatTeam?.team_name || "Team Chat"}
          subtitle="Team group chat"
        />
        </>
      )}
    </div>
  );
}
