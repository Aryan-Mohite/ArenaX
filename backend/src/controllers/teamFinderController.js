import pool from "../config/db.js";

export const createPost = async (req, res) => {
  const { user_id, game_id, role_required } = req.body;

  const result = await pool.query(
    "INSERT INTO team_finder_posts(user_id, game_id, role_required) VALUES($1,$2,$3) RETURNING *",
    [user_id, game_id, role_required]
  );

  res.json(result.rows[0]);
};

export const getPosts = async (req, res) => {
  const result = await pool.query("SELECT * FROM team_finder_posts");
  res.json(result.rows);
};