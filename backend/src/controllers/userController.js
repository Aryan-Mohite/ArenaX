import { users } from "../data/db.js";

export const getUserProfile = (req, res) => {
  const { id } = req.params;

  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(user);
};