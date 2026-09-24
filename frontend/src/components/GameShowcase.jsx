import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getGames } from "../services/gameService";

gsap.registerPlugin(ScrollTrigger);

// ─── Genre accent colors — same map used on the Games page ─────────────────
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

// ─── Tile image with graceful fallback (matches Games.jsx CarouselSlideImage) ─
function GameTileImage({ game }) {
  const [err, setErr] = useState(false);
  const color = genreColor(game.genre);
  const abbr = (game.game_name || "")
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
      style={{ background: `linear-gradient(160deg, ${color}40 0%, #0a0a1a 100%)` }}
    >
      <span className="font-display font-black text-3xl" style={{ color }}>
        {abbr}
      </span>
    </div>
  );
}

function GameSkeletonTile() {
  return (
    <div
      className="shrink-0 w-60 sm:w-64 h-80 rounded-2xl animate-pulse"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
    />
  );
}

export default function GameShowcase() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const pinRef = useRef(null);
  const trackRef = useRef(null);
  const headingRef = useRef(null);

  // ── Load real games, already ordered by rating from the API ──
  useEffect(() => {
    (async () => {
      try {
        const res = await getGames();
        setGames((res.data.games || []).slice(0, 10));
      } catch {
        setGames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Pin the section and drag the track horizontally as the user scrolls ──
  useEffect(() => {
    if (loading || games.length === 0) return;

    const ctx = gsap.context(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) return;

      ScrollTrigger.matchMedia({
        "(min-width: 768px)": () => {
          const track = trackRef.current;
          const getDistance = () =>
            Math.max(track.scrollWidth - track.parentElement.offsetWidth, 0);

          // If the cards already fit the viewport (few games, wide screen),
          // there's nothing to slide — don't pin the section at all. A pin
          // with ~0px of travel just holds the page hostage for no visual
          // payoff, which is what was reading as "stuck."
          if (getDistance() < 40) return;

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: pinRef.current,
              start: "top top",
              // A small fixed pause at the end (not a % of distance) so the
              // last card is readable for a beat before release — not a
              // long dead zone that scales up with more cards.
              end: () => "+=" + (getDistance() + 80),
              scrub: 0.4,
              pin: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });

          tl.fromTo(
            headingRef.current,
            { opacity: 0.5, y: 12 },
            { opacity: 1, y: 0, ease: "power1.out", duration: 0.12 },
            0,
          );

          tl.to(
            track,
            { x: () => -getDistance(), ease: "none", duration: 1 },
            0,
          );
        },
      });
    }, pinRef);

    // This section's pin is created after an async data fetch, which adds
    // height to the page (a pin-spacer) above whatever comes next. Any
    // ScrollTrigger created earlier (e.g. the "How it works" rail below)
    // won't know about that extra height unless we force a recalculation —
    // otherwise it fires too early and the two pinned sections overlap.
    const refreshId = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(refreshId);
      ctx.revert();
    };
  }, [loading, games]);

  if (!loading && games.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="card text-center py-12">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No games available right now — check back soon.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={pinRef}
      className="relative py-16 md:py-0 md:min-h-[85vh] md:flex md:items-center overflow-hidden border-y"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-body)" }}
    >
      <div ref={headingRef} className="w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-end justify-between mb-8 gap-4">
          <div>
            <span className="badge-red inline-flex">Top tier games</span>
            <h2 className="font-display font-bold text-3xl md:text-4xl mt-4 text-theme-primary">
              Built for how you already play
            </h2>
          </div>
          <Link to="/games" className="btn-ghost text-sm hidden sm:inline-flex shrink-0">
            Browse all games →
          </Link>
        </div>

        <div className="overflow-hidden">
          <div
            ref={trackRef}
            className="flex gap-5 px-4 sm:px-6 will-change-transform"
          >
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <GameSkeletonTile key={i} />
                ))
              : games.map((g) => (
                  <Link
                    to="/games"
                    key={g.game_id || g.game_name}
                    className="shrink-0 w-60 sm:w-64 h-80 rounded-2xl overflow-hidden relative group"
                    style={{ border: "1px solid var(--border-color)" }}
                  >
                    <GameTileImage game={g} />
                    <div
                      className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-80"
                      style={{
                        background:
                          "linear-gradient(0deg, rgba(6,9,20,0.9) 0%, rgba(6,9,20,0.15) 55%, transparent 75%)",
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md"
                        style={{
                          background: genreColor(g.genre) + "30",
                          color: genreColor(g.genre),
                          border: `1px solid ${genreColor(g.genre)}55`,
                        }}
                      >
                        {g.genre || "Featured"}
                      </span>
                      <h3 className="font-display font-bold text-xl text-white mt-2 drop-shadow">
                        {g.game_name}
                      </h3>
                      {g.rating ? (
                        <p className="text-xs text-yellow-400 font-semibold mt-1">
                          ★ {Number(g.rating).toFixed(1)}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
          </div>
        </div>

        <div className="text-center mt-8 sm:hidden">
          <Link to="/games" className="btn-ghost text-sm">
            Browse all games →
          </Link>
        </div>
      </div>
    </section>
  );
}
