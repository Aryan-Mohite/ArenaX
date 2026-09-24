import { useEffect, useState, useCallback } from "react";
import {
  getGames,
  getMyGames,
  addFavouriteGame,
  removeFavGame,
  syncGames,
} from "../services/gameService";
import GameCard from "../components/GameCard";
import { PageLoader, EmptyState, ErrorMessage } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import SEO from "../components/SEO";

// ─── Genre accent colors ──────────────────────────────────────────────────────
const GENRE_COLORS = {
  "Tactical FPS": "#ff4655",
  FPS: "#ff4655",
  MOBA: "#c89b3c",
  "Battle Royale": "#0082ff",
  Sports: "#1D9E75",
  Fighting: "#fc4b08",
  RPG: "#a855f7",
  Strategy: "#14b8a6",
  Simulation: "#f4a523",
  default: "#888780",
};
const genreColor = (g) => GENRE_COLORS[g] || GENRE_COLORS.default;

// ─── Platform filter options ──────────────────────────────────────────────────
const PLATFORM_FILTERS = [
  { label: "All", value: "" },
  { label: "PC / Console", value: "PC" },
  { label: "Mobile", value: "Mobile" },
];

// ─── Skeleton card ────────────────────────────────────────────────────────────
function GameSkeleton() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  return (
    <div
      className="rounded-xl overflow-hidden animate-pulse"
      style={{
        background: isLight ? "var(--bg-card)" : "#1a2340",
        border: `1px solid ${isLight ? "var(--border-color)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      <div className="h-44 bg-surface-border/30" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-3/4 rounded bg-surface-border/40" />
        <div className="h-2.5 w-1/2 rounded bg-surface-border/40" />
        <div className="flex gap-1 pt-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-sm bg-surface-border/40"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Carousel slide background image (with graceful fallback) ─────────────────
function CarouselSlideImage({ game }) {
  const [err, setErr] = useState(false);
  const color = genreColor(game.genre);
  const abbr = game.game_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  const src = !err && (game.cover_image || game.icon);

  return src ? (
    <img
      loading="lazy"
      src={src}
      alt={game.game_name}
      className="absolute inset-0 w-full h-full object-cover"
      onError={() => setErr(true)}
    />
  ) : (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: `linear-gradient(160deg, ${color}40 0%, #0a0a1a 100%)`,
      }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center font-display font-black text-2xl"
        style={{
          background: color + "25",
          border: `2px solid ${color}60`,
          color,
        }}
      >
        {abbr}
      </div>
    </div>
  );
}

// ─── Single carousel slide ─────────────────────────────────────────────────────
function CarouselSlide({ game, rank, active }) {
  const color = genreColor(game.genre);
  return (
    <div
      className="absolute inset-0 transition-opacity duration-700 ease-in-out"
      style={{
        opacity: active ? 1 : 0,
        pointerEvents: active ? "auto" : "none",
      }}
    >
      <CarouselSlideImage game={game} />

      {/* Gradient overlays — left-to-right for text legibility, bottom for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(6,9,20,0.92) 0%, rgba(6,9,20,0.55) 42%, rgba(6,9,20,0.15) 70%, transparent 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(0deg, rgba(6,9,20,0.85) 0%, transparent 35%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end sm:justify-center px-6 sm:px-10 pb-14 sm:pb-0 max-w-xl">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center font-display font-black text-xs text-white shrink-0"
            style={{ background: color }}
          >
            {rank}
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md"
            style={{ background: color + "25", color, border: `1px solid ${color}50` }}
          >
            {game.genre || "Featured"}
          </span>
        </div>
        <h3 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight mb-2 drop-shadow-lg">
          {game.game_name}
        </h3>
        {game.rating && (
          <span className="text-sm font-bold text-yellow-400 tracking-wide">
            {"★".repeat(Math.round(game.rating))}
            {"☆".repeat(5 - Math.round(game.rating))}
            <span className="text-gray-400 font-normal ml-2 text-xs">
              {game.rating.toFixed?.(1) ?? game.rating} / 5
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Full-width auto-playing carousel gallery ("Top Tier Games") ──────────────
function GameCarousel({ games, loading }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [games.length]);

  useEffect(() => {
    if (paused || games.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % games.length);
    }, 5000);
    return () => clearInterval(t);
  }, [paused, games.length]);

  const goTo = (i) =>
    setIndex(((i % games.length) + games.length) % games.length);

  if (loading) {
    return (
      <div
        className="w-full h-[280px] sm:h-[380px] rounded-2xl overflow-hidden animate-pulse"
        style={{
          background: isLight ? "var(--bg-card)" : "#1a2340",
          border: `1px solid ${isLight ? "var(--border-color)" : "rgba(255,255,255,0.06)"}`,
        }}
      />
    );
  }

  if (!games.length) return null;

  return (
    <div
      className="relative w-full h-[280px] sm:h-[380px] rounded-2xl overflow-hidden group select-none"
      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {games.map((game, i) => (
        <CarouselSlide
          key={game.game_id}
          game={game}
          rank={i + 1}
          active={i === index}
        />
      ))}

      {/* Prev / Next arrows */}
      {games.length > 1 && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            aria-label="Previous game"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(4px)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Next game"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(4px)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {games.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {games.map((g, i) => (
            <button
              key={g.game_id}
              onClick={() => goTo(i)}
              aria-label={`Go to ${g.game_name}`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? "22px" : "7px",
                background: i === index ? "#ff4655" : "rgba(255,255,255,0.35)",
              }}
            />
          ))}
        </div>
      )}

      {/* "By Player Rating" badge, top-right */}
      <span className="absolute top-4 right-4 z-20 text-[10px] font-semibold text-gray-300 bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-sm">
        By Player Rating
      </span>
    </div>
  );
}

// ─── Active filter chip ───────────────────────────────────────────────────────
function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-red/30 text-red bg-red/10">
      {label}
      <button onClick={onRemove} className="hover:opacity-70 leading-none">
        ×
      </button>
    </span>
  );
}

// ─── Sync status banner (shows only when DB is empty) ─────────────────────────
function SyncBanner({ gameCount, onSync, syncing, syncResult }) {
  if (gameCount > 3) return null;
  return (
    <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="text-yellow-400 text-sm font-semibold">
          Games library is empty
        </p>
        <p className="text-gray-400 text-xs mt-0.5">
          Run a one-time sync to populate your library from the local games
          database.
        </p>
        {syncResult && (
          <p className="text-green-400 text-xs mt-1">{syncResult}</p>
        )}
      </div>
      <button
        onClick={onSync}
        disabled={syncing}
        className="shrink-0 text-xs px-4 py-2 rounded-lg font-bold transition-all"
        style={{
          background: "#f4a52320",
          color: "#f4a523",
          border: "1px solid #f4a52340",
        }}
      >
        {syncing ? "⏳ Syncing…" : "⚡ Sync Games"}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Games() {
  const { isAuthenticated } = useAuth();

  const [games, setGames] = useState([]);
  const [myGameIds, setMyGameIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [platform, setPlatform] = useState("");
  const [tab, setTab] = useState("all");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [sort, setSort] = useState("rating");
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState("");
  const PAGE_SIZE = 16;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // ── Load games from backend ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (genre) params.genre = genre;
      if (search) params.q = search;
      if (platform) params.platform = platform;

      const [gRes, myRes] = await Promise.allSettled([
        getGames(params),
        isAuthenticated ? getMyGames() : Promise.resolve(null),
      ]);

      const gameList =
        gRes.status === "fulfilled" ? gRes.value.data.games || [] : [];

      setGames(gameList);

      if (myRes.status === "fulfilled" && myRes.value) {
        setMyGameIds(
          new Set((myRes.value.data.games || []).map((g) => g.game_id)),
        );
      }
    } catch {
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, [genre, search, platform, isAuthenticated]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [genre, search, platform, tab, sort]);

  // ── Sync from local JSON ─────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    setSyncResult("");
    try {
      const res = await syncGames();
      const msg = res.data?.message || "Sync complete!";
      setSyncResult(msg);
      showToast("✅ Games synced!");
      await load();
    } catch (err) {
      setError(
        err.response?.data?.message || "Sync failed — check backend logs",
      );
    } finally {
      setSyncing(false);
    }
  };

  // ── Add / remove favourites ──────────────────────────────────────────────
  const handleAdd = async (game) => {
    if (!isAuthenticated) return;
    try {
      await addFavouriteGame({ game_id: game.game_id });
      setMyGameIds((prev) => new Set([...prev, game.game_id]));
      showToast(`${game.game_name} added to your library`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add game");
    }
  };

  const handleRemove = async (game_id) => {
    try {
      await removeFavGame(game_id);
      setMyGameIds((prev) => {
        const s = new Set(prev);
        s.delete(game_id);
        return s;
      });
      showToast("Game removed from library");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove game");
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const genres = [...new Set(games.map((g) => g.genre).filter(Boolean))];
  const myGames = games.filter((g) => myGameIds.has(g.game_id));
  const baseGames = tab === "my" ? myGames : games;

  const sortedGames = [...baseGames].sort((a, b) => {
    if (sort === "az") return a.game_name.localeCompare(b.game_name);
    if (sort === "za") return b.game_name.localeCompare(a.game_name);
    if (sort === "rating") return (b.rating || 0) - (a.rating || 0);
    return 0;
  });

  const totalPages = Math.ceil(sortedGames.length / PAGE_SIZE);
  const displayGames = sortedGames.slice(0, page * PAGE_SIZE);
  const hasMore = page < totalPages;

  const spotlightGames = [...games]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);

  return (
    <div className="animate-fade-in">
      <SEO
        title="Browse Games — Valorant, CS2, PUBG & More"
        description="Browse all games supported on ArenaX including Valorant, CS2, PUBG, BGMI, Free Fire, and more. Join tournaments and find teammates for your favorite game."
        path="/games"
      />
      {/* ── Hero banner ── */}
      <div className="relative border-b border-surface-border bg-surface-card/40 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 20% 50%, #ff465512 0%, transparent 60%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 relative">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                  eSports Platform
                </span>
                <span className="h-px w-8 bg-surface-border" />
                <span className="text-xs text-gray-600">The Grid</span>
              </div>
              <h1 className="font-display font-bold text-4xl md:text-5xl text-white tracking-tight">
                ALL <span className="text-gradient">GAMES</span>
              </h1>
              <p className="text-gray-400 mt-2 text-sm">
                Pick your games to get personalised tournament and team finder
                results
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-2 rounded-xl border border-surface-border bg-surface-card/60">
                <p className="font-display font-bold text-xl text-white">
                  {games.length || "—"}
                </p>
                <p className="text-xs text-gray-500">Games</p>
              </div>
              <div className="text-center px-4 py-2 rounded-xl border border-surface-border bg-surface-card/60">
                <p className="font-display font-bold text-xl text-white">
                  {myGameIds.size}
                </p>
                <p className="text-xs text-gray-500">✓ Enlisted</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sync banner ── */}
      {!loading && (
        <SyncBanner
          gameCount={games.length}
          onSync={handleSync}
          syncing={syncing}
          syncResult={syncResult}
        />
      )}

      {/* ── Top Tier Games — image carousel gallery ── */}
      {(loading || spotlightGames.length > 0) && (
        <div className="border-b border-surface-border bg-surface-card/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-4 bg-red rounded-full inline-block" />
                Top Tier Games
              </h2>
            </div>
            <GameCarousel games={spotlightGames} loading={loading} />
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-red/30 text-white text-sm px-5 py-3 rounded-full shadow-card animate-fade-in">
          {toast}
        </div>
      )}

      <ErrorMessage message={error} />

      {/* ── Main layout ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-8 items-start">
          {/* ── Left: main content ── */}
          <div className="flex-1 min-w-0">
            {/* Tabs + search */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="flex gap-1 bg-surface-card rounded-lg p-1 self-start shrink-0">
                {["all", "my"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                      tab === t
                        ? "bg-red text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {t === "all" ? "All Games" : "My Library"}
                    {t === "my" && myGameIds.size > 0 && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === "my" ? "bg-white/20 text-white" : "bg-red/20 text-red"}`}
                      >
                        {myGameIds.size}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <input
                className="input flex-1"
                placeholder="Search games…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Platform filter pills */}
            <div className="flex gap-2 flex-wrap mb-3">
              {PLATFORM_FILTERS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPlatform(p.value)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                    platform === p.value
                      ? "bg-red text-white border-red"
                      : "border-surface-border text-gray-400 hover:text-white hover:border-gray-500"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Genre pills */}
            <div className="flex gap-2 flex-wrap mb-4">
              <button
                onClick={() => setGenre("")}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition-all ${
                  genre === ""
                    ? "bg-red text-white border-red"
                    : "border-surface-border text-gray-400 hover:text-white hover:border-gray-500"
                }`}
              >
                All Genres
              </button>
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => setGenre(genre === g ? "" : g)}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold border transition-all"
                  style={
                    genre === g
                      ? {
                          background: genreColor(g),
                          color: "#fff",
                          borderColor: genreColor(g),
                        }
                      : {
                          borderColor: "rgba(255,255,255,0.1)",
                          color: "#9ca3af",
                        }
                  }
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Filter chips + count + sort */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {!loading && (
                  <span className="text-xs text-gray-500">
                    Showing{" "}
                    <span className="text-white font-semibold">
                      {displayGames.length}
                    </span>{" "}
                    of{" "}
                    <span className="text-white font-semibold">
                      {sortedGames.length}
                    </span>{" "}
                    games
                  </span>
                )}
                {genre && (
                  <FilterChip label={genre} onRemove={() => setGenre("")} />
                )}
                {platform && (
                  <FilterChip
                    label={platform}
                    onRemove={() => setPlatform("")}
                  />
                )}
                {search && (
                  <FilterChip
                    label={`"${search}"`}
                    onRemove={() => setSearch("")}
                  />
                )}
              </div>
              <select
                className="input text-xs py-1.5 h-auto w-auto pr-8"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="rating">Top Tier</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
              </select>
            </div>

            {/* Game grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <GameSkeleton key={i} />
                ))}
              </div>
            ) : displayGames.length === 0 ? (
              <EmptyState
                icon="🎮"
                title={
                  tab === "my" ? "Your library is empty" : "No games found"
                }
                subtitle={
                  tab === "my"
                    ? "Add games from the All Games tab"
                    : "Try syncing your game library or changing the filters"
                }
                action={
                  tab === "my" ? (
                    <button
                      onClick={() => setTab("all")}
                      className="btn-primary"
                    >
                      Browse Games
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSearch("");
                        setGenre("");
                        setPlatform("");
                      }}
                      className="btn-secondary"
                    >
                      Clear filters
                    </button>
                  )
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {displayGames.map((game) => (
                    <GameCard
                      key={game.game_id}
                      game={game}
                      isFav={myGameIds.has(game.game_id)}
                      onAdd={isAuthenticated ? handleAdd : undefined}
                      onRemove={isAuthenticated ? handleRemove : undefined}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="btn-secondary px-10 py-3 text-sm flex items-center gap-2"
                    >
                      Load more
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Right: sticky sidebar ── */}
          <div className="hidden lg:block w-56 shrink-0 sticky top-6 space-y-4">
            {/* Genre filter */}
            <div className="card py-4 px-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Genre
              </p>
              <div className="space-y-1">
                <button
                  onClick={() => setGenre("")}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-all ${genre === "" ? "bg-red/15 text-red font-semibold" : "text-gray-400 hover:text-white hover:bg-surface-border/30"}`}
                >
                  All genres
                </button>
                {genres.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenre(genre === g ? "" : g)}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg transition-all flex items-center justify-between"
                    style={
                      genre === g
                        ? {
                            background: genreColor(g) + "20",
                            color: genreColor(g),
                            fontWeight: 600,
                          }
                        : { color: "#9ca3af" }
                    }
                  >
                    <span>{g}</span>
                    {genre === g && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform filter */}
            <div className="card py-4 px-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Platform
              </p>
              <div className="space-y-1">
                {PLATFORM_FILTERS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPlatform(p.value)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-all ${
                      platform === p.value
                        ? "bg-red/15 text-red font-semibold"
                        : "text-gray-400 hover:text-white hover:bg-surface-border/30"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Library summary */}
            {isAuthenticated && myGameIds.size > 0 && (
              <div className="card py-4 px-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  My Library
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/20 flex items-center justify-center">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ff4655"
                      strokeWidth="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg leading-none">
                      {myGameIds.size}
                    </p>
                    <p className="text-gray-500 text-xs">games saved</p>
                  </div>
                </div>
                <button
                  onClick={() => setTab("my")}
                  className="w-full btn-ghost text-xs mt-3 py-1.5"
                >
                  View library →
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="card py-4 px-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Stats
              </p>
              <div className="space-y-2">
                {[
                  { label: "Total games", value: games.length || "—" },
                  { label: "Genres", value: genres.length || "—" },
                  { label: "Communities", value: games.length || "—" },
                ].map((s) => (
                  <div key={s.label} className="flex justify-between text-xs">
                    <span className="text-gray-500">{s.label}</span>
                    <span className="text-white font-semibold">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync button */}
            <div className="card py-4 px-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Admin
              </p>
              {syncResult && (
                <p className="text-green-400 text-[11px] mb-2 leading-snug">
                  {syncResult}
                </p>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="w-full text-sm py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                style={{
                  background: syncing
                    ? "rgba(244,165,35,0.08)"
                    : "rgba(244,165,35,0.12)",
                  color: "#f4a523",
                  border: "1px solid rgba(244,165,35,0.25)",
                  opacity: syncing ? 0.7 : 1,
                }}
              >
                {syncing ? (
                  <>
                    <svg
                      className="animate-spin"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Syncing…
                  </>
                ) : (
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Sync Games
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}