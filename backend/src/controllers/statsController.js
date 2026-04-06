/**
 * statsController.js
 * Server-side proxy for game stat APIs.
 * All external API calls happen here — no CORS issues, keys stay in .env.
 *
 * GET /api/stats/valorant/:name/:tag
 * GET /api/stats/lol/:name/:tag
 * GET /api/stats/fortnite/:username
 * GET /api/stats/dota2/:steamId
 * GET /api/stats/apex/:username
 * GET /api/stats/pubg/:username
 * GET /api/stats/r6/:username
 * GET /api/stats/csgo/:steamId
 */

import fetch from "node-fetch";

// ─── Helper: forward a fetch error as a clean JSON response ──────────────────
const apiError = (res, message, status = 502) =>
  res.status(status).json({ success: false, message });

// ─── Valorant (Henrik Dev — free tier, get key at https://docs.henrikdev.xyz) ─
// Add HENRIKDEV_KEY=your_key_here to .env (free registration, no credit card)
export const getValorantStats = async (req, res, next) => {
  try {
    const { name, tag } = req.params;
    if (!name || !tag)
      return apiError(res, "Provide name and tag", 400);

    const encodedName = encodeURIComponent(name);
    const encodedTag  = encodeURIComponent(tag);
    const KEY         = process.env.HENRIKDEV_KEY || "";
    const headers     = KEY ? { Authorization: KEY } : {};

    // 1. Account info
    const accRes = await fetch(
      `https://api.henrikdev.xyz/valorant/v1/account/${encodedName}/${encodedTag}`,
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

    // 2. MMR / Rank (optional — graceful if it fails)
    let rankData = null;
    try {
      const mmrRes = await fetch(
        `https://api.henrikdev.xyz/valorant/v2/mmr/${acc.region}/${encodedName}/${encodedTag}`,
        { headers }
      );
      if (mmrRes.ok) {
        const mmrJson = await mmrRes.json();
        rankData = mmrJson.data;
      }
    } catch { /* rank is optional */ }

    const currentTier  = rankData?.current_data?.currenttierpatched || "Unranked";
    const rr           = rankData?.current_data?.ranking_in_tier ?? null;
    const peakTier     = rankData?.highest_rank?.patched_tier || null;
    const mmr          = rankData?.current_data?.elo ?? null;

    return res.json({
      success: true,
      data: {
        label:         `${acc.name}#${acc.tag}`,
        rank:          currentTier,
        elo_rating:    rr,
        role:          "Agent",
        avatar:        acc.card?.small || null,
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
  } catch (err) {
    next(err);
  }
};

// ─── League of Legends (OpenDota-style — uses Riot Data Dragon, no key) ───────
export const getLolStats = async (req, res, next) => {
  try {
    const { name, tag } = req.params;
    if (!name) return apiError(res, "Provide summoner name", 400);

    const KEY     = process.env.HENRIKDEV_KEY || "";
    const headers = KEY ? { Authorization: KEY } : {};

    // Henrik Dev also supports LoL account lookup
    const encodedName = encodeURIComponent(name);
    const encodedTag  = tag ? encodeURIComponent(tag) : "EUW";

    const accRes = await fetch(
      `https://api.henrikdev.xyz/lol/v1/account/${encodedName}/${encodedTag}`,
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
  } catch (err) {
    next(err);
  }
};

// ─── Fortnite (fortnite-api.com — completely free, no key) ────────────────────
export const getFortniteStats = async (req, res, next) => {
  try {
    const { username } = req.params;
    const apiRes = await fetch(
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
        rank:       wins >= 100 ? "Elite" : wins >= 10 ? "Experienced" : "Rookie",
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
  } catch (err) {
    next(err);
  }
};

// ─── Dota 2 (OpenDota — 100% free, no key needed) ────────────────────────────
export const getDota2Stats = async (req, res, next) => {
  try {
    const { steamId } = req.params;
    const [playerRes, wlRes] = await Promise.all([
      fetch(`https://api.opendota.com/api/players/${steamId}`),
      fetch(`https://api.opendota.com/api/players/${steamId}/wl`),
    ]);

    if (!playerRes.ok)
      return apiError(res, "Dota 2 player not found. Use your Steam32 ID (from opendota.com).", 404);

    const player  = await playerRes.json();
    const wl      = wlRes.ok ? await wlRes.json() : null;

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
          { label: "Wins",        value: wins },
          { label: "Losses",      value: losses },
          { label: "Win Rate",    value: winRate ? winRate + "%" : "—" },
          { label: "Country",     value: player.profile.loccountrycode || "—" },
        ],
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Apex Legends (mozambiquehe.re — free public tier) ────────────────────────
export const getApexStats = async (req, res, next) => {
  try {
    const { username } = req.params;
    const ALS_KEY = process.env.ALS_KEY || "PUBLIC";

    const apiRes = await fetch(
      `https://api.mozambiquehe.re/bridge?auth=${ALS_KEY}&player=${encodeURIComponent(username)}&platform=PC`
    );
    if (!apiRes.ok)
      return apiError(res, "Apex Legends player not found. Check your EA/Origin username.", 404);

    const data = await apiRes.json();
    if (data.Error) return apiError(res, data.Error, 404);

    const global = data.global;
    const ranked = global?.rank;

    return res.json({
      success: true,
      data: {
        label:      global?.name || username,
        rank:       ranked?.rankName || "Rookie",
        elo_rating: ranked?.rankScore || null,
        role:       data.legends?.selected?.LegendName || "Legend",
        avatar:     null,
        extra: [
          { label: "Rank",           value: ranked?.rankName || "Unranked" },
          { label: "Rank Score",     value: ranked?.rankScore || "—" },
          { label: "Level",          value: global?.level || "—" },
          { label: "Active Legend",  value: data.legends?.selected?.LegendName || "—" },
          { label: "Platform",       value: "PC" },
        ],
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUBG (pubg.op.gg) ────────────────────────────────────────────────────────
export const getPubgStats = async (req, res, next) => {
  try {
    const { username } = req.params;
    const apiRes = await fetch(
      `https://pubg.op.gg/api/users?server=steam&nickname=${encodeURIComponent(username)}`,
      { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }
    );
    if (!apiRes.ok)
      return apiError(res, "PUBG player not found.", 404);

    const data   = await apiRes.json();
    const player = data?.data?.[0];
    if (!player)
      return apiError(res, `No PUBG player found with username "${username}".`, 404);

    const ranked  = player.stats?.ranked;
    const tier    = ranked?.currentTier?.tier || player.grade || "Bronze";
    const rp      = ranked?.currentRankPoint || null;

    return res.json({
      success: true,
      data: {
        label:      player.nickname || username,
        rank:       tier,
        elo_rating: rp,
        role:       "PUBG Player",
        avatar:     player.player_image_url || null,
        extra: [
          { label: "Rank",       value: tier },
          { label: "Rank Points",value: rp || "—" },
          { label: "KDA",        value: player.kda?.toFixed(2) || "—" },
          { label: "Wins",       value: player.wins || "—" },
          { label: "Top 10 %",   value: player.top10_ratio ? (player.top10_ratio * 100).toFixed(1) + "%" : "—" },
        ],
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Rainbow Six Siege (r6.apitab.com) ────────────────────────────────────────
export const getR6Stats = async (req, res, next) => {
  try {
    const { username } = req.params;
    const apiRes = await fetch(
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
  } catch (err) {
    next(err);
  }
};

// ─── Counter-Strike / Steam (playerdb.co) ─────────────────────────────────────
export const getSteamStats = async (req, res, next) => {
  try {
    const { steamId } = req.params;
    const apiRes = await fetch(
      `https://playerdb.co/api/player/steam/${encodeURIComponent(steamId)}`
    );
    if (!apiRes.ok)
      return apiError(res, "Steam player not found.", 404);

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
        ],
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Brawl Stars (brawlapi.com community proxy) ───────────────────────────────
export const getBrawlStarsStats = async (req, res, next) => {
  try {
    const { tag } = req.params;
    const cleanTag = tag.startsWith("#") ? tag.slice(1) : tag;

    const apiRes = await fetch(
      `https://api.brawlapi.com/v1/players/${encodeURIComponent("#" + cleanTag)}`
    );
    if (!apiRes.ok)
      return apiError(res, `Brawl Stars player not found. Check your tag (e.g. 2PP).`, 404);

    const data = await apiRes.json();
    if (data.error) return apiError(res, "Player not found.", 404);

    const trophies = data.trophies || 0;
    const rank = trophies >= 50000 ? "Legendary" : trophies >= 30000 ? "Masters" : trophies >= 15000 ? "Diamond" : trophies >= 5000 ? "Gold" : "Bronze";

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
  } catch (err) {
    next(err);
  }
};