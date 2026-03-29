import pool from "../config/db.js";

export const createTournament = async (req, res) => {
  const { name, game_id } = req.body;

  const result = await pool.query(
    "INSERT INTO tournaments(name, game_id) VALUES($1,$2) RETURNING *",
    [name, game_id]
  );

  res.json(result.rows[0]);
};

export const getTournaments = async (req, res) => {
  const result = await pool.query("SELECT * FROM tournaments");
  res.json(result.rows);
};