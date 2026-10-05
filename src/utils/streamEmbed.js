// Turns a user-submitted stream URL into a SAFE, structured embed descriptor.
//
// Security model: we never hand the user's URL (or any part of it that is not
// strictly validated) to an <iframe>. We extract a validated id / channel name,
// and the frontend rebuilds the embed URL against a fixed host allowlist
// (YouTube, Twitch, Kick). Anything else is link-out only.
//
// Returns:
//   null                                   -> not a valid http(s) URL
//   { platform, embeddable: false }        -> valid URL, cannot be embedded
//   { platform, embeddable: true, kind, id } -> embeddable
//       youtube: kind "video" (11-char id) | "channel" (UC… id, live stream)
//       twitch : kind "channel" | "video"
//       kick   : kind "channel"

const YT_VIDEO   = /^[A-Za-z0-9_-]{11}$/;
const YT_CHANNEL = /^UC[A-Za-z0-9_-]{22}$/;
const TW_CHANNEL = /^[A-Za-z0-9_]{3,25}$/;
const TW_VIDEO   = /^\d{5,15}$/;
const KICK_CHAN  = /^[A-Za-z0-9_-]{2,25}$/;

const TWITCH_RESERVED = new Set([
  "videos", "directory", "downloads", "jobs", "turbo", "settings", "p", "store",
  "subscriptions", "inventory", "wallet", "drops", "friends", "messages", "search", "popout", "embed",
]);
const KICK_RESERVED = new Set(["categories", "category", "video", "videos", "search", "browse", "dashboard", "following"]);

export function parseStreamUrl(raw) {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  let u;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  // ── YouTube ────────────────────────────────────────────────────────────────
  if (host === "youtu.be") {
    return YT_VIDEO.test(parts[0] || "")
      ? { platform: "youtube", embeddable: true, kind: "video", id: parts[0] }
      : { platform: "youtube", embeddable: false };
  }
  if (host === "youtube.com") {
    const v = u.searchParams.get("v");
    if (parts[0] === "watch" && YT_VIDEO.test(v || ""))
      return { platform: "youtube", embeddable: true, kind: "video", id: v };
    if ((parts[0] === "live" || parts[0] === "embed" || parts[0] === "shorts") && YT_VIDEO.test(parts[1] || ""))
      return { platform: "youtube", embeddable: true, kind: "video", id: parts[1] };
    // youtube.com/channel/UCxxxx/live -> the channel's current live stream
    if (parts[0] === "channel" && YT_CHANNEL.test(parts[1] || ""))
      return { platform: "youtube", embeddable: true, kind: "channel", id: parts[1] };
    // @handle and /c/ URLs cannot be embedded without resolving them via the YouTube API.
    return { platform: "youtube", embeddable: false };
  }

  // ── Twitch ─────────────────────────────────────────────────────────────────
  if (host === "twitch.tv") {
    if (parts[0] === "videos" && TW_VIDEO.test(parts[1] || ""))
      return { platform: "twitch", embeddable: true, kind: "video", id: parts[1] };
    const ch = parts[0] || "";
    if (TW_CHANNEL.test(ch) && !TWITCH_RESERVED.has(ch.toLowerCase()))
      return { platform: "twitch", embeddable: true, kind: "channel", id: ch.toLowerCase() };
    return { platform: "twitch", embeddable: false };
  }

  // ── Kick ───────────────────────────────────────────────────────────────────
  if (host === "kick.com") {
    const ch = parts[0] || "";
    if (KICK_CHAN.test(ch) && !KICK_RESERVED.has(ch.toLowerCase()))
      return { platform: "kick", embeddable: true, kind: "channel", id: ch.toLowerCase() };
    return { platform: "kick", embeddable: false };
  }

  if (host === "facebook.com" || host === "fb.watch") return { platform: "facebook", embeddable: false };
  return { platform: "other", embeddable: false };
}
