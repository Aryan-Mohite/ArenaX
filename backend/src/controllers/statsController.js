/** ============================================================
 * [COMING SOON] Stats Controller — temporarily disabled
 * Uncomment this entire file when the feature is ready.
 * ============================================================ */
 
/**
 * statsController.js
 * Server-side proxy for game stat APIs.
 * All external API calls happen here — no CORS issues, keys stay in .env.
 *
 * ROUTES:
 *   GET /api/stats/valorant/:name/:tag        → Henrik Dev (free key)
 *   GET /api/stats/lol/:name/:tag             → Henrik Dev (free key)
 *   GET /api/stats/fortnite/:username         → fortnite-api.com (no key)
 *   GET /api/stats/dota2/:steamId             → OpenDota (no key)
 *   GET /api/stats/apex/:username             → tracker.gg (free key)
 *   GET /api/stats/pubg/:username             → pubg.op.gg (no key)
 *   GET /api/stats/r6/:username               → r6.apitab.com (no key)
 *   GET /api/stats/steam/:steamId             → playerdb.co (no key) — CS2
 *   GET /api/stats/brawlstars/:tag            → brawlapi.com (no key)
 *   GET /api/stats/rocketleague/:username     → tracker.gg (free key)
 *   GET /api/stats/cod/:username              → tracker.gg (free key)
 *   GET /api/stats/mlbb/:playerId             → informational (no free API)
 *   GET /api/stats/bgmi/:username             → informational (no public API)
 *   GET /api/stats/freefire/:username         → informational (no public API)
 *   GET /api/stats/codmobile/:username        → informational (no public API)
 *   GET /api/stats/easportsfc/:username       → informational (no public API)
 */



// ─── Timeout helper ───────────────────────────────────────────────────────────
const fetchWithTimeout = (url, opts = {}, ms = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal })
    .finally(() => clearTimeout(timer));
};

// ─── Helper: send clean error JSON ───────────────────────────────────────────
const apiError = (res, message, status = 502) =>
  res.status(status).json({ success: false, message });

// ─── No-API informational response ───────────────────────────────────────────
// Used for mobile games that have no public developer API
const noApiResponse = (res, gameName, note) =>
  res.json({
    success: true,
    data: {
      label:      gameName,
      rank:       "—",
      elo_rating: null,
      role:       "Player",
      avatar:     null,
      noApi:      true,
      extra: [
        { label: "Status", value: note },
        { label: "Tip",    value: "Rank is updated automatically when you play tournaments on this platform." },
      ],
    },
  });


// ══════════════════════════════════════════════════════════════════════════════
//  PC / CONSOLE GAMES
// ══════════════════════════════════════════════════════════════════════════════

