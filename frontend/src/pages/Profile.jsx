import { useEffect, useState, useRef } from "react";
import { useImageUpload } from "../hooks/useImageUpload";
import { Link } from "react-router-dom";
import { getMe } from "../services/authService";
import {
  updateProfile,
  upsertGameProfile,
  getMyStats,
} from "../services/userService";
import { getMyGames } from "../services/gameService";
import { PageLoader, ErrorMessage, StatCard } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import API from "../api/api";
import { useTheme } from "../context/ThemeContext";
import { themeStyles } from "../utils/themeStyles";

async function backendFetch(path) {
  const res = await fetch(`/api/stats${path}`);
  const data = await res.json();
  if (!res.ok || !data.success)
    throw new Error(data.message || `Stats fetch failed (${res.status})`);
  return data.data;
}

const FETCHERS = {
  // ── No key needed ─────────────────────────────────────────────────────────
  chess: {
    label: "Chess.com username",
    placeholder: "e.g. hikaru",
    icon: "♟",
    async fetch(username) {
      const [statsRes, profileRes] = await Promise.all([
        fetch(
          `https://api.chess.com/pub/player/${username.toLowerCase()}/stats`,
        ),
        fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}`),
      ]);
      if (!statsRes.ok) throw new Error("Chess.com player not found");
      const [stats, profile] = await Promise.all([
        statsRes.json(),
        profileRes.json(),
      ]);
      const rapid = stats?.chess_rapid?.last;
      const blitz = stats?.chess_blitz?.last;
      const bullet = stats?.chess_bullet?.last;
      const best = rapid || blitz || bullet;
      return {
        rank:
          profile.title ||
          (best?.rating >= 2000
            ? "Expert"
            : best?.rating >= 1500
              ? "Intermediate"
              : "Beginner"),
        elo_rating: best?.rating || null,
        role: profile.title || "Player",
        extra: [
          { label: "Rapid", value: rapid?.rating || "—" },
          { label: "Blitz", value: blitz?.rating || "—" },
          { label: "Bullet", value: bullet?.rating || "—" },
          {
            label: "Country",
            value: profile.country?.split("/").pop()?.toUpperCase() || "—",
          },
          { label: "Followers", value: profile.followers || "—" },
        ],
        avatar: profile.avatar || null,
        label: `Chess.com: ${profile.username || username}`,
      };
    },
  },
  minecraft: {
    label: "Minecraft username",
    placeholder: "e.g. Notch",
    icon: "⛏",
    async fetch(username) {
      const res = await fetch(
        `https://playerdb.co/api/player/minecraft/${encodeURIComponent(username)}`,
      );
      if (!res.ok) throw new Error("Minecraft player not found");
      const data = await res.json();
      if (!data.success) throw new Error("Player not found");
      const p = data.data.player;
      return {
        rank: "Verified",
        elo_rating: null,
        role: "Minecrafter",
        extra: [
          { label: "UUID", value: p.id?.slice(0, 8) + "..." },
          { label: "Username", value: p.username },
          { label: "Edition", value: "Java" },
        ],
        avatar: `https://crafatar.com/avatars/${p.id}?size=64&overlay`,
        label: p.username || username,
      };
    },
  },
  roblox: {
    label: "Roblox username",
    placeholder: "e.g. Builderman",
    icon: "🟥",
    async fetch(username) {
      const searchRes = await fetch(
        "https://users.roblox.com/v1/usernames/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usernames: [username],
            excludeBannedUsers: true,
          }),
        },
      );
      if (!searchRes.ok) throw new Error("Roblox API error");
      const searchData = await searchRes.json();
      const user = searchData.data?.[0];
      if (!user) throw new Error("Roblox user not found");
      const profileRes = await fetch(
        `https://users.roblox.com/v1/users/${user.id}`,
      );
      const profile = await profileRes.json();
      return {
        rank: profile.hasVerifiedBadge ? "Verified" : "Player",
        elo_rating: null,
        role: "Roblox Player",
        extra: [
          { label: "Display Name", value: profile.displayName },
          { label: "User ID", value: profile.id },
          { label: "Verified", value: profile.hasVerifiedBadge ? "Yes" : "No" },
          { label: "Joined", value: new Date(profile.created).getFullYear() },
        ],
        avatar: null,
        label: profile.displayName || username,
      };
    },
  },
  fortnite: {
    label: "Epic Games username",
    placeholder: "e.g. Ninja",
    icon: "🏗️",
    async fetch(u) {
      return backendFetch(`/fortnite/${encodeURIComponent(u)}`);
    },
  },
  dota2: {
    label: "OpenDota / Steam32 ID",
    placeholder: "e.g. 87278757",
    icon: "🛡️",
    async fetch(u) {
      return backendFetch(`/dota2/${encodeURIComponent(u)}`);
    },
  },
  pubg: {
    label: "PUBG PC username",
    placeholder: "e.g. shroud",
    icon: "🪖",
    async fetch(u) {
      return backendFetch(`/pubg/${encodeURIComponent(u)}`);
    },
  },
  r6: {
    label: "Ubisoft username",
    placeholder: "e.g. Pengu",
    icon: "🔫",
    async fetch(u) {
      return backendFetch(`/r6/${encodeURIComponent(u)}`);
    },
  },
  brawlstars: {
    label: "Brawl Stars player tag",
    placeholder: "e.g. 2PP (no # needed)",
    icon: "⭐",
    async fetch(tag) {
      return backendFetch(
        `/brawlstars/${encodeURIComponent(tag.replace(/^#/, ""))}`,
      );
    },
  },
  steam: {
    label: "Steam custom URL / Steam64 ID (CS2)",
    placeholder: "e.g. gabelogannewell",
    icon: "🎮",
    async fetch(u) {
      return backendFetch(`/steam/${encodeURIComponent(u)}`);
    },
  },
  // ── Needs HENRIKDEV_KEY in backend .env ───────────────────────────────────
  valorant: {
    label: "Riot ID (Name#Tag)",
    placeholder: "e.g. Nexus Shivaay#7277",
    icon: "🎯",
    async fetch(riotId) {
      const h = riotId.lastIndexOf("#");
      if (h === -1) throw new Error("Format must be Name#Tag");
      return backendFetch(
        `/valorant/${encodeURIComponent(riotId.slice(0, h).trim())}/${encodeURIComponent(riotId.slice(h + 1).trim())}`,
      );
    },
  },
  lol: {
    label: "Riot ID (Name#Tag)",
    placeholder: "e.g. Faker#KR1",
    icon: "⚔️",
    async fetch(riotId) {
      const h = riotId.lastIndexOf("#");
      const name = h !== -1 ? riotId.slice(0, h).trim() : riotId.trim();
      const tag = h !== -1 ? riotId.slice(h + 1).trim() : "EUW";
      return backendFetch(
        `/lol/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      );
    },
  },
  // ── Needs TRACKER_GG_KEY in backend .env ─────────────────────────────────
  apex: {
    label: "EA / Origin username",
    placeholder: "e.g. shroud",
    icon: "🔥",
    async fetch(u) {
      return backendFetch(`/apex/${encodeURIComponent(u)}`);
    },
  },
  rocketleague: {
    label: "Epic Games username (Rocket League)",
    placeholder: "e.g. Jstn",
    icon: "🚀",
    async fetch(u) {
      return backendFetch(`/rocketleague/${encodeURIComponent(u)}`);
    },
  },
  cod: {
    label: "Activision ID (name#1234567)",
    placeholder: "e.g. shroud#1234567",
    icon: "💣",
    async fetch(u) {
      return backendFetch(`/cod/${encodeURIComponent(u)}`);
    },
  },
  // ── Mobile games — no public API, shows "no API" info card ───────────────
  bgmi: {
    label: "BGMI username",
    placeholder: "e.g. YourUsername",
    icon: "🪖",
    async fetch(u) {
      return backendFetch(`/bgmi/${encodeURIComponent(u)}`);
    },
  },
  freefire: {
    label: "Free Fire username",
    placeholder: "e.g. YourUsername",
    icon: "🔥",
    async fetch(u) {
      return backendFetch(`/freefire/${encodeURIComponent(u)}`);
    },
  },
  codmobile: {
    label: "CoD Mobile username",
    placeholder: "e.g. YourUsername",
    icon: "💣",
    async fetch(u) {
      return backendFetch(`/codmobile/${encodeURIComponent(u)}`);
    },
  },
  mlbb: {
    label: "MLBB Player ID (numeric)",
    placeholder: "e.g. 123456789",
    icon: "⚡",
    async fetch(u) {
      return backendFetch(`/mlbb/${encodeURIComponent(u)}`);
    },
  },
  easportsfc: {
    label: "EA Sports FC username",
    placeholder: "e.g. YourUsername",
    icon: "⚽",
    async fetch(u) {
      return backendFetch(`/easportsfc/${encodeURIComponent(u)}`);
    },
  },
};

const GAME_TO_FETCHER = {
  chess: "chess",
  "chess.com": "chess",
  minecraft: "minecraft",
  roblox: "roblox",
  valorant: "valorant",
  "league of legends": "lol",
  league: "lol",
  fortnite: "fortnite",
  "dota 2": "dota2",
  dota2: "dota2",
  dota: "dota2",
  "pubg: battlegrounds": "pubg",
  pubg: "pubg",
  battlegrounds: "pubg",
  "counter-strike 2": "steam",
  "counter-strike": "steam",
  "counter strike": "steam",
  cs2: "steam",
  "rainbow six siege": "r6",
  "rainbow six": "r6",
  "rainbow 6": "r6",
  siege: "r6",
  "brawl stars": "brawlstars",
  brawlstars: "brawlstars",
  "apex legends": "apex",
  apex: "apex",
  "rocket league": "rocketleague",
  rocketleague: "rocketleague",
  "call of duty: warzone": "cod",
  warzone: "cod",
  steam: "steam",
  // Mobile — routes exist but return informational response (no public API)
  "battlegrounds mobile india": "bgmi",
  bgmi: "bgmi",
  "free fire": "freefire",
  freefire: "freefire",
  "garena free fire": "freefire",
  "call of duty: mobile": "codmobile",
  "cod mobile": "codmobile",
  "mobile legends: bang bang": "mlbb",
  "mobile legends": "mlbb",
  mlbb: "mlbb",
  "ea sports fc": "easportsfc",
  // Truly no support
  "mech arena": null,
  "street fighter": null,
  madden: null,
  "ea sports": null,
};

function detectFetcher(gameName = "") {
  const lower = gameName.toLowerCase().trim();
  if (GAME_TO_FETCHER.hasOwnProperty(lower)) return GAME_TO_FETCHER[lower];
  for (const [key, fetcherKey] of Object.entries(GAME_TO_FETCHER)) {
    if (lower.includes(key)) return fetcherKey;
  }
  return null;
}

// ── Share Player Card Modal ────────────────────────────────────────────────────────
function ShareModal({ profile, onClose }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";

  const [copied, setCopied] = useState(false);
  const profileUrl = `${window.location.origin}/users/${profile?.user_id}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const shareOptions = [
    {
      label: "Twitter / X",
      icon: "𝕏",
      color: "hover:bg-black/40 hover:border-white/20",
      action: () =>
        window.open(
          `https://twitter.com/intent/tweet?text=Check+out+${profile?.username}'s+gaming+profile!&url=${encodeURIComponent(profileUrl)}`,
          "_blank",
        ),
    },
    {
      label: "WhatsApp",
      icon: "💬",
      color: "hover:bg-green-500/10 hover:border-green-500/30",
      action: () =>
        window.open(
          `https://wa.me/?text=Check+out+${profile?.username}'s+gaming+profile:+${encodeURIComponent(profileUrl)}`,
          "_blank",
        ),
    },
    {
      label: "Copy Link",
      icon: "🔗",
      color: "hover:bg-blue-500/10 hover:border-blue-500/30",
      action: handleCopy,
    },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={ts.modalBackdropSm}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-surface-border overflow-hidden animate-slide-up"
        style={ts.cardBg}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <div>
            <h3 className="font-display font-bold text-white">
              Share Player Card
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">@{profile?.username}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-lg"
          >
            ✕
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 bg-navy border border-surface-border rounded-lg px-3 py-2.5 text-sm text-gray-400 truncate">
              {profileUrl}
            </div>
            <button
              onClick={handleCopy}
              className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${copied ? "bg-green-500/20 text-green-400 border border-green-500/30" : "btn-primary"}`}
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {shareOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={opt.action}
                className={`flex flex-col items-center gap-2 px-3 py-3 rounded-xl border border-surface-border transition-all ${opt.color}`}
              >
                <span className="text-2xl">{opt.icon}</span>
                <span className="text-xs text-gray-400">{opt.label}</span>
              </button>
            ))}
          </div>
          <div
            className="rounded-xl border border-red/15 p-4 flex items-center gap-3"
            style={{
              background:
                "linear-gradient(135deg,rgba(255,70,85,0.06),rgba(26,35,64,0.8))",
            }}
          >
            {profile?.profile_picture ? (
              <img
                src={profile.profile_picture}
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-red/30 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold shrink-0">
                {profile?.username?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm">
                {profile?.username}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {profile?.bio || "Gaming Profile"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Follow Stats Modal ─────────────────────────────────────────────────────────
function FollowStatsModal({ type, onClose }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={ts.modalBackdropSm}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-surface-border overflow-hidden animate-slide-up"
        style={ts.cardBg}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h3 className="font-display font-bold text-white capitalize">
            {type}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-lg"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-10 text-center text-gray-500 text-sm">
          <span className="text-3xl block mb-3">👥</span>
          {type === "followers"
            ? "Your followers will appear here."
            : "People you follow will appear here."}
          <p className="text-xs mt-2 text-gray-600">
            Full list feature coming soon!
          </p>
        </div>
      </div>
    </div>
  );
}

// ── GameStatsFetcher ───────────────────────────────────────────────────────────
function GameStatsFetcher({ game, onSave }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";

  const fetcherKey = detectFetcher(game.game_name);
  const fetcher = FETCHERS[fetcherKey];

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // ── No fetcher at all (truly unsupported game) ────────────────────────────
  if (!fetcher)
    return (
      <div className="rounded-xl border border-surface-border bg-navy/40 px-4 py-3 flex items-center gap-3">
        <span className="text-2xl opacity-60">📊</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{game.game_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            No public API available — rank updated via tournaments &amp;
            matches.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {game.rank && <span className="badge-blue">{game.rank}</span>}
          {game.elo_rating && (
            <span className="badge-gray">ELO {game.elo_rating}</span>
          )}
        </div>
      </div>
    );

  const handleFetch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSaved(false);
    try {
      setResult(await fetcher.fetch(query.trim()));
    } catch (err) {
      setError(err.message || "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await onSave({
        game_id: game.game_id,
        rank: result.rank,
        role: result.role,
        elo_rating: result.elo_rating,
      });
      setSaved(true);
    } catch {
      setError("Failed to save stats");
    }
  };

  // ── noApi result — mobile game, show info card only (no save button) ──────
  const NoApiResult = ({ result }) => (
    <div
      className="mx-5 mb-5 rounded-xl border border-yellow-500/20 overflow-hidden"
      style={{
        background: isLight ? "rgba(251,191,36,0.05)" : "linear-gradient(135deg,rgba(244,165,35,0.06),rgba(26,35,64,0.8))",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border/50">
        <span className="text-2xl">📵</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{result.label}</p>
          <p className="text-xs text-yellow-500/80 mt-0.5">No public API</p>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {result.extra.map(({ label, value }) => (
          <div key={label} className="bg-navy/60 rounded-lg px-3 py-2.5">
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className="text-sm text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="rounded-2xl border border-surface-border overflow-hidden"
      style={ts.cardBg}
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border">
        <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 flex items-center justify-center text-xl shrink-0">
          {fetcher.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{game.game_name}</p>
          <p className="text-xs text-gray-500">Sync enabled</p>
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {game.rank && <span className="badge-blue">{game.rank}</span>}
          {game.elo_rating && (
            <span className="badge-gray">ELO {game.elo_rating}</span>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-2">
          {fetcher.label}
        </label>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder={fetcher.placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResult(null);
              setError("");
              setSaved(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleFetch()}
          />
          <button
            onClick={handleFetch}
            disabled={loading || !query.trim()}
            className="btn-primary flex items-center gap-2 px-4 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>🔍</span>
            )}
            {loading ? "" : "Fetch"}
          </button>
        </div>
        {error && (
          <p className="text-red text-xs mt-2 flex items-start gap-1.5">
            <span>⚠</span>
            <span>{error}</span>
          </p>
        )}
      </div>

      {result && result.noApi && <NoApiResult result={result} />}

      {result && !result.noApi && (
        <div
          className="mx-5 mb-5 rounded-xl border border-red/20 overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg,rgba(255,70,85,0.06),rgba(26,35,64,0.8))",
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border/50">
            {result.avatar ? (
              <img
                src={result.avatar}
                alt=""
                className="w-10 h-10 rounded-full border border-surface-border object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold shrink-0">
                {query[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {result.label}
              </p>
              <div className="flex gap-1.5 mt-0.5 flex-wrap">
                {result.rank && (
                  <span className="badge-blue text-xs">{result.rank}</span>
                )}
                {result.role && (
                  <span className="badge-gray text-xs">{result.role}</span>
                )}
                {result.elo_rating && (
                  <span className="badge-red text-xs">
                    ELO {result.elo_rating}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4">
            {result.extra.map(({ label, value }) => (
              <div key={label} className="bg-navy/60 rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-white truncate">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {saved
                ? "✓ Saved to your game profile"
                : "Save rank & ELO to your profile?"}
            </p>
            {saved ? (
              <span className="badge-green text-xs">✓ Saved!</span>
            ) : (
              <button
                onClick={handleSave}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                💾 Sync to Loadout
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Profile ───────────────────────────────────────────────────────────────
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
          const sr = await getMyStats();
          setFollowStats(
            sr.data.stats || { followers: 0, following: 0, community_posts: 0 },
          );
        } catch {}
        try {
          const td = await API.get("/teams/mine");
          setMyTeams(td.data.teams || []);
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

  const handleGameStatsSave = async (data) => {
    await upsertGameProfile(data);
    const res = await getMyGames();
    setGames(res.data.games || []);
    showToast("Stats synced!");
  };

  if (loading) return <PageLoader />;

  const totalMatches = games.reduce((s, g) => s + (g.matches_played || 0), 0);
  const avgWinRate = games.length
    ? (
        games.reduce((s, g) => s + Number(g.win_rate || 0), 0) / games.length
      ).toFixed(1)
    : null;
  const avgElo = games.length
    ? Math.round(
        games.reduce((s, g) => s + (g.elo_rating || 1000), 0) / games.length,
      )
    : null;
  const TABS = [
    { id: "overview", label: "Service Record" },
    { id: "games", label: "Arsenal" },
    { id: "gamestats", label: "⚡ Live Sync" },
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

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Matches" value={totalMatches} />
        <StatCard
          label="Avg Win Rate"
          value={avgWinRate ? avgWinRate + "%" : "—"}
        />
        <StatCard label="Avg ELO" value={avgElo} />
      </div>

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
                  {game.elo_rating && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">ELO</p>
                      <p className="font-bold text-white text-sm">
                        {game.elo_rating}
                      </p>
                    </div>
                  )}
                  {game.win_rate && (
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Win Rate</p>
                      <p className="font-bold text-red text-sm">
                        {Number(game.win_rate).toFixed(1)}%
                      </p>
                    </div>
                  )}
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

      {activeTab === "gamestats" && (
        <div className="animate-fade-in">
          <div
            className="rounded-2xl border border-red/20 mb-6 px-5 py-4 flex gap-4 items-start"
            style={{
              background:
                "linear-gradient(135deg,rgba(255,70,85,0.08),rgba(26,35,64,0.6))",
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-red/15 border border-red/25 flex items-center justify-center text-xl shrink-0">
              ⚡
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-0.5">
                ⚡ Live Stat Sync
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Enter your username for supported games to pull live rank &amp;
                ELO from official APIs. Hit{" "}
                <strong className="text-white">Sync to Loadout</strong> to sync.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { icon: "🎯", name: "Valorant" },
                  { icon: "🏗️", name: "Fortnite" },
                  { icon: "🛡️", name: "Dota 2" },
                  { icon: "⭐", name: "Brawl Stars" },
                  { icon: "🔥", name: "Apex Legends" },
                  { icon: "🪖", name: "PUBG" },
                  { icon: "🔫", name: "Rainbow Six" },
                  { icon: "💣", name: "COD" },
                  { icon: "⚡", name: "MLBB" },
                  { icon: "🎮", name: "Steam/CS2" },
                  { icon: "♟", name: "Chess.com" },
                  { icon: "⛏", name: "Minecraft" },
                  { icon: "🟥", name: "Roblox" },
                  { icon: "🚀", name: "Rocket League" },
                  { icon: "🪖", name: "BGMI" },
                  { icon: "🔥", name: "Free Fire" },
                  { icon: "💣", name: "CoD Mobile" },
                  { icon: "⚽", name: "EA Sports FC" },
                ].map((g) => (
                  <span
                    key={g.name}
                    className="inline-flex items-center gap-1 badge-gray text-xs"
                  >
                    {g.icon} {g.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {games.length === 0 ? (
            <div className="card text-center py-10 text-gray-500">
              No games in library.{" "}
              <a href="/games" className="text-red hover:underline">
                Add games
              </a>{" "}
              to use auto-fetch.
            </div>
          ) : (
            <div className="space-y-4">
              {games.map((game) => (
                <GameStatsFetcher
                  key={game.game_id}
                  game={game}
                  onSave={handleGameStatsSave}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "teams" && (
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
      )}
    </div>
  );
}
