// Builds the iframe src for a stream. `embed` comes from the API
// ({ platform, kind, id }), where the id has already been strictly validated
// server-side. The hosts below are the ONLY ones the page CSP allows.
export function buildEmbedSrc(embed, parentHost) {
  if (!embed || !embed.id) return null;
  const id = encodeURIComponent(embed.id);
  if (embed.platform === "youtube") {
    return embed.kind === "channel"
      ? `https://www.youtube-nocookie.com/embed/live_stream?channel=${id}&autoplay=1`
      : `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
  }
  if (embed.platform === "twitch") {
    const parent = encodeURIComponent(parentHost || "");
    if (!parent) return null; // Twitch refuses to load without a parent
    const q = embed.kind === "video" ? `video=v${id}` : `channel=${id}`;
    return `https://player.twitch.tv/?${q}&parent=${parent}&autoplay=true`;
  }
  if (embed.platform === "kick" && embed.kind === "channel") {
    return `https://player.kick.com/${id}`;
  }
  return null;
}

export const PLATFORM_LABEL = { youtube: "YouTube", twitch: "Twitch", kick: "Kick", facebook: "Facebook" };
