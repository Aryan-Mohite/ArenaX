// src/jobs/pandaScoreSyncJob.js
//
// Pulls upcoming/ongoing tournaments for your supported games from PandaScore's
// free "Schedules, Results & Context Data" plan and upserts them into the
// `tournaments` table, tagged source='pandascore'. This is what replaces the
// team manually pasting in famous tournament links every day.
//
// Requires:
//   PANDASCORE_API_KEY in .env  (free tier: https://pandascore.co)
//
// Safe to re-run: rows are upserted on (source='pandascore', external_id),
// so re-running never creates duplicates — it just refreshes dates/status.

import pool from "../config/db.js";

const PANDASCORE_BASE = "https://api.pandascore.co";

// Map PandaScore's videogame slug -> the `slug` value already used in your
// `games` table (see data/games.json). Add more rows here as you add games.
const GAME_SLUG_MAP = {
  valorant: "valorant",
  csgo: "counter-strike", // PandaScore still uses 'csgo' for CS2 tournaments
  dota2: "dota-2",
  lol: "league-of-legends",
};

async function fetchJson(path) {
  const apiKey = process.env.PANDASCORE_API_KEY;
  if (!apiKey) {
    throw new Error("PANDASCORE_API_KEY is not set in .env — get a free key at pandascore.co");
  }
  const res = await fetch(`${PANDASCORE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`PandaScore request failed (${res.status}): ${path}`);
  }
  return res.json();
}

/**
 * Maps a PandaScore tournament + its parent league/serie into the shape of
 * your `tournaments` table.
 */
function mapTournament(t, gameId) {
  const startDate = t.begin_at ? t.begin_at.slice(0, 10) : null;
  const endDate = t.end_at ? t.end_at.slice(0, 10) : startDate;

  let status = "upcoming";
  const now = new Date();
  if (startDate && new Date(startDate) <= now) status = "ongoing";
  if (endDate && new Date(endDate) < now) status = "completed";

  return {
    external_id: String(t.id),
    name: t.name || t.league?.name || "Untitled Tournament",
    game_id: gameId,
    prize_pool: null, // PandaScore's free tier doesn't reliably include prize pool
    entry_fee: 0,
    region: t.region || null,
    format: "League",
    start_date: startDate,
    end_date: endDate,
    registration_deadline: null,
    status,
    image_url: t.league?.image_url || t.serie?.league?.image_url || null,
    description: t.serie?.full_name || t.league?.name || null,
    organizer_name: t.league?.name || "Official",
    location: null,
    join_link: t.live_url || t.official_stream_url || `https://pandascore.co`,
  };
}

async function upsertTournament(row) {
  await pool.query(
    `INSERT INTO tournaments
       (name, game_id, source, external_id, prize_pool, entry_fee, region, format,
        start_date, end_date, registration_deadline, status,
        image_url, description, organizer_name, location, join_link)
     VALUES (?, ?, 'pandascore', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       start_date = VALUES(start_date),
       end_date = VALUES(end_date),
       status = VALUES(status),
       image_url = VALUES(image_url),
       description = VALUES(description),
       join_link = VALUES(join_link)`,
    [
      row.name, row.game_id, row.external_id, row.prize_pool, row.entry_fee,
      row.region, row.format, row.start_date, row.end_date,
      row.registration_deadline, row.status, row.image_url, row.description,
      row.organizer_name, row.location, row.join_link,
    ]
  );
}

async function getGameIdBySlug(slug) {
  const [rows] = await pool.query("SELECT game_id FROM games WHERE slug = ?", [slug]);
  return rows[0]?.game_id || null;
}

/**
 * Main sync entry point. Pulls upcoming + running tournaments for every
 * mapped game and upserts them.
 */
export async function syncFeaturedTournaments() {
  let totalSynced = 0;

  for (const [pandaScoreSlug, arenaXSlug] of Object.entries(GAME_SLUG_MAP)) {
    const gameId = await getGameIdBySlug(arenaXSlug);
    if (!gameId) {
      console.warn(`[pandaScoreSync] no game row for slug "${arenaXSlug}", skipping ${pandaScoreSlug}`);
      continue;
    }

    // /tournaments/upcoming and /tournaments/running are PandaScore's
    // dedicated endpoints for exactly this use case.
    for (const state of ["upcoming", "running"]) {
      let tournaments;
      try {
        tournaments = await fetchJson(
          `/${pandaScoreSlug}/tournaments/${state}?per_page=10&sort=begin_at`
        );
      } catch (err) {
        console.error(`[pandaScoreSync] ${pandaScoreSlug}/${state} fetch failed:`, err.message);
        continue;
      }

      for (const t of tournaments) {
        const row = mapTournament(t, gameId);
        await upsertTournament(row);
        totalSynced++;
      }
    }
  }

  console.log(`[pandaScoreSync] synced ${totalSynced} featured tournament(s)`);
  return totalSynced;
}

/**
 * Lets you run this file directly for a manual one-off sync:
 *   node src/jobs/pandaScoreSyncJob.js
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  import("dotenv").then(({ config }) => {
    config();
    return syncFeaturedTournaments();
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}