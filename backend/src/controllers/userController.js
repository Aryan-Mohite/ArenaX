import pool from "../config/db.js";

export const getUsers = async (req, res) => {
  const result = await pool.query("SELECT * FROM users");
  res.json(result.rows);
};

const db = require("../config/db");

exports.getProfile = (req, res) => {
  const userId = req.params.id;

  const sql = `
    SELECT user_id, username, email, profile_photo, fav_games, rank, rating, bio
    FROM users
    WHERE user_id = ?
  `;

  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0]);
  });
};

exports.updateProfile = (req, res) => {
  const userId = req.params.id;

  const { username, fav_games, rank, bio } = req.body;

  const sql = `
    UPDATE users
    SET username=?, fav_games=?, rank=?, bio=?
    WHERE user_id=?
  `;

  db.query(sql, [username, fav_games, rank, bio, userId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Profile updated" });
  });
};