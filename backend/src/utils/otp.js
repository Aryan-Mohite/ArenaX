import crypto from "crypto";

/**
 * Generates a cryptographically random 6-digit OTP.
 * Uses crypto.randomInt which is uniformly distributed and timing-safe.
 */
export const generateOtp = () => {
  return String(crypto.randomInt(100000, 999999));
};

/**
 * Timing-safe comparison for OTP strings.
 * Prevents timing-based attacks that could let an attacker enumerate valid OTPs.
 */
export const compareOtp = (input, stored) => {
  if (!input || !stored) return false;
  const a = Buffer.from(String(input).padEnd(6, "0"));
  const b = Buffer.from(String(stored).padEnd(6, "0"));
  // buffers must be same length for timingSafeEqual
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
