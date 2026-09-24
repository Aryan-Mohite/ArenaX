import { Helmet } from "react-helmet-async";

/**
 * Per-page SEO component. Drop this at the top of any page to override
 * the default title/description/canonical set in frontend/index.html.
 *
 * Usage:
 *   <SEO
 *     title="Valorant & FPS Tournaments"
 *     description="Join Valorant, CS2, and FPS tournaments on ArenaX..."
 *     path="/tournament"
 *   />
 */
export default function SEO({ title, description, path = "", image, jsonLd }) {
  const fullTitle = title
    ? `${title} | ArenaX`
    : "ArenaX — Free Esports Tournaments & Team Finder Platform";

  const desc =
    description ||
    "ArenaX is the all-in-one esports platform for competitive FPS players — join free tournaments, build teams, watch live streams, track your stats.";

  const url = `https://arenax.io${path}`;
  const img = image || "https://arenax.io/og-preview.png";

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />

      {/* Optional per-page structured data (FAQPage, Article/BlogPosting, Event, etc.)
          Pass a plain JS object (or array of objects) and it'll be serialized here. */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
