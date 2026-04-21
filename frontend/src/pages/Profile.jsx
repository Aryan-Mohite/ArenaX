import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { getMe } from "../services/authService";
import { updateProfile, upsertGameProfile, getMyStats } from "../services/userService";
import { getMyGames } from "../services/gameService";
import { PageLoader, ErrorMessage, StatCard } from "../components/UI";
import { useAuth } from "../context/AuthContext";

async function backendFetch(path) {
  const res = await fetch(`/api/stats${path}`);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || `Stats fetch failed (${res.status})`);
  return data.data;
}

const FETCHERS = {
  chess: { label: "Chess.com username", placeholder: "e.g. hikaru", icon: "♟", async fetch(username) { const [statsRes, profileRes] = await Promise.all([fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}/stats`), fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}`)]); if (!statsRes.ok) throw new Error("Chess.com player not found"); const [stats, profile] = await Promise.all([statsRes.json(), profileRes.json()]); const rapid = stats?.chess_rapid?.last; const blitz = stats?.chess_blitz?.last; const bullet = stats?.chess_bullet?.last; const best = rapid || blitz || bullet; return { rank: profile.title || (best?.rating >= 2000 ? "Expert" : best?.rating >= 1500 ? "Intermediate" : "Beginner"), elo_rating: best?.rating || null, role: profile.title || "Player", extra: [{ label: "Rapid", value: rapid?.rating || "—" }, { label: "Blitz", value: blitz?.rating || "—" }, { label: "Bullet", value: bullet?.rating || "—" }, { label: "Country", value: profile.country?.split("/").pop()?.toUpperCase() || "—" }, { label: "Followers", value: profile.followers || "—" }], avatar: profile.avatar || null, label: `Chess.com: ${profile.username || username}` }; } },
  minecraft: { label: "Minecraft username", placeholder: "e.g. Notch", icon: "⛏", async fetch(username) { const res = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(username)}`); if (!res.ok) throw new Error("Minecraft player not found"); const data = await res.json(); if (!data.success) throw new Error("Player not found"); const p = data.data.player; return { rank: "Verified", elo_rating: null, role: "Minecrafter", extra: [{ label: "UUID", value: p.id?.slice(0, 8) + "..." }, { label: "Username", value: p.username }, { label: "Edition", value: "Java" }], avatar: `https://crafatar.com/avatars/${p.id}?size=64&overlay`, label: p.username || username }; } },
  roblox: { label: "Roblox username", placeholder: "e.g. Builderman", icon: "🟥", async fetch(username) { const searchRes = await fetch("https://users.roblox.com/v1/usernames/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }) }); if (!searchRes.ok) throw new Error("Roblox API error"); const searchData = await searchRes.json(); const user = searchData.data?.[0]; if (!user) throw new Error("Roblox user not found"); const profileRes = await fetch(`https://users.roblox.com/v1/users/${user.id}`); const profile = await profileRes.json(); return { rank: profile.hasVerifiedBadge ? "Verified" : "Player", elo_rating: null, role: "Roblox Player", extra: [{ label: "Display Name", value: profile.displayName }, { label: "User ID", value: profile.id }, { label: "Verified", value: profile.hasVerifiedBadge ? "Yes" : "No" }, { label: "Joined", value: new Date(profile.created).getFullYear() }], avatar: null, label: profile.displayName || username }; } },
  valorant: { label: "Riot ID (Name#Tag)", placeholder: "e.g. Nexus Shivaay#7277", icon: "🎯", async fetch(riotId) { const h = riotId.lastIndexOf("#"); if (h === -1) throw new Error("Format must be Name#Tag"); return backendFetch(`/valorant/${encodeURIComponent(riotId.slice(0,h).trim())}/${encodeURIComponent(riotId.slice(h+1).trim())}`); } },
  lol: { label: "Riot ID (Name#Tag)", placeholder: "e.g. Faker#KR1", icon: "⚔️", async fetch(riotId) { const h = riotId.lastIndexOf("#"); const name = h !== -1 ? riotId.slice(0,h).trim() : riotId.trim(); const tag = h !== -1 ? riotId.slice(h+1).trim() : "EUW"; return backendFetch(`/lol/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`); } },
  fortnite: { label: "Epic Games username", placeholder: "e.g. Ninja", icon: "🏗️", async fetch(u) { return backendFetch(`/fortnite/${encodeURIComponent(u)}`); } },
  dota2: { label: "OpenDota / Steam32 ID", placeholder: "e.g. 87278757", icon: "🛡️", async fetch(u) { return backendFetch(`/dota2/${encodeURIComponent(u)}`); } },
  apex: { label: "EA / Origin username", placeholder: "e.g. shroud", icon: "🔥", async fetch(u) { return backendFetch(`/apex/${encodeURIComponent(u)}`); } },
  pubg: { label: "PUBG PC username", placeholder: "e.g. shroud", icon: "🪖", async fetch(u) { return backendFetch(`/pubg/${encodeURIComponent(u)}`); } },
  r6: { label: "Ubisoft username", placeholder: "e.g. Pengu", icon: "🔫", async fetch(u) { return backendFetch(`/r6/${encodeURIComponent(u)}`); } },
  steam: { label: "Steam Custom URL ID", placeholder: "e.g. gabelogannewell", icon: "🎮", async fetch(u) { return backendFetch(`/steam/${encodeURIComponent(u)}`); } },
  brawlstars: { label: "Brawl Stars Player Tag", placeholder: "e.g. 2PP (no # needed)", icon: "⭐", async fetch(tag) { return backendFetch(`/brawlstars/${encodeURIComponent(tag.replace(/^#/, ""))}`); } },
  cod: { label: "Activision ID (name#1234567)", placeholder: "e.g. shroud#1234567", icon: "💣", async fetch(u) { return backendFetch(`/cod/${encodeURIComponent(u)}`); } },
  mlbb: { label: "MLBB Player ID (numeric)", placeholder: "e.g. 123456789", icon: "⚡", async fetch(u) { return backendFetch(`/mlbb/${encodeURIComponent(u)}`); } },
};

const GAME_TO_FETCHER = { chess: "chess", "chess.com": "chess", steam: "steam", minecraft: "minecraft", roblox: "roblox", valorant: "valorant", "league of legends": "lol", league: "lol", fortnite: "fortnite", "dota 2": "dota2", dota2: "dota2", dota: "dota2", pubg: "pubg", battlegrounds: "pubg", "battlegrounds mobile india": "pubg", "counter-strike": "steam", "counter strike": "steam", "rainbow six": "r6", "rainbow 6": "r6", siege: "r6", "brawl stars": "brawlstars", brawlstars: "brawlstars", "apex legends": "apex", apex: "apex", "call of duty": "cod", warzone: "cod", cod: "cod", "mobile legends": "mlbb", mlbb: "mlbb", "free fire": null, "street fighter": null, madden: null, "ea sports": null, "mech arena": null };

function detectFetcher(gameName = "") { const lower = gameName.toLowerCase(); for (const [key, fetcherKey] of Object.entries(GAME_TO_FETCHER)) { if (lower.includes(key)) return fetcherKey; } return null; }

// ── Share Player Card Modal ────────────────────────────────────────────────────────
function ShareModal({ profile, onClose }) {
  const [copied, setCopied] = useState(false);
  const profileUrl = `${window.location.origin}/users/${profile?.user_id}`;
  const handleCopy = () => { navigator.clipboard.writeText(profileUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const shareOptions = [
    { label: "Twitter / X", icon: "𝕏", color: "hover:bg-black/40 hover:border-white/20", action: () => window.open(`https://twitter.com/intent/tweet?text=Check+out+${profile?.username}'s+gaming+profile!&url=${encodeURIComponent(profileUrl)}`, "_blank") },
    { label: "WhatsApp", icon: "💬", color: "hover:bg-green-500/10 hover:border-green-500/30", action: () => window.open(`https://wa.me/?text=Check+out+${profile?.username}'s+gaming+profile:+${encodeURIComponent(profileUrl)}`, "_blank") },
    { label: "Copy Link", icon: "🔗", color: "hover:bg-blue-500/10 hover:border-blue-500/30", action: handleCopy },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)", background: "rgba(2,6,23,0.75)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-surface-border overflow-hidden animate-slide-up" style={{ background: "linear-gradient(145deg,#1a2340,#131a2e)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div><h3 className="font-display font-bold text-white">Share Player Card</h3><p className="text-xs text-gray-500 mt-0.5">@{profile?.username}</p></div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-lg">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 bg-navy border border-surface-border rounded-lg px-3 py-2.5 text-sm text-gray-400 truncate">{profileUrl}</div>
            <button onClick={handleCopy} className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${copied ? "bg-green-500/20 text-green-400 border border-green-500/30" : "btn-primary"}`}>{copied ? "✓ Copied!" : "Copy"}</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {shareOptions.map((opt) => (
              <button key={opt.label} onClick={opt.action} className={`flex flex-col items-center gap-2 px-3 py-3 rounded-xl border border-surface-border transition-all ${opt.color}`}>
                <span className="text-2xl">{opt.icon}</span>
                <span className="text-xs text-gray-400">{opt.label}</span>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-red/15 p-4 flex items-center gap-3" style={{ background: "linear-gradient(135deg,rgba(255,70,85,0.06),rgba(26,35,64,0.8))" }}>
            {profile?.profile_picture ? (
              <img src={profile.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover border border-red/30 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold shrink-0">{profile?.username?.[0]?.toUpperCase()}</div>
            )}
            <div className="min-w-0"><p className="font-semibold text-white text-sm">{profile?.username}</p><p className="text-xs text-gray-500 truncate">{profile?.bio || "Gaming Profile"}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Follow Stats Modal ─────────────────────────────────────────────────────────
function FollowStatsModal({ type, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: "blur(8px)", background: "rgba(2,6,23,0.75)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-surface-border overflow-hidden animate-slide-up" style={{ background: "linear-gradient(145deg,#1a2340,#131a2e)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h3 className="font-display font-bold text-white capitalize">{type}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-lg">✕</button>
        </div>
        <div className="px-5 py-10 text-center text-gray-500 text-sm">
          <span className="text-3xl block mb-3">👥</span>
          {type === "followers" ? "Your followers will appear here." : "People you follow will appear here."}
          <p className="text-xs mt-2 text-gray-600">Full list feature coming soon!</p>
        </div>
      </div>
    </div>
  );
}

// ── GameStatsFetcher ───────────────────────────────────────────────────────────
function GameStatsFetcher({ game, onSave }) {
  const fetcherKey = detectFetcher(game.game_name);
  const fetcher = FETCHERS[fetcherKey];
  const [query, setQuery] = useState(""); const [loading, setLoading] = useState(false); const [result, setResult] = useState(null); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  if (!fetcher) return (
    <div className="rounded-xl border border-surface-border bg-navy/40 px-4 py-3 flex items-center gap-3">
      <span className="text-2xl opacity-60">📊</span>
      <div className="flex-1"><p className="text-sm font-semibold text-white">{game.game_name}</p><p className="text-xs text-gray-500 mt-0.5">No public API available — rank updated via tournaments &amp; matches.</p></div>
      <div className="flex flex-wrap gap-1.5 shrink-0">{game.rank && <span className="badge-blue">{game.rank}</span>}{game.elo_rating && <span className="badge-gray">ELO {game.elo_rating}</span>}</div>
    </div>
  );
  const handleFetch = async () => { if (!query.trim()) return; setLoading(true); setError(""); setResult(null); setSaved(false); try { setResult(await fetcher.fetch(query.trim())); } catch (err) { setError(err.message || "Failed to fetch stats"); } finally { setLoading(false); } };
  const handleSave = async () => { try { await onSave({ game_id: game.game_id, rank: result.rank, role: result.role, elo_rating: result.elo_rating }); setSaved(true); } catch { setError("Failed to save stats"); } };
  return (
    <div className="rounded-2xl border border-surface-border overflow-hidden" style={{ background: "linear-gradient(145deg,#1a2340,#131a2e)" }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border">
        <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 flex items-center justify-center text-xl shrink-0">{fetcher.icon}</div>
        <div className="flex-1 min-w-0"><p className="font-semibold text-white text-sm">{game.game_name}</p><p className="text-xs text-gray-500">Sync enabled</p></div>
        <div className="flex flex-wrap gap-1.5 shrink-0">{game.rank && <span className="badge-blue">{game.rank}</span>}{game.elo_rating && <span className="badge-gray">ELO {game.elo_rating}</span>}</div>
      </div>
      <div className="px-5 py-4">
        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">{fetcher.label}</label>
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" placeholder={fetcher.placeholder} value={query} onChange={(e) => { setQuery(e.target.value); setResult(null); setError(""); setSaved(false); }} onKeyDown={(e) => e.key === "Enter" && handleFetch()} />
          <button onClick={handleFetch} disabled={loading || !query.trim()} className="btn-primary flex items-center gap-2 px-4 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>🔍</span>}
            {loading ? "" : "Fetch"}
          </button>
        </div>
        {error && <p className="text-red text-xs mt-2 flex items-start gap-1.5"><span>⚠</span><span>{error}</span></p>}
      </div>
      {result && (
        <div className="mx-5 mb-5 rounded-xl border border-red/20 overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(255,70,85,0.06),rgba(26,35,64,0.8))" }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border/50">
            {result.avatar ? <img src={result.avatar} alt="" className="w-10 h-10 rounded-full border border-surface-border object-cover shrink-0" /> : <div className="w-10 h-10 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold shrink-0">{query[0]?.toUpperCase()}</div>}
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{result.label}</p><div className="flex gap-1.5 mt-0.5 flex-wrap">{result.rank && <span className="badge-blue text-xs">{result.rank}</span>}{result.role && <span className="badge-gray text-xs">{result.role}</span>}{result.elo_rating && <span className="badge-red text-xs">ELO {result.elo_rating}</span>}</div></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4">{result.extra.map(({ label, value }) => (<div key={label} className="bg-navy/60 rounded-lg px-3 py-2.5"><p className="text-xs text-gray-500 mb-0.5">{label}</p><p className="text-sm font-semibold text-white truncate">{value}</p></div>))}</div>
          <div className="px-4 pb-4 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">{saved ? "✓ Saved to your game profile" : "Save rank & ELO to your profile?"}</p>
            {saved ? <span className="badge-green text-xs">✓ Saved!</span> : <button onClick={handleSave} className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5">💾 Sync to Loadout</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Profile ───────────────────────────────────────────────────────────────
export default function Profile() {
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
  const [followStats, setFollowStats] = useState({ followers: 0, following: 0, community_posts: 0 });
  const [showShare, setShowShare] = useState(false);
  const [followModal, setFollowModal] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, gamesRes] = await Promise.all([getMe(), getMyGames()]);
        const p = meRes.data.user;
        setProfile(p);
        setForm({ username: p.username || "", bio: p.bio || "", country: p.country || "", region: p.region || "", profile_picture: p.profile_picture || "" });
        if (p.profile_picture) setAvatarPreview(p.profile_picture);
        setGames(gamesRes.data.games || []);
        try { const sr = await getMyStats(); setFollowStats(sr.data.stats || { followers: 0, following: 0, community_posts: 0 }); } catch {}
      } catch { setError("Failed to load profile"); } finally { setLoading(false); }
    };
    load();
  }, []);

  const handleAvatarFile = (file) => { if (!file) return; const reader = new FileReader(); reader.onload = (e) => { setAvatarPreview(e.target.result); setForm((f) => ({ ...f, profile_picture: e.target.result })); }; reader.readAsDataURL(file); };
  const handleAvatarUrl = (url) => { setAvatarPreview(url); setForm((f) => ({ ...f, profile_picture: url })); };
  const clearAvatar = () => { setAvatarPreview(null); setForm((f) => ({ ...f, profile_picture: "" })); if (avatarFileRef.current) avatarFileRef.current.value = ""; };

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const res = await updateProfile(form); const updated = res.data.user;
      setProfile((p) => ({ ...p, ...updated }));
      login({ ...authUser, username: updated.username, profile_picture: updated.profile_picture || authUser?.profile_picture || null }, token);
      setEditMode(false); showToast("Loadout updated!");
    } catch (err) { setError(err.response?.data?.message || "Loadout save failed"); } finally { setSaving(false); }
  };

  const handleGameStatsSave = async (data) => { await upsertGameProfile(data); const res = await getMyGames(); setGames(res.data.games || []); showToast("Stats synced!"); };

  if (loading) return <PageLoader />;

  const totalMatches = games.reduce((s, g) => s + (g.matches_played || 0), 0);
  const avgWinRate = games.length ? (games.reduce((s, g) => s + Number(g.win_rate || 0), 0) / games.length).toFixed(1) : null;
  const avgElo = games.length ? Math.round(games.reduce((s, g) => s + (g.elo_rating || 1000), 0) / games.length) : null;
  const TABS = [{ id: "overview", label: "Service Record" }, { id: "games", label: "Arsenal" }, { id: "gamestats", label: "⚡ Live Sync" }];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      {showShare && <ShareModal profile={profile} onClose={() => setShowShare(false)} />}
      {followModal && <FollowStatsModal type={followModal} onClose={() => setFollowModal(null)} />}
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-green-500/30 text-green-400 text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">{toast}</div>}

      {/* Profile Header */}
      <div className="card mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-red-glow pointer-events-none opacity-50" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="relative w-20 h-20 shrink-0 group">
            {profile?.profile_picture ? (
              <img src={profile.profile_picture} alt={profile.username} className="w-20 h-20 rounded-full object-cover border-2 border-red/40 glow-red" onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
            ) : null}
            <div className={"w-20 h-20 rounded-full bg-red/20 border-2 border-red/40 items-center justify-center text-red font-display font-bold text-3xl glow-red " + (profile?.profile_picture ? "hidden" : "flex")}>{profile?.username?.[0]?.toUpperCase()}</div>
            {!editMode && (<button onClick={() => setEditMode(true)} className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span className="text-white text-xs font-medium">✎ Edit</span></button>)}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display font-bold text-3xl text-white">{profile?.username}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{profile?.email}</p>
            {profile?.bio && <p className="text-gray-300 text-sm mt-2 max-w-lg">{profile.bio}</p>}

            {/* ── Followers / Following / Posts ── */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <button onClick={() => setFollowModal("followers")} className="flex items-center gap-1.5 group">
                <span className="font-bold text-white text-lg leading-none tabular-nums group-hover:text-red transition-colors">{followStats.followers.toLocaleString()}</span>
                <span className="text-gray-500 text-sm group-hover:text-gray-300 transition-colors">Followers</span>
              </button>
              <span className="text-surface-border text-lg">·</span>
              <button onClick={() => setFollowModal("following")} className="flex items-center gap-1.5 group">
                <span className="font-bold text-white text-lg leading-none tabular-nums group-hover:text-red transition-colors">{followStats.following.toLocaleString()}</span>
                <span className="text-gray-500 text-sm group-hover:text-gray-300 transition-colors">Following</span>
              </button>
              <span className="text-surface-border text-lg">·</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-lg leading-none tabular-nums">{followStats.community_posts.toLocaleString()}</span>
                <span className="text-gray-500 text-sm">Posts</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {profile?.country && <span className="badge-gray">📍 {profile.country}</span>}
              {profile?.region && <span className="badge-gray">🌏 {profile.region}</span>}
              <span className="badge-gray">Joined {new Date(profile?.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start shrink-0 flex-wrap justify-end">
            <button onClick={() => setShowShare(true)} title="Share profile"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-surface-border text-gray-400 hover:text-white hover:border-red/40 hover:bg-red/5 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            {profile?.user_id && (
              <Link
                to={`/users/${profile.user_id}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-border text-gray-400 hover:text-white hover:border-red/40 hover:bg-red/5 transition-all text-sm"
                title="See how your profile looks to others"
              >
                👁 Spectator View
              </Link>
            )}
            <button onClick={() => setEditMode(!editMode)} className="btn-secondary text-sm">{editMode ? "Cancel" : "Edit Loadout"}</button>
          </div>
        </div>
      </div>

      {/* Edit form */}
      {editMode && (
        <div className="card mb-6 animate-slide-up">
          <h3 className="font-display font-bold text-lg text-white mb-4">Edit Loadout</h3>
          <ErrorMessage message={error} />
          <div className="rounded-xl border border-surface-border bg-navy/40 p-4 mb-4">
            <label className="block text-xs text-gray-500 uppercase tracking-wider mb-3">📷 Profile Picture</label>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full border-2 border-surface-border overflow-hidden shrink-0 bg-red/10 flex items-center justify-center">
                {avatarPreview ? <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} /> : <span className="text-red font-bold text-2xl font-display">{profile?.username?.[0]?.toUpperCase()}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex gap-1 mb-2">
                  <button type="button" onClick={() => { setAvatarUrlMode(false); clearAvatar(); }} className={"px-2.5 py-1 rounded-lg text-xs font-medium transition-colors " + (!avatarUrlMode ? "bg-red/20 text-red border border-red/30" : "text-gray-500 hover:text-white border border-surface-border")}>Upload file</button>
                  <button type="button" onClick={() => { setAvatarUrlMode(true); clearAvatar(); }} className={"px-2.5 py-1 rounded-lg text-xs font-medium transition-colors " + (avatarUrlMode ? "bg-red/20 text-red border border-red/30" : "text-gray-500 hover:text-white border border-surface-border")}>Paste URL</button>
                  {avatarPreview && <button type="button" onClick={clearAvatar} className="px-2.5 py-1 rounded-lg text-xs font-medium text-red border border-red/30 hover:bg-red/10 transition-colors ml-auto">✕ Remove</button>}
                </div>
                {!avatarUrlMode ? (
                  <div><input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleAvatarFile(e.target.files?.[0])} /><button type="button" onClick={() => avatarFileRef.current?.click()} className="w-full border border-dashed border-surface-border rounded-lg py-3 text-xs text-gray-500 hover:border-red/40 hover:text-gray-300 transition-colors flex items-center justify-center gap-2">💾 Browse PNG, JPG, WEBP</button></div>
                ) : (
                  <input className="input text-sm" placeholder="https://example.com/avatar.jpg" value={form.profile_picture || ""} onChange={(e) => handleAvatarUrl(e.target.value)} />
                )}
                {avatarPreview && <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> New picture ready to save</p>}
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="block text-sm text-gray-400 mb-1.5">Username</label><input className="input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} /></div>
            <div><label className="block text-sm text-gray-400 mb-1.5">Country</label><input className="input" placeholder="India" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} /></div>
            <div><label className="block text-sm text-gray-400 mb-1.5">Region</label><input className="input" placeholder="South Asia" value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} /></div>
            <div className="sm:col-span-2"><label className="block text-sm text-gray-400 mb-1.5">Bio</label><textarea className="input resize-none" rows={3} placeholder="Tell the community about yourself..." value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end mt-4"><button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Loadout"}</button></div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Matches" value={totalMatches} />
        <StatCard label="Avg Win Rate" value={avgWinRate ? avgWinRate + "%" : "—"} />
        <StatCard label="Avg ELO" value={avgElo} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-card rounded-lg p-1 mb-6 self-start w-fit">
        {TABS.map((t) => (<button key={t.id} onClick={() => setActiveTab(t.id)} className={"px-4 py-2 rounded-md text-sm font-medium transition-all " + (activeTab === t.id ? "bg-red text-white" : "text-gray-400 hover:text-white")}>{t.label}</button>))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-3 animate-fade-in">
          {games.length === 0 ? <div className="card text-center py-10 text-gray-500">No game profiles yet. <a href="/games" className="text-red hover:underline">Add games to your library</a> to see stats here.</div>
            : games.map((game) => (
              <div key={game.game_id} className="card flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-0"><p className="font-semibold text-white">{game.game_name}</p><p className="text-xs text-gray-500">{game.genre}</p></div>
                <div className="flex flex-wrap gap-3">
                  {game.rank && <span className="badge-blue">{game.rank}</span>}
                  {game.role && <span className="badge-gray">{game.role}</span>}
                  {game.elo_rating && <div className="text-center"><p className="text-xs text-gray-500">ELO</p><p className="font-bold text-white text-sm">{game.elo_rating}</p></div>}
                  {game.win_rate && <div className="text-center"><p className="text-xs text-gray-500">Win Rate</p><p className="font-bold text-red text-sm">{Number(game.win_rate).toFixed(1)}%</p></div>}
                  {game.matches_played > 0 && <div className="text-center"><p className="text-xs text-gray-500">Matches</p><p className="font-bold text-white text-sm">{game.matches_played}</p></div>}
                </div>
              </div>
            ))}
        </div>
      )}

      {activeTab === "games" && (
        <div className="space-y-3 animate-fade-in">
          {games.length === 0 ? <div className="card text-center py-10 text-gray-500">No games in library. <a href="/games" className="text-red hover:underline">Explore the Grid →</a></div>
            : games.map((game) => (
              <div key={game.game_id} className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-navy flex items-center justify-center text-xl">🎮</div>
                <div><p className="font-semibold text-white">{game.game_name}</p><p className="text-xs text-gray-500">{game.developer || game.genre}</p></div>
                {game.rank && <span className="ml-auto badge-blue">{game.rank}</span>}
              </div>
            ))}
        </div>
      )}

      {activeTab === "gamestats" && (
        <div className="animate-fade-in">
          <div className="rounded-2xl border border-red/20 mb-6 px-5 py-4 flex gap-4 items-start" style={{ background: "linear-gradient(135deg,rgba(255,70,85,0.08),rgba(26,35,64,0.6))" }}>
            <div className="w-10 h-10 rounded-xl bg-red/15 border border-red/25 flex items-center justify-center text-xl shrink-0">⚡</div>
            <div>
              <p className="font-semibold text-white text-sm mb-0.5">⚡ Live Stat Sync</p>
              <p className="text-xs text-gray-400 leading-relaxed">Enter your username for supported games to pull live rank &amp; ELO from official APIs. Hit <strong className="text-white">Sync to Loadout</strong> to sync.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {[{ icon: "🎯", name: "Valorant" }, { icon: "🏗️", name: "Fortnite" }, { icon: "🛡️", name: "Dota 2" }, { icon: "⭐", name: "Brawl Stars" }, { icon: "🔥", name: "Apex Legends" }, { icon: "🪖", name: "PUBG" }, { icon: "🔫", name: "Rainbow Six" }, { icon: "💣", name: "COD" }, { icon: "⚡", name: "MLBB" }, { icon: "🎮", name: "Steam/CS2" }, { icon: "♟", name: "Chess.com" }, { icon: "⛏", name: "Minecraft" }, { icon: "🟥", name: "Roblox" }].map((g) => (
                  <span key={g.name} className="inline-flex items-center gap-1 badge-gray text-xs">{g.icon} {g.name}</span>
                ))}
              </div>
            </div>
          </div>
          {games.length === 0 ? <div className="card text-center py-10 text-gray-500">No games in library. <a href="/games" className="text-red hover:underline">Add games</a> to use auto-fetch.</div>
            : <div className="space-y-4">{games.map((game) => <GameStatsFetcher key={game.game_id} game={game} onSave={handleGameStatsSave} />)}</div>}
        </div>
      )}
    </div>
  );
}
