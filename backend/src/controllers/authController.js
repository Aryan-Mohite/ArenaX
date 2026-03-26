import { users } from "../data/db.js";
import { v4 as uuidv4 } from "uuid";

export const registerUser = (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  const user = {
    id: uuidv4(),
    username,
    email,
    password,
  };

  users.push(user);

  res.status(201).json({ message: "User registered", user });
};

export const loginUser = (req, res) => {
  const { email, password } = req.body;

  const user = users.find(
    (u) => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.json({ message: "Login successful", user });
};