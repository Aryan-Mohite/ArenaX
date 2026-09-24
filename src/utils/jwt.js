import jwt from "jsonwebtoken";

const getSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set in environment variables");
  }
  return process.env.JWT_SECRET;
};

/**
 * Generate a signed JWT for a user.
 * @param {object} payload - must include user_id at minimum
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/**
 * Verify and decode a JWT.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 */
export const verifyToken = (token) => {
  return jwt.verify(token, getSecret());
};