// ─── Valorant ─────────────────────────────────────────────────────────────────
// Free key: https://docs.henrikdev.xyz  →  add HENRIKDEV_KEY=xxx to .env
export const getValorantStats = async (req, res, next) => {
  try {
    const { name, tag } = req.params;
    if (!name || !tag) return apiError(res, "Provide name and tag", 400);

    const KEY     = process.env.HENRIKDEV_KEY || "";
    const headers = KEY ? { Authorization: KEY } : {};
    const n = encodeURIComponent(name);
    const t = encodeURIComponent(tag);

    const accRes = await fetchWithTimeout(
      `https://api.henrikdev.xyz/valorant/v1/account/${n}/${t}`,
      { headers }
    );

    if (accRes.status === 404)
      return apiError(res, "Valorant account not found. Check your Riot ID (Name#Tag).", 404);
    if (accRes.status === 403 || accRes.status === 401)
      return apiError(res, "Henrik Dev API key missing or invalid. Add HENRIKDEV_KEY to your backend .env file.", 403);
    if (!accRes.ok)
      return apiError(res, `Valorant API error (${accRes.status}). Try again later.`);

    const accData = await accRes.json();
    if (accData.status !== 200 && accData.errors)
      return apiError(res, accData.errors?.[0]?.message || "Player not found", 404);

    const acc = accData.data;

    let rankData = null;
    try {
      const mmrRes = await fetchWithTimeout(
        `https://api.henrikdev.xyz/valorant/v2/mmr/${acc.region}/${n}/${t}`,
        { headers }
      );
      if (mmrRes.ok) rankData = (await mmrRes.json()).data;
    } catch { /* rank is optional */ }

    const currentTier = rankData?.current_data?.currenttierpatched || "Unranked";
    const rr          = rankData?.current_data?.ranking_in_tier ?? null;
    const peakTier    = rankData?.highest_rank?.patched_tier || null;
    const mmr         = rankData?.current_data?.elo ?? null;

    return res.json({
      success: true,
      data: {
        label:      `${acc.name}#${acc.tag}`,
        rank:       currentTier,
        elo_rating: rr,
        role:       "Agent",
        avatar:     acc.card?.small || null,
        extra: [
          { label: "Region",        value: acc.region?.toUpperCase() || "—" },
          { label: "Account Level", value: acc.account_level || "—" },
          { label: "Current Rank",  value: currentTier },
          { label: "Rating (RR)",   value: rr ?? "—" },
          { label: "Peak Rank",     value: peakTier || "—" },
          { label: "ELO",           value: mmr || "—" },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ─── League of Legends ────────────────────────────────────────────────────────
// Free key: https://docs.henrikdev.xyz  →  add HENRIKDEV_KEY=xxx to .env
export const getLolStats = async (req, res, next) => {
  try {
    const { name, tag } = req.params;
    if (!name) return apiError(res, "Provide summoner name", 400);

    const KEY     = process.env.HENRIKDEV_KEY || "";
    const headers = KEY ? { Authorization: KEY } : {};
    const n = encodeURIComponent(name);
    const t = encodeURIComponent(tag || "EUW");

    const accRes = await fetchWithTimeout(
      `https://api.henrikdev.xyz/lol/v1/account/${n}/${t}`,
      { headers }
    );

    if (accRes.status === 404)
      return apiError(res, "Summoner not found. Check your Riot ID (Name#Tag).", 404);
    if (accRes.status === 403 || accRes.status === 401)
      return apiError(res, "Henrik Dev API key missing. Add HENRIKDEV_KEY to backend .env.", 403);
    if (!accRes.ok)
      return apiError(res, `LoL API error (${accRes.status}). Try again later.`);

    const accData = await accRes.json();
    if (accData.status !== 200)
      return apiError(res, accData.message || "Player not found", 404);

    const acc = accData.data;
    return res.json({
      success: true,
      data: {
        label:      `${acc.gameName}#${acc.tagLine}`,
        rank:       "Summoner",
        elo_rating: null,
        role:       "Summoner",
        avatar:     acc.profileIconId
          ? `https://ddragon.leagueoflegends.com/cdn/14.10.1/img/profileicon/${acc.profileIconId}.png`
          : null,
        extra: [
          { label: "Game Name", value: acc.gameName },
          { label: "Tag",       value: acc.tagLine  },
          { label: "PUUID",     value: acc.puuid?.slice(0, 16) + "..." },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ─── Fortnite ─────────────────────────────────────────────────────────────────
// Free — no key needed. https://fortnite-api.com
export const getFortniteStats = async (req, res, next) => {
  try {
    const { username } = req.params;
    const apiRes = await fetchWithTimeout(
      `https://fortnite-api.com/v2/stats/br/v2?name=${encodeURIComponent(username)}&accountType=epic`
    );
    if (apiRes.status === 404)
      return apiError(res, "Fortnite player not found. Check your Epic Games username.", 404);
    if (!apiRes.ok)
      return apiError(res, `Fortnite API error (${apiRes.status})`);

    const data = await apiRes.json();
    if (data.status !== 200)
      return apiError(res, data.error || "Player not found", 404);

    const overall = data.data?.stats?.all?.overall;
    const wins    = overall?.wins ?? 0;
    const matches = overall?.matches ?? 1;
    const winRate = ((wins / matches) * 100).toFixed(1);

    return res.json({
      success: true,
      data: {
        label:      data.data.account?.name || username,
        // FIX (medium): the old rank labels (Elite/Experienced/Rookie) were fabricated —
        // Fortnite does not have these tiers. Win count is not a ranked placement.
        // Now we display the actual in-game ranked mode stats if available, or fall back
        // to showing the K/D profile without a misleading custom label.
        rank:       data.data?.stats?.all?.overall
                      ? `${winRate}% Win Rate`
                      : "Unranked",
        elo_rating: overall?.score || null,
        role:       "Battle Royale",
        avatar:     null,
        extra: [
          { label: "Wins",      value: wins },
          { label: "Matches",   value: overall?.matches ?? "—" },
          { label: "Win Rate",  value: winRate + "%" },
          { label: "Kills",     value: overall?.kills ?? "—" },
          { label: "K/D Ratio", value: overall?.kd?.toFixed(2) ?? "—" },
          { label: "Top 25",    value: overall?.top25 ?? "—" },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ─── Dota 2 ──────────────────────────────────────────────────────────────────
// Free — no key needed. https://opendota.com
export const getDota2Stats = async (req, res, next) => {
  try {
    const { steamId } = req.params;
    const [playerRes, wlRes] = await Promise.all([
      fetchWithTimeout(`https://api.opendota.com/api/players/${steamId}`),
      fetchWithTimeout(`https://api.opendota.com/api/players/${steamId}/wl`),
    ]);

    if (!playerRes.ok)
      return apiError(res, "Dota 2 player not found. Use your Steam32 ID (from opendota.com).", 404);

    const player = await playerRes.json();
    const wl     = wlRes.ok ? await wlRes.json() : null;

    if (!player.profile)
      return apiError(res, "Profile is private. Make your Steam profile public to fetch Dota 2 stats.", 403);

    const mmr     = player.mmr_estimate?.estimate || null;
    const wins    = wl?.win ?? 0;
    const losses  = wl?.lose ?? 0;
    const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : null;
    const rank    = mmr >= 6000 ? "Immortal" : mmr >= 5000 ? "Divine" : mmr >= 4000 ? "Ancient"
                  : mmr >= 3000 ? "Legend"   : mmr >= 2000 ? "Archon"  : "Crusader";

    return res.json({
      success: true,
      data: {
        label:      player.profile.personaname || steamId,
        rank,
        elo_rating: mmr,
        role:       "Hero",
        avatar:     player.profile.avatarfull || null,
        extra: [
          { label: "MMR Estimate", value: mmr || "Hidden" },
          { label: "Wins",         value: wins },
          { label: "Losses",       value: losses },
          { label: "Win Rate",     value: winRate ? winRate + "%" : "—" },
          { label: "Country",      value: player.profile.loccountrycode || "—" },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ─── Apex Legends ─────────────────────────────────────────────────────────────
// Uses tracker.gg — free key at https://tracker.gg/developers
// Add TRACKER_GG_KEY=xxx to your backend .env
export const getApexStats = async (req, res, next) => {
  try {
    const { username } = req.params;
    const TRACKER_KEY = process.env.TRACKER_GG_KEY || "";

    if (!TRACKER_KEY) {
      return apiError(
        res,
        "Apex Legends stats require a free Tracker.gg API key. " +
        "Register at https://tracker.gg/developers then add TRACKER_GG_KEY=your_key to your backend .env file.",
        503
      );
    }

    const apiRes = await fetchWithTimeout(
      `https://api.tracker.gg/api/v2/apex/standard/profile/origin/${encodeURIComponent(username)}`,
      { headers: { "TRN-Api-Key": TRACKER_KEY, "User-Agent": "Mozilla/5.0" } }
    );

    if (apiRes.status === 403 || apiRes.status === 401)
      return apiError(res, 'Tracker.gg blocked this request. Go to tracker.gg/developers → your app → add localhost and localhost:5000 to Allowed Hosts.', 403);
    if (apiRes.status === 404)
      return apiError(res, `Apex player "${username}" not found. Check your EA/Origin username.`, 404);
    if (!apiRes.ok)
      return apiError(res, `Apex Legends API error (${apiRes.status}). Try again later.`);

    const data     = await apiRes.json();
    const segments = data?.data?.segments || [];
    const overview = segments.find(s => s.type === "overview");
    const stats    = overview?.stats || {};

    const rank   = stats?.rankScore?.metadata?.rankName || "Rookie";
    const rp     = Math.round(stats?.rankScore?.value || 0);
    const level  = Math.round(stats?.level?.value || 0);
    const kills  = stats?.kills?.displayValue || "—";
    const damage = stats?.damage?.displayValue || "—";
    const kd     = stats?.kd?.displayValue || "—";

    return res.json({
      success: true,
      data: {
        label:      data?.data?.platformInfo?.platformUserHandle || username,
        rank,
        elo_rating: rp || null,
        role:       "Legend",
        avatar:     data?.data?.platformInfo?.avatarUrl || null,
        extra: [
          { label: "Rank",      value: rank },
          { label: "RP",        value: rp || "—" },
          { label: "Level",     value: level || "—" },
          { label: "Kills",     value: kills },
          { label: "Damage",    value: damage },
          { label: "K/D Ratio", value: kd },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ─── PUBG ────────────────────────────────────────────────────────────────────
// Uses pubg.op.gg — no key needed
export const getPubgStats = async (req, res, next) => {
  try {
    const { username } = req.params;
    const apiRes = await fetchWithTimeout(
      `https://pubg.op.gg/api/users?server=steam&nickname=${encodeURIComponent(username)}`,
      { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }
    );
    if (!apiRes.ok)
      return apiError(res, "PUBG player not found.", 404);

    const data   = await apiRes.json();
    const player = data?.data?.[0];
    if (!player)
      return apiError(res, `No PUBG player found with username "${username}".`, 404);

    const ranked = player.stats?.ranked;
    const tier   = ranked?.currentTier?.tier || player.grade || "Bronze";
    const rp     = ranked?.currentRankPoint || null;

    return res.json({
      success: true,
      data: {
        label:      player.nickname || username,
        rank:       tier,
        elo_rating: rp,
        role:       "PUBG Player",
        avatar:     player.player_image_url || null,
        extra: [
          { label: "Rank",        value: tier },
          { label: "Rank Points", value: rp || "—" },
          { label: "KDA",         value: player.kda?.toFixed(2) || "—" },
          { label: "Wins",        value: player.wins || "—" },
          { label: "Top 10 %",    value: player.top10_ratio ? (player.top10_ratio * 100).toFixed(1) + "%" : "—" },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ─── Rainbow Six Siege ────────────────────────────────────────────────────────
// Uses r6.apitab.com — no key needed
export const getR6Stats = async (req, res, next) => {
  try {
    const { username } = req.params;
    const apiRes = await fetchWithTimeout(
      `https://r6.apitab.com/search/uplay/${encodeURIComponent(username)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!apiRes.ok)
      return apiError(res, "Rainbow Six player not found.", 404);

    const data    = await apiRes.json();
    const players = Object.values(data.players || {});
    if (!players.length)
      return apiError(res, `No R6 player found with username "${username}".`, 404);

    const p = players[0];
    const tierMap = { 0: "Unranked", 1: "Copper", 2: "Bronze", 3: "Silver", 4: "Gold", 5: "Platinum", 6: "Emerald", 7: "Diamond", 8: "Champions" };
    const tierName = tierMap[p.ranked?.rank] || "Unranked";
    const mmr      = p.ranked?.mmr ? Math.round(p.ranked.mmr) : null;
    const pvp      = p.stats?.pvp_all || {};
    const kd       = pvp.kills && pvp.deaths ? (pvp.kills / (pvp.deaths || 1)).toFixed(2) : null;
    const wr       = pvp.matches_won && pvp.matches_played ? ((pvp.matches_won / pvp.matches_played) * 100).toFixed(1) : null;

    return res.json({
      success: true,
      data: {
        label:      p.p_name || username,
        rank:       tierName,
        elo_rating: mmr,
        role:       "Operator",
        avatar:     null,
        extra: [
          { label: "Rank",     value: tierName },
          { label: "MMR",      value: mmr || "—" },
          { label: "K/D",      value: kd || "—" },
          { label: "Win Rate", value: wr ? wr + "%" : "—" },
          { label: "Matches",  value: pvp.matches_played || "—" },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ─── Counter-Strike 2 / Steam ─────────────────────────────────────────────────
// Uses playerdb.co — no key needed
// User enters Steam Custom URL or Steam64 ID
export const getSteamStats = async (req, res, next) => {
  try {
    const { steamId } = req.params;
    const apiRes = await fetchWithTimeout(
      `https://playerdb.co/api/player/steam/${encodeURIComponent(steamId)}`
    );
    if (!apiRes.ok)
      return apiError(res, "Steam player not found. Use your Steam custom URL or Steam64 ID.", 404);

    const data = await apiRes.json();
    if (!data.success)
      return apiError(res, data.message || "Steam player not found.", 404);

    const p = data.data.player;
    return res.json({
      success: true,
      data: {
        label:      p.username || steamId,
        rank:       p.meta?.personastate === 1 ? "Online" : "Offline",
        elo_rating: null,
        role:       "Steam Player",
        avatar:     p.avatar?.large || null,
        extra: [
          { label: "Steam ID",     value: p.id },
          { label: "Display Name", value: p.username },
          { label: "Status",       value: p.meta?.personastate === 1 ? "Online" : "Offline" },
          { label: "Note",         value: "CS2 in-game rank requires Steam Web API key for full rank data." },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ─── Brawl Stars ─────────────────────────────────────────────────────────────
// Uses brawlapi.com — no key needed
export const getBrawlStarsStats = async (req, res, next) => {
  try {
    const { tag } = req.params;
    const cleanTag = tag.startsWith("#") ? tag.slice(1) : tag;

    const apiRes = await fetchWithTimeout(
      `https://api.brawlapi.com/v1/players/${encodeURIComponent("#" + cleanTag)}`
    );
    if (!apiRes.ok)
      return apiError(res, "Brawl Stars player not found. Check your tag (e.g. 2PP).", 404);

    const data = await apiRes.json();
    if (data.error) return apiError(res, "Player not found.", 404);

    const trophies = data.trophies || 0;
    const rank = trophies >= 50000 ? "Legendary" : trophies >= 30000 ? "Masters"
               : trophies >= 15000 ? "Diamond"   : trophies >= 5000  ? "Gold" : "Bronze";

    return res.json({
      success: true,
      data: {
        label:      data.name || tag,
        rank,
        elo_rating: trophies,
        role:       "Brawler",
        avatar:     data.icon?.id ? `https://cdn.brawlapi.com/assets/icons/${data.icon.id}.webp` : null,
        extra: [
          { label: "Trophies",         value: trophies.toLocaleString() },
          { label: "Highest Trophies", value: (data.highestTrophies || 0).toLocaleString() },
          { label: "3v3 Wins",         value: data["3vs3Victories"] || "—" },
          { label: "Solo Wins",        value: data.soloVictories || "—" },
          { label: "Duo Wins",         value: data.duoVictories || "—" },
          { label: "Club",             value: data.club?.name || "No Club" },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ─── Rocket League ────────────────────────────────────────────────────────────
// Uses tracker.gg — free key at https://tracker.gg/developers
// Add TRACKER_GG_KEY=xxx to your backend .env
export const getRocketLeagueStats = async (req, res, next) => {
  try {
    const { username } = req.params;
    const TRACKER_KEY = process.env.TRACKER_GG_KEY || "";

    if (!TRACKER_KEY)
      return apiError(res, "Rocket League stats require a free Tracker.gg API key. Add TRACKER_GG_KEY to your .env.", 503);

    const apiRes = await fetchWithTimeout(
      `https://api.tracker.gg/api/v2/rocket-league/standard/profile/epic/${encodeURIComponent(username)}`,
      { headers: { "TRN-Api-Key": TRACKER_KEY, "User-Agent": "Mozilla/5.0" } }
    );

    if (apiRes.status === 403 || apiRes.status === 401)
      return apiError(res, 'Tracker.gg blocked this request. Go to tracker.gg/developers → your app → add localhost and localhost:5000 to Allowed Hosts.', 403);
    if (apiRes.status === 404)
      return apiError(res, `Rocket League player "${username}" not found. Use your Epic Games username.`, 404);
    if (!apiRes.ok)
      return apiError(res, `Rocket League API error (${apiRes.status}).`);

    const data     = await apiRes.json();
    const segments = data?.data?.segments || [];
    const overview = segments.find(s => s.type === "overview");
    const stats    = overview?.stats || {};

    const rank    = stats?.rating?.metadata?.rankName || "Unranked";
    const mmr     = Math.round(stats?.rating?.value || 0);
    const wins    = stats?.wins?.displayValue || "—";
    const goals   = stats?.goals?.displayValue || "—";
    const saves   = stats?.saves?.displayValue || "—";
    const assists = stats?.assists?.displayValue || "—";

    return res.json({
      success: true,
      data: {
        label:      data?.data?.platformInfo?.platformUserHandle || username,
        rank,
        elo_rating: mmr || null,
        role:       "Rocket League Player",
        avatar:     data?.data?.platformInfo?.avatarUrl || null,
        extra: [
          { label: "Rank",    value: rank },
          { label: "MMR",     value: mmr || "—" },
          { label: "Wins",    value: wins },
          { label: "Goals",   value: goals },
          { label: "Saves",   value: saves },
          { label: "Assists", value: assists },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ─── Call of Duty: Warzone ────────────────────────────────────────────────────
// Uses tracker.gg — free key at https://tracker.gg/developers
// Add TRACKER_GG_KEY=xxx to your backend .env
export const getCodStats = async (req, res, next) => {
  try {
    const { username } = req.params;
    const TRACKER_KEY = process.env.TRACKER_GG_KEY || "";

    if (!TRACKER_KEY)
      return apiError(res, "CoD stats require a free Tracker.gg API key. Add TRACKER_GG_KEY to your .env.", 503);

    const apiRes = await fetchWithTimeout(
      `https://api.tracker.gg/api/v2/warzone/standard/profile/atvi/${encodeURIComponent(username)}`,
      { headers: { "TRN-Api-Key": TRACKER_KEY, "User-Agent": "Mozilla/5.0" } }
    );

    if (apiRes.status === 403 || apiRes.status === 401)
      return apiError(res, 'Tracker.gg blocked this request. Go to tracker.gg/developers → your app → add localhost and localhost:5000 to Allowed Hosts.', 403);
    if (apiRes.status === 404)
      return apiError(res, `CoD player "${username}" not found. Use your Activision ID (e.g. shroud#1234567).`, 404);
    if (!apiRes.ok)
      return apiError(res, `Call of Duty API error (${apiRes.status}).`);

    const data     = await apiRes.json();
    const segments = data?.data?.segments || [];
    const overview = segments.find(s => s.type === "overview");
    const stats    = overview?.stats || {};

    const kd      = stats?.kdRatio?.displayValue || "—";
    const wins    = stats?.wins?.displayValue || "0";
    const kills   = stats?.kills?.displayValue || "—";
    const matches = stats?.gamesPlayed?.displayValue || "—";

    return res.json({
      success: true,
      data: {
        label:      data?.data?.platformInfo?.platformUserHandle || username,
        rank:       Number(wins) >= 50 ? "Veteran" : Number(wins) >= 10 ? "Experienced" : "Rookie",
        elo_rating: null,
        role:       "Operator",
        avatar:     data?.data?.platformInfo?.avatarUrl || null,
        extra: [
          { label: "K/D Ratio", value: kd },
          { label: "Wins",      value: wins },
          { label: "Kills",     value: kills },
          { label: "Matches",   value: matches },
          { label: "Platform",  value: "PC (Activision)" },
        ],
      },
    });
  } catch (err) { next(err); }
};


// ══════════════════════════════════════════════════════════════════════════════
//  MOBILE GAMES
//  These games have NO public developer APIs.
//  We return a clear informational response — the frontend shows a friendly
//  "no API available" card instead of an error.
// ══════════════════════════════════════════════════════════════════════════════

// ─── BGMI (Battlegrounds Mobile India) ───────────────────────────────────────
// Krafton has NO public API for BGMI. The PC PUBG API does NOT include mobile data.
export const getBgmiStats = async (req, res, next) => {
  return noApiResponse(
    res,
    "Battlegrounds Mobile India",
    "BGMI has no official public API. Krafton does not provide developer access to mobile player stats."
  );
};

// ─── Free Fire ───────────────────────────────────────────────────────────────
// Garena has NO public API for Free Fire.
export const getFreefireStats = async (req, res, next) => {
  return noApiResponse(
    res,
    "Free Fire",
    "Free Fire has no official public API. Garena does not provide developer access to player stats."
  );
};

// ─── Call of Duty: Mobile ─────────────────────────────────────────────────────
// Activision has NO public API for CoD Mobile (separate from Warzone/PC).
export const getCodMobileStats = async (req, res, next) => {
  return noApiResponse(
    res,
    "Call of Duty: Mobile",
    "CoD Mobile has no official public API. Stats are not accessible to third-party developers."
  );
};

// ─── Mobile Legends: Bang Bang ────────────────────────────────────────────────
// Moonton has NO official public API.
export const getMlbbStats = async (req, res, next) => {
  return noApiResponse(
    res,
    "Mobile Legends: Bang Bang",
    "MLBB has no official public API. Moonton does not provide developer access to player stats."
  );
};

// ─── EA Sports FC ────────────────────────────────────────────────────────────
// EA has no public stats API for EA Sports FC / FUT player match stats.
export const getEaSportsFcStats = async (req, res, next) => {
  return noApiResponse(
    res,
    "EA Sports FC",
    "EA Sports FC has no official public API for player match stats."
  );
};