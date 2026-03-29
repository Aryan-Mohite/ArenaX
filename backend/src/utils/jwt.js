import jwt from "jsonwebtoken";

const SECRET = "secret123";

export const generateToken = (user) => {
  return jwt.sign({ id: user.user_id }, SECRET, {
    expiresIn: "7d",
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, SECRET);
};