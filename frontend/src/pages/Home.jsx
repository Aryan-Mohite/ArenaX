import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { getTournaments } from "../services/tournamentService";
import { getLiveStreams } from "../services/streamService";
import TournamentCard from "../components/TournamentCard";

// ─── Skeleton loaders ────────────────────────────────────────────────────────
function SkeletonCard({ className = "" }) {
  return (
    <div className={`card animate-pulse ${className}`}>
      <div className="h-32 rounded-lg bg-surface-border/40 mb-4" />
      <div className="h-3 w-3/4 rounded bg-surface-border/40 mb-2" />
      <div className="h-3 w-1/2 rounded bg-surface-border/40" />
    </div>
  );
}

function StreamSkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-28 rounded-lg bg-surface-border/40 mb-3" />
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-surface-border/40 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/4 rounded bg-surface-border/40" />
          <div className="h-2.5 w-1/2 rounded bg-surface-border/40" />
        </div>
      </div>
    </div>
  );
}

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const numeric = parseFloat(target.replace(/[^0-9.]/g, ""));
    const suffix = target.replace(/[0-9.,]/g, "");
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * numeric));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return count;
}

// ─── Animated stat ─────────────────────────────────────────────────────────────
function AnimatedStat({ value, label, icon, triggered }) {
  const numeric = useCountUp(value, 1600, triggered);
  const suffix = value.replace(/[0-9.,]/g, "");
  return (
    <div className="text-center group px-2">
      <div className="text-2xl mb-1">{icon}</div>
      <p className="font-display font-bold text-2xl md:text-3xl text-white tabular-nums">
        {numeric.toLocaleString()}
        {suffix}
      </p>
      <p className="text-xs text-gray-500 mt-0.5 tracking-wide">{label}</p>
    </div>
  );
}

// ─── Game logos strip ──────────────────────────────────────────────────────────
const GAMES = [
  { name: "Valorant", color: "#ff4655", abbr: "VAL" },
  { name: "CS2", color: "#f4a523", abbr: "CS2" },
  { name: "League", color: "#c89b3c", abbr: "LoL" },
  { name: "Fortnite", color: "#00d4ff", abbr: "FN" },
  { name: "Dota 2", color: "#c23c2a", abbr: "D2" },
  { name: "Apex", color: "#fc4b08", abbr: "APX" },
];

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, message, linkTo, linkLabel }) {
  return (
    <div className="card text-center py-14 flex flex-col items-center gap-3">
      <div className="text-5xl opacity-30">{icon}</div>
      <p className="font-semibold text-white text-base">{title}</p>
      <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
        {message}
      </p>
      <Link to={linkTo} className="btn-ghost text-sm mt-1">
        {linkLabel} →
      </Link>
    </div>
  );
}

// ─── Error state ───────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }) {
  return (
    <div className="card text-center py-12 border-red/20">
      <p className="text-red text-sm mb-4">{message}</p>
      <button onClick={onRetry} className="btn-secondary text-sm px-6 py-2">
        Retry
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [tournaments, setTournaments] = useState([]);
  const [streams, setStreams] = useState([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [errorTournaments, setErrorTournaments] = useState(false);
  const [errorStreams, setErrorStreams] = useState(false);
  const [statsTriggered, setStatsTriggered] = useState(false);

  const statsRef = useRef(null);

  // ── Separate loaders so faster API doesn't wait for slower one ──
  const loadTournaments = async () => {
    setLoadingTournaments(true);
    setErrorTournaments(false);
    try {
      const res = await getTournaments({ limit: 3, status: "upcoming" });
      setTournaments(res.data.tournaments || []);
    } catch {
      setErrorTournaments(true);
    } finally {
      setLoadingTournaments(false);
    }
  };

  const loadStreams = async () => {
    setLoadingStreams(true);
    setErrorStreams(false);
    try {
      const res = await getLiveStreams({ limit: 4 });
      setStreams(res.data.streams || []);
    } catch {
      setErrorStreams(true);
    } finally {
      setLoadingStreams(false);
    }
  };

  useEffect(() => {
    loadTournaments();
    loadStreams();
  }, []);

  // ── Intersection observer for count-up animation ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStatsTriggered(true);
      },
      { threshold: 0.4 },
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="animate-fade-in">
      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden min-h-[92vh] flex items-center">
        {/* Background layers */}
        <div className="absolute inset-0 bg-red-glow pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(255,255,255,.15) 40px,rgba(255,255,255,.15) 41px),
                              repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,.15) 40px,rgba(255,255,255,.15) 41px)`,
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24 md:py-32 relative w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div className="max-w-2xl">
              <div className="badge-red mb-6 inline-flex items-center">
                <span className="live-dot mr-1.5" /> Live tournaments happening
                now
              </div>

              <h1 className="font-display font-bold text-5xl md:text-7xl text-white leading-none tracking-tight mb-6">
                COMPETE.
                <br />
                <span className="text-gradient">CONQUER.</span>
                <br />
                CONNECT.
              </h1>

              <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-lg">
                The ultimate platform for eSports. Find tournaments, build your
                team, stream your matches, and rise through the ranks.
              </p>

              <div className="flex flex-wrap gap-4 mb-10">
                {/* Primary CTA — dominant */}
                <Link
                  to="/tournament"
                  className="btn-primary text-base px-8 py-3 shadow-lg shadow-red/20"
                >
                  Browse Tournaments
                </Link>
                {/* Secondary CTA — ghost/outline */}
                <Link
                  to="/teamfinder"
                  className="btn-secondary text-base px-8 py-3"
                >
                  Find Teammates
                </Link>
              </div>

              {/* Social proof */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["A", "K", "R", "M", "J"].map((l, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-surface-card flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        background: [
                          "#ff4655",
                          "#f4a523",
                          "#00d4ff",
                          "#c89b3c",
                          "#fc4b08",
                        ][i],
                      }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-400">
                  Join <span className="text-white font-semibold">50+</span>{" "}
                  players already competing
                </p>
              </div>
            </div>

            {/* Right: game art panel */}
            <div className="hidden lg:flex items-center justify-center relative">
              <div className="relative w-full max-w-md aspect-square">
                {/* Glowing ring */}
                <div
                  className="absolute inset-0 rounded-full border border-red/20 animate-ping opacity-20"
                  style={{ animationDuration: "3s" }}
                />
                <div className="absolute inset-6 rounded-full border border-red/15" />
                <div className="absolute inset-12 rounded-full border border-red/10" />

                {/* Centre icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-40 h-40 rounded-full bg-red/10 border border-red/30 flex items-center justify-center backdrop-blur-sm">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                      <path
                        d="M32 8L56 20V44L32 56L8 44V20L32 8Z"
                        stroke="#ff4655"
                        strokeWidth="1.5"
                        fill="none"
                        opacity="0.6"
                      />
                      <path
                        d="M32 16L48 25V43L32 52L16 43V25L32 16Z"
                        fill="#ff4655"
                        opacity="0.15"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="8"
                        fill="#ff4655"
                        opacity="0.8"
                      />
                      <path
                        d="M24 32H18M40 32H46M32 24V18M32 40V46"
                        stroke="#ff4655"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Orbiting game badges */}
                {GAMES.slice(0, 6).map((g, i) => {
                  const angle = (i / 6) * 360 - 90;
                  const rad = (angle * Math.PI) / 180;
                  const r = 160;
                  const x = 50 + r * Math.cos(rad) * 0.5;
                  const y = 50 + r * Math.sin(rad) * 0.5;
                  return (
                    <div
                      key={g.abbr}
                      className="absolute w-11 h-11 rounded-full border flex items-center justify-center text-xs font-bold transform -translate-x-1/2 -translate-y-1/2 backdrop-blur-sm"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        borderColor: g.color + "55",
                        background: g.color + "18",
                        color: g.color,
                        animation: `float ${3 + i * 0.4}s ease-in-out infinite alternate`,
                      }}
                    >
                      {g.abbr}
                    </div>
                  );
                })}
              </div>

              {/* Glow behind panel */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at center, #ff465520 0%, transparent 70%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40">
          <div className="w-5 h-8 rounded-full border border-gray-600 flex items-start justify-center pt-1.5">
            <div
              className="w-1 h-2 rounded-full bg-gray-400"
              style={{ animation: "scrollDot 1.8s ease-in-out infinite" }}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          GAMES STRIP
      ══════════════════════════════════════════════════════ */}
      <div className="border-y border-surface-border bg-surface-card/30 py-5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">
            Supported games
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {GAMES.map((g) => (
              <div
                key={g.name}
                className="shrink-0 px-4 py-2 rounded-full border text-xs font-semibold tracking-wide transition-all duration-200 cursor-default hover:scale-105"
                style={{
                  borderColor: g.color + "40",
                  color: g.color,
                  background: g.color + "12",
                }}
              >
                {g.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════════ */}
      <div
        ref={statsRef}
        className="border-b border-surface-border bg-surface-card/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7 grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-surface-border/40">
          {[
            { label: "Active Players", value: "50+" },
            { label: "Tournaments Hosted", value: "100+" },
            { label: "Teams Assembeled", value: "20+" },
            { label: "Games Supported", value: "10+" },
          ].map((s) => (
            <AnimatedStat key={s.label} {...s} triggered={statsTriggered} />
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-20">
        {/* ══════════════════════════════════════════════════════
            UPCOMING TOURNAMENTS
        ══════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="section-title flex items-center gap-2">
                🏆 Upcoming Tournaments
              </h2>
              <p className="section-subtitle">Register before spots fill up</p>
            </div>
            <Link to="/tournament" className="btn-ghost text-sm">
              View all →
            </Link>
          </div>

          {loadingTournaments ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : errorTournaments ? (
            <ErrorState
              message="Could not load tournaments. Please try again."
              onRetry={loadTournaments}
            />
          ) : tournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tournaments.map((t) => (
                <TournamentCard key={t.tournament_id} tournament={t} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="🏆"
              title="No upcoming tournaments yet"
              message="New tournaments are added regularly. Check back soon or browse all available events."
              linkTo="/tournament"
              linkLabel="Browse all tournaments"
            />
          )}
        </section>

        {/* ══════════════════════════════════════════════════════
            LIVE STREAMS
        ══════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="section-title flex items-center gap-3">
                <span className="live-dot" />
                Live Streams
              </h2>
              <p className="section-subtitle">
                Watch top players compete right now
              </p>
            </div>
            <Link to="/stream" className="btn-ghost text-sm">
              See all →
            </Link>
          </div>

          {loadingStreams ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <StreamSkeletonCard key={i} />
              ))}
            </div>
          ) : errorStreams ? (
            <ErrorState
              message="Could not load live streams. Please try again."
              onRetry={loadStreams}
            />
          ) : streams.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {streams.map((s) => {
                const hasUrl = s.stream_url && s.stream_url !== "#";
                const Wrapper = hasUrl ? "a" : "div";
                const wrapperProps = hasUrl
                  ? { href: s.stream_url, target: "_blank", rel: "noreferrer" }
                  : {};

                return (
                  <Wrapper
                    key={s.stream_id}
                    {...wrapperProps}
                    className={`card group flex flex-col gap-0 p-0 overflow-hidden transition-all duration-200 ${hasUrl ? "card-hover cursor-pointer" : "cursor-default"}`}
                  >
                    {/* Thumbnail area */}
                    <div className="relative w-full aspect-video bg-gradient-to-br from-surface-border/60 to-surface-card flex items-center justify-center overflow-hidden">
                      {s.thumbnail_url ? (
                        <img
                          src={s.thumbnail_url}
                          alt={s.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 opacity-30">
                          <svg
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <polygon points="23 7 16 12 23 17 23 7" />
                            <rect
                              x="1"
                              y="5"
                              width="15"
                              height="14"
                              rx="2"
                              ry="2"
                            />
                          </svg>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 badge-red flex items-center gap-1 text-xs">
                        <span className="live-dot" />
                        LIVE
                      </span>
                      {!hasUrl && (
                        <span className="absolute top-2 right-2 text-xs bg-black/60 text-gray-400 px-2 py-0.5 rounded-full">
                          Offline
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold text-xs shrink-0">
                          {s.username?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {s.username}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {s.game_name}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                        {s.title}
                      </p>

                      <div className="flex items-center gap-1.5 mt-auto">
                        {/* Eye icon */}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-gray-400 shrink-0"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <p className="text-xs text-gray-400 font-medium">
                          {s.viewer_count?.toLocaleString() ?? "0"} viewers
                        </p>
                      </div>
                    </div>
                  </Wrapper>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="📺"
              title="No live streams right now"
              message="Nobody is streaming at the moment. You could be the first!"
              linkTo="/stream"
              linkLabel="Start streaming"
            />
          )}
        </section>

        {/* ══════════════════════════════════════════════════════
            CTA
        ══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-2xl border border-surface-border">
          {/* Stark contrast background — different from hero */}
          <div className="absolute inset-0 bg-surface-card" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 30% 50%, #ff465515 0%, transparent 60%)",
            }}
          />

          {/* Decorative left accent line */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-red to-transparent opacity-60" />

          <div className="relative px-8 md:px-16 py-16 text-center">
            {/* Social proof avatars */}
            <div className="flex justify-center items-center gap-2 mb-6">
              <div className="flex -space-x-2">
                {["T", "S", "V", "A", "N"].map((l, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-surface-card flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      background: [
                        "#ff4655",
                        "#00d4ff",
                        "#c89b3c",
                        "#fc4b08",
                        "#f4a523",
                      ][i],
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-400 ml-1">
                50,000+ players competing
              </p>
            </div>

            <h2 className="font-display font-bold text-3xl md:text-4xl text-white mb-3">
              Ready to compete?
            </h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Create your account, pick your games and jump into your first
              tournament today.
            </p>

            <div className="flex justify-center gap-4 flex-wrap">
              <Link
                to="/register"
                className="btn-primary px-8 py-3 text-base shadow-lg shadow-red/20"
              >
                Create Free Account
              </Link>
              <Link to="/games" className="btn-secondary px-8 py-3 text-base">
                Browse Games
              </Link>
            </div>

            {/* Trust signals */}
            <div className="flex justify-center gap-6 mt-6 flex-wrap">
              {["Free forever", "No credit card", "Cancel anytime"].map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 text-xs text-gray-500"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-green-500"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── Keyframe styles ── */}
      <style>{`
        @keyframes float {
          from { transform: translate(-50%, -50%) translateY(0px); }
          to   { transform: translate(-50%, -50%) translateY(-10px); }
        }
        @keyframes scrollDot {
          0%   { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(10px); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
