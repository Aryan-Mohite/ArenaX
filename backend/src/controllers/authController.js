import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/jwt.js";

export const register = async (req, res) => {
  const { username, email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const result = await pool.query(
    "INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) RETURNING *",
    [username, email, hashed]
  );

  res.json(result.rows[0]);
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  const user = result.rows[0];

  if (!user) return res.status(400).json({ msg: "User not found" });

  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) return res.status(400).json({ msg: "Wrong password" });

  const token = generateToken(user);

  res.json({ token, user });
};