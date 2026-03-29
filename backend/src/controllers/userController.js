import pool from "../config/db.js";

export const getUsers = async (req, res) => {
  const result = await pool.query("SELECT * FROM users");
  res.json(result.rows);
};