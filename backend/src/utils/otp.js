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
 *
 * FIX (medium): removed the padEnd(6, "0") hack. Previously, inputs shorter
 * than 6 chars were padded which silently altered the comparison value.
 * Now we return false immediately if lengths don't match, keeping
 * the timing-safe guarantee while being correct.
 */
export const compareOtp = (input, stored) => {
  if (!input || !stored) return false;
  const a = String(input);
  const b = String(stored);
  // Both must be exactly 6 digits; any deviation is an invalid input
  if (a.length !== 6 || b.length !== 6) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};
