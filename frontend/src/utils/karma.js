// Small shared helper for turning raw karma counts into a display badge.
//
// Deliberately one-directional: this only ever produces a positive trust
// signal ("Trusted Teammate") or nothing. Low/negative karma is never
// surfaced as a public label — crowd-sourced peer ratings are too easy to
// game or brigade for that to be a fair way to publicly flag someone.
export function getKarmaBadge(positive = 0, negative = 0) {
  const total = positive + negative;
  if (total < 5) return null;
  const ratio = positive / total;
  if (ratio >= 0.8) return { label: "Trusted Teammate", icon: "🌟" };
  return null;
}

export function getKarmaSummary(positive = 0, negative = 0) {
  const total = positive + negative;
  if (total === 0) return null;
  const pct = Math.round((positive / total) * 100);
  return `${pct}% positive (${total} rating${total === 1 ? "" : "s"})`;
}
