/**
 * =====================================================
 * How to wire <SEO> into each page
 * =====================================================
 * Add the import + the <SEO .../> line as the FIRST element
 * inside each page's return(). Don't replace anything else.
 * =====================================================
 */

// ── frontend/src/pages/Tournament.jsx ──────────────────────────────
import SEO from "../components/SEO";
// ... existing imports stay

// Inside the component's return(), as the very first child:
<SEO
  title="Valorant & FPS Tournaments"
  description="Join Valorant, CS2, and FPS tournaments on ArenaX. Compete against players worldwide and track your rank."
  path="/tournament"
/>


// ── frontend/src/pages/TeamFinder.jsx ──────────────────────────────
import SEO from "../components/SEO";

<SEO
  title="Find Teammates for Valorant & FPS Games"
  description="Use ArenaX Team Finder to find skilled teammates for Valorant, CS2, and other FPS games. Match by rank, playstyle, and availability."
  path="/teamfinder"
/>


// ── frontend/src/pages/Games.jsx ───────────────────────────────────
import SEO from "../components/SEO";

<SEO
  title="Browse Games — Valorant, CS2, PUBG & More"
  description="Browse all games supported on ArenaX including Valorant, CS2, PUBG, BGMI, Free Fire, and more. Join tournaments and find teammates for your favorite game."
  path="/games"
/>


// ── frontend/src/pages/Stream.jsx ──────────────────────────────────
import SEO from "../components/SEO";

<SEO
  title="Live Esports Streams"
  description="Watch live esports streams from top FPS players on ArenaX. Follow tournaments in real time and connect with the gaming community."
  path="/stream"
/>


// ── frontend/src/pages/Communities.jsx ─────────────────────────────
import SEO from "../components/SEO";

<SEO
  title="Esports Communities"
  description="Join esports communities on ArenaX. Connect with players, teams, and organizers across Valorant, CS2, and more."
  path="/communities"
/>


// ── frontend/src/pages/About.jsx ───────────────────────────────────
import SEO from "../components/SEO";

<SEO
  title="About ArenaX"
  description="ArenaX is built for competitive FPS players — tournaments, team finding, live streams, and a real esports community."
  path="/about"
/>


// ── frontend/src/pages/Home.jsx ────────────────────────────────────
// No <SEO> needed here — Home uses the default title/description
// already set in frontend/index.html, which is correct for "/"
