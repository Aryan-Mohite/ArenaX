import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import SEO from "../components/SEO";
import { getGameBySlug, getAllGames } from "../data/games";
import { getGames } from "../services/gameService";
import { getTournaments } from "../services/tournamentService";
import { getPosts } from "../services/teamFinderService";

// ─── Live stats strip ───────────────────────────────────────────────────────
// Progressive enhancement only: this fetches from the live API client-side
// after mount. It's wrapped so that if the API is unreachable (e.g. during
// the react-snap prerender step in CI, which has no DB access), the page
// still renders complete, crawlable static content below — this strip just
// silently stays hidden instead of blocking or erroring the page.
function LiveStats({ slug }) {
  const [stats, setStats] = useState(null); // null = not loaded, false = failed

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const gamesRes = await getGames();
        const match = (gamesRes.data.games || []).find((g) => g.slug === slug);
        if (!match) {
          if (!cancelled) setStats(false);
          return;
        }
        const [tRes, pRes] = await Promise.all([
          getTournaments({ game_id: match.game_id, status: "upcoming", limit: 50 }),
          getPosts({ game_id: match.game_id, limit: 50 }),
        ]);
        if (!cancelled) {
          setStats({
            game_id: match.game_id,
            tournamentCount: (tRes.data.tournaments || []).length,
            teamPostCount: (pRes.data.posts || []).length,
          });
        }
      } catch {
        if (!cancelled) setStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!stats) return null;

  return (
    <div className="flex flex-wrap gap-4 mb-8">
      <div className="card px-5 py-3 flex items-center gap-2">
        <span className="live-dot" />
        <span className="text-sm text-white font-semibold">
          {stats.tournamentCount} upcoming tournament{stats.tournamentCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="card px-5 py-3 flex items-center gap-2">
        <span className="text-sm text-white font-semibold">
          {stats.teamPostCount} open team finder post{stats.teamPostCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

export default function GamePage() {
  const { slug } = useParams();
  const game = getGameBySlug(slug);

  if (!game) {
    return <Navigate to="/404" replace />;
  }

  const otherGames = getAllGames()
    .filter((g) => g.slug !== game.slug)
    .slice(0, 4);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: game.game_name,
      genre: game.genre,
      publisher: game.developer,
      datePublished: String(game.release_year),
      image: game.cover_image,
      description: game.description,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Games", item: "https://arenax.io/games" },
        {
          "@type": "ListItem",
          position: 2,
          name: game.game_name,
          item: `https://arenax.io/games/${game.slug}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: game.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <div className="animate-fade-in">
      <SEO
        title={`${game.game_name} Tournaments & Team Finder`}
        description={`Join free ${game.game_name} tournaments on ArenaX and find teammates with our ${game.game_name} team finder. ${game.description.split(".")[0]}.`}
        path={`/games/${game.slug}`}
        image={game.cover_image}
        jsonLd={jsonLd}
      />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-red-glow pointer-events-none opacity-60" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20 relative">
          <nav className="text-xs text-gray-500 mb-6" aria-label="Breadcrumb">
            <Link to="/games" className="hover:text-gray-300">
              Games
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-300">{game.game_name}</span>
          </nav>

          <div className="grid lg:grid-cols-[1fr_320px] gap-10 items-start">
            <div>
              <div className="badge-red mb-4 inline-flex items-center">
                {game.genre}
              </div>
              <h1 className="font-display font-bold text-4xl md:text-5xl text-white leading-tight tracking-tight mb-4">
                {game.game_name} Tournaments &amp; Team Finder
              </h1>
              <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-2xl">
                {game.intro}
              </p>

              <div className="flex flex-wrap gap-4 mb-2">
                <Link
                  to="/tournament"
                  className="btn-primary text-base px-8 py-3 shadow-lg shadow-red/20"
                >
                  Browse {game.game_name} Tournaments
                </Link>
                <Link to="/teamfinder" className="btn-secondary text-base px-8 py-3">
                  Find {game.game_name} Teammates
                </Link>
              </div>
            </div>

            {game.cover_image && (
              <div className="rounded-xl overflow-hidden border border-surface-border">
                <img
                  src={game.cover_image}
                  alt={`${game.game_name} cover art`}
                  loading="lazy"
                  className="w-full h-auto object-cover"
                />
              </div>
            )}
          </div>

          <LiveStats slug={game.slug} />
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-16">
        {/* ── Why compete ── */}
        <section>
          <h2 className="section-title mb-6">
            Why compete in {game.game_name} on ArenaX
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {game.whyCompete.map((point) => (
              <div key={point} className="card p-5">
                <p className="text-gray-300 text-sm leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── About the game ── */}
        <section>
          <h2 className="section-title mb-4">About {game.game_name}</h2>
          <p className="text-gray-400 leading-relaxed max-w-3xl">
            {game.description}
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 max-w-2xl">
            <div>
              <dt className="text-xs text-gray-500">Genre</dt>
              <dd className="text-sm text-white font-semibold">{game.genre}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Developer</dt>
              <dd className="text-sm text-white font-semibold">{game.developer}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Released</dt>
              <dd className="text-sm text-white font-semibold">{game.release_year}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Platforms</dt>
              <dd className="text-sm text-white font-semibold">{game.platforms}</dd>
            </div>
          </dl>
        </section>

        {/* ── FAQ ── */}
        <section>
          <h2 className="section-title mb-6">
            {game.game_name} Tournament FAQ
          </h2>
          <div className="space-y-4 max-w-3xl">
            {game.faqs.map((f) => (
              <div key={f.q} className="card p-5">
                <p className="text-white font-semibold text-sm mb-1.5">{f.q}</p>
                <p className="text-gray-400 text-sm leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Other games ── */}
        <section>
          <h2 className="section-title mb-6">Other games on ArenaX</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {otherGames.map((g) => (
              <Link
                key={g.slug}
                to={`/games/${g.slug}`}
                className="card p-4 hover:-translate-y-1 transition-transform duration-200"
              >
                <p className="text-white font-semibold text-sm">{g.game_name}</p>
                <p className="text-gray-500 text-xs mt-1">{g.genre}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
