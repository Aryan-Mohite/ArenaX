/**
 * RAWG Video Games Database API service
 * Free tier: 20,000 requests/month — no credit card required
 * Docs: https://api.rawg.io/docs/
 */

const RAWG_BASE = "https://api.rawg.io/api";

// ─── Build request URL with API key ──────────────────────────────────────────
function rawgUrl(path, params = {}) {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) throw new Error("RAWG_API_KEY is not set in .env");

  const url = new URL(`${RAWG_BASE}${path}`);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

// ─── Lightweight fetch helper (Node 18+ has built-in fetch) ──────────────────
async function rawgFetch(path, params = {}) {
  const url = rawgUrl(path, params);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RAWG ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Map RAWG genre slugs → our platform genres ──────────────────────────────
const GENRE_MAP = {
  shooter:              "FPS",
  action:               "FPS",
  "massively-multiplayer": "MOBA",
  strategy:             "Strategy",
  sports:               "Sports",
  fighting:             "Fighting",
  "role-playing-games-rpg": "RPG",
  simulation:           "Simulation",
  racing:               "Sports",
  "battle-royale":      "Battle Royale",
};

function mapGenre(rawgGenres = []) {
  for (const g of rawgGenres) {
    const mapped = GENRE_MAP[g.slug];
    if (mapped) return mapped;
  }
  return rawgGenres[0]?.name || "Other";
}

// ─── Map RAWG platforms → simple string ──────────────────────────────────────
function mapPlatforms(platforms = []) {
  const names = platforms
    .map((p) => p.platform?.name)
    .filter(Boolean)
    .slice(0, 4);
  return names.join(", ");
}

// ─── Search games by name ─────────────────────────────────────────────────────
export async function searchGames(query, page = 1, pageSize = 20) {
  const data = await rawgFetch("/games", {
    search: query,
    page,
    page_size: pageSize,
    ordering: "-rating",
  });

  return data.results.map((g) => ({
    rawg_id:      g.id,
    game_name:    g.name,
    genre:        mapGenre(g.genres),
    developer:    null, // not in list endpoint — fetched in getDetails
    release_year: g.released ? parseInt(g.released.split("-")[0]) : null,
    cover_image:  g.background_image,
    rating:       g.rating ? parseFloat(g.rating.toFixed(2)) : null,
    rating_count: g.ratings_count || 0,
    platforms:    mapPlatforms(g.platforms),
    metacritic:   g.metacritic || null,
    slug:         g.slug,
  }));
}

// ─── Get full details for a single game ──────────────────────────────────────
export async function getGameDetails(rawgIdOrSlug) {
  const data = await rawgFetch(`/games/${rawgIdOrSlug}`);

  // Guard: RAWG can return a 200 with no name (redirects, TBD entries, etc.)
  if (!data.name || !data.id) {
    throw new Error(`RAWG returned no name for slug "${rawgIdOrSlug}" — skipping`);
  }

  const devs = (data.developers || []).map((d) => d.name).join(", ");
  return {
    rawg_id:      data.id,
    game_name:    data.name.trim(),
    genre:        mapGenre(data.genres),
    developer:    devs || null,
    release_year: data.released ? parseInt(data.released.split("-")[0]) : null,
    cover_image:  data.background_image || null,
    rating:       data.rating ? parseFloat(data.rating.toFixed(2)) : null,
    rating_count: data.ratings_count || 0,
    platforms:    mapPlatforms(data.platforms) || null,
    metacritic:   data.metacritic || null,
    description:  data.description_raw?.slice(0, 500) || null,
    website:      data.website || null,
    slug:         data.slug || String(rawgIdOrSlug),
    screenshots:  (data.short_screenshots || []).slice(0, 4).map((s) => s.image),
  };
}

// ─── Fetch the most popular esports titles ────────────────────────────────────
//     Slugs verified against RAWG as of 2025. Each is fetched individually so
//     a single 404 doesn't abort the whole sync.
const ESPORTS_GAMES = [
  "valorant",
  "counter-strike-2",
  "league-of-legends",
  "dota-2",
  "pubg-battlegrounds",
  "fortnite",
  "apex-legends",
  "overwatch-2",
  "rocket-league",
  "street-fighter-6",
  "call-of-duty-warzone",       // Warzone has its own slug (not mw3)
  "rainbow-six-siege",
  "grand-theft-auto-v",
  "minecraft",
  "fifa-22",                    // fifa-23 slug often 404s on free tier
  "age-of-empires-iv",
  "hearthstone",
  "starcraft-ii",
  "mortal-kombat-11",
  "tekken-7",
];

export async function fetchEsportsGames() {
  const results = [];
  for (const slug of ESPORTS_GAMES) {
    try {
      const details = await getGameDetails(slug);
      // Double-check game_name is present before accepting
      if (!details.game_name) {
        console.warn(`[RAWG] Empty game_name for slug "${slug}" — skipping`);
        continue;
      }
      results.push(details);
    } catch (err) {
      console.warn(`[RAWG] Could not fetch "${slug}": ${err.message}`);
    }
  }
  console.log(`[RAWG] fetchEsportsGames: ${results.length}/${ESPORTS_GAMES.length} fetched successfully`);
  return results;
}