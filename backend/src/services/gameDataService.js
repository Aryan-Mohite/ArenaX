/**
 * Self-hosted Game Data Service
 * Reads from /data/games.json — no third-party API needed.
 * To add a new game: edit data/games.json and restart the server (or trigger /api/games/sync).
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const GAMES_JSON_PATH = join(__dirname, "../../data/games.json");

/**
 * Load all games from the local JSON file.
 * Returns an array of game objects ready to be upserted into the DB.
 */
export function loadGamesFromJson() {
  const raw  = readFileSync(GAMES_JSON_PATH, "utf-8");
  const list = JSON.parse(raw);

  return list.map((g) => ({
    slug:         g.slug,
    game_name:    g.game_name?.trim(),
    genre:        g.genre        || "Other",
    developer:    g.developer    || null,
    release_year: g.release_year || null,
    cover_image:  g.cover_image  || null,
    rating:       g.rating       ? parseFloat(Number(g.rating).toFixed(2)) : null,
    platforms:    g.platforms    || null,
    description:  g.description  ? g.description.slice(0, 600) : null,
    screenshots:  Array.isArray(g.screenshots) ? g.screenshots : [],
    // Fields present in schema kept for compatibility
  }));
}
