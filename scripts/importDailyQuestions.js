// scripts/importDailyQuestions.js
//
// Bulk-imports Dailies quiz questions from JSON files in data/daily-questions/.
// Each file is one game. See data/daily-questions/_template.json for the format.
//
// Safe to re-run — new questions are appended each run (there's no dedupe key
// on question text, so don't run the same file twice unless you want
// duplicates; delete-and-reimport a game with --replace if you need to fix content).
//
// Usage:
//   node scripts/importDailyQuestions.js                  # imports every *.json in the folder
//   node scripts/importDailyQuestions.js valorant.json     # imports one file
//   node scripts/importDailyQuestions.js --replace         # deletes existing questions for
//                                                           # each game_slug found before inserting

import "../src/config/env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../src/config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data", "daily-questions");

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const OPTION_KEYS = new Set(["a", "b", "c", "d"]);

async function run() {
  const args = process.argv.slice(2);
  const replace = args.includes("--replace");
  const fileArgs = args.filter((a) => !a.startsWith("--"));

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`No data directory found at ${DATA_DIR}`);
    process.exit(1);
  }

  const files = (fileArgs.length > 0 ? fileArgs : fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")))
    .filter((f) => !f.startsWith("_")); // skip _template.json

  if (files.length === 0) {
    console.log("No question files found to import.");
    return;
  }

  let totalInserted = 0;

  for (const file of files) {
    const filePath = path.isAbsolute(file) ? file : path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Skipping ${file} — not found`);
      continue;
    }

    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const { game_slug, questions } = raw;

    if (!game_slug || !Array.isArray(questions)) {
      console.warn(`⚠️  Skipping ${file} — expected { game_slug, questions: [...] }`);
      continue;
    }

    const [gameRows] = await pool.query("SELECT game_id FROM games WHERE slug = ?", [game_slug]);
    if (gameRows.length === 0) {
      console.warn(`⚠️  Skipping ${file} — no game found with slug "${game_slug}"`);
      continue;
    }
    const gameId = gameRows[0].game_id;

    const errors = validateQuestions(questions);
    if (errors.length > 0) {
      console.error(`❌ ${file} has validation errors — skipped:`);
      errors.forEach((e) => console.error(`   - ${e}`));
      continue;
    }

    if (replace) {
      const [del] = await pool.query("DELETE FROM daily_quiz_questions WHERE game_id = ?", [gameId]);
      console.log(`   Removed ${del.affectedRows} existing question(s) for "${game_slug}"`);
    }

    const values = questions.map((q) => [
      gameId, q.difficulty, q.question_text, q.media_url || null,
      q.options.a, q.options.b, q.options.c, q.options.d, q.correct_option,
    ]);

    const [result] = await pool.query(
      `INSERT INTO daily_quiz_questions
         (game_id, difficulty, question_text, media_url, option_a, option_b, option_c, option_d, correct_option)
       VALUES ?`,
      [values]
    );

    console.log(`✅ ${file}: inserted ${result.affectedRows} question(s) for "${game_slug}" (game_id ${gameId})`);
    totalInserted += result.affectedRows;

    reportCoverage(game_slug, questions);
  }

  console.log(`\nDone. ${totalInserted} question(s) imported total.`);
  process.exit(0);
}

function validateQuestions(questions) {
  const errors = [];
  questions.forEach((q, i) => {
    if (!DIFFICULTIES.has(q.difficulty)) errors.push(`questions[${i}]: invalid or missing difficulty`);
    if (!q.question_text?.trim()) errors.push(`questions[${i}]: missing question_text`);
    if (!q.options || Object.keys(q.options).length !== 4 || ![..."abcd"].every((k) => q.options[k]?.trim()))
      errors.push(`questions[${i}]: options must have exactly a, b, c, d, all non-empty`);
    if (!OPTION_KEYS.has(q.correct_option)) errors.push(`questions[${i}]: correct_option must be a/b/c/d`);
  });
  return errors;
}

// A daily draw needs 2 easy + 2 medium + 1 hard MINIMUM to function at all —
// warn early if a game's bank can't sustain even one day without repeats.
function reportCoverage(gameSlug, questions) {
  const counts = { easy: 0, medium: 0, hard: 0 };
  questions.forEach((q) => counts[q.difficulty]++);
  const required = { easy: 2, medium: 2, hard: 1 };
  const short = Object.entries(required).filter(([diff, need]) => counts[diff] < need);
  if (short.length > 0) {
    console.warn(
      `   ⚠️  "${gameSlug}" is below the per-day minimum (${short
        .map(([d, n]) => `${d}: has ${counts[d]}, needs ${n}`)
        .join(", ")}). The daily draw will fail until more are added.`
    );
  } else {
    console.log(
      `   Bank: ${counts.easy} easy / ${counts.medium} medium / ${counts.hard} hard ` +
      `→ supports ~${Math.min(Math.floor(counts.easy / 2), Math.floor(counts.medium / 2), counts.hard)} day(s) without repeats.`
    );
  }
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
