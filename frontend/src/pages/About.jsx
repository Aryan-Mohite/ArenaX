import { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

// ── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "🏆",
    title: "The Arena",
    desc: "Forge or enter competitive tournaments across your favourite titles. War maps, prize pools, and live bracket updates — all in one place.",
    to: "/tournament",
  },
  {
    icon: "🎮",
    title: "Game Library",
    // desc: "Browse the Grid of supported titles. Add games to your Loadout and let ArenaX live-sync your in-game stats and rank.",
    desc: "Browse the Grid of supported titles and add your favourites to your Loadout.",
    to: "/games",
  },
  {
    icon: "🤝",
    title: "TeamUP Arena",
    desc: "Open a draft in the Mercenary Market or browse open squads. Filter by game, rank, and play style to assemble your dream roster.",
    to: "/teamfinder",
  },
  {
    icon: "💬",
    title: "The Nexus",
    desc: "Jump into The Nexus, drop clips, debate meta, and link up with players in the same trenches as you.",
    to: "/communities",
  },
  {
    icon: "📡",
    title: "Spectate",
    desc: "Spectate community members broadcasting live. Going live yourself is one click away — no external setup required.",
    to: "/stream",
  },
];

const STATS = [
  { value: "1000+", label: "Registered players" },
  { value: "100+", label: "Tournaments forged" },
  { value: "10+", label: "Games in the Grid" },
  { value: "24 / 7", label: "Live streams" },
];

const TEAM = [
  {
    name: "Aryan & Adi",
    role: "Founder & CEO",
    emoji: "🦁",
    linkedin: "https://linkedin.com/in/arenax",
    instagram: "https://www.instagram.com/arenax_gg/",
    email: "arenaxxtreme@gmail.com",
  },
  {
    name: "Aditya Suryawanshi",
    role: "Head of Product",
    emoji: "🚀",
    linkedin: "https://www.linkedin.com/in/aditya-suryavanshi-16b6a7409",
    instagram: "https://www.instagram.com/adityasuryawanshi_20/",
    email: "adiyasuryawanshi091@gmail.com",
  },
  {
    name: "Aryan Mohite",
    role: "Lead Engineer",
    emoji: "⚡",
    linkedin: "www.linkedin.com/in/aryan-mohite-068736315",
    instagram: "https://www.instagram.com/shivaay_xyz_07/",
    email: "shivaaymohite7@gmail.com",
  },
  {
    name: "Atharva Shrivastava",
    role: "Collabrative Video Editor",
    emoji: "🎥",
    linkedin:
      "https://www.linkedin.com/in/atharva-shrivastava-4a7266335?utm_source=share_via&utm_content=profile&utm_medium=member_android",
    instagram: "",
    email: "imatharva19@gmail.com",
  },
];

const VALUES = [
  {
    icon: "⚔️",
    title: "Compete Fiercely",
    desc: "We believe competition forges the best players. Every feature is built to help you peak and stay there.",
  },
  {
    icon: "🌐",
    title: "Play Together",
    desc: "Gaming is better with a squad. We remove every obstacle between you and your next teammate, community, and rival.",
  },
  {
    icon: "🔒",
    title: "Fair & Safe",
    desc: "Our platform enforces fair play and keeps your data yours. No selling profiles, no pay-to-win matchmaking.",
  },
  {
    icon: "📈",
    title: "Grow Continuously",
    // desc: "Study your Service Record, learn from every loss, and watch your rank climb. Data is your coach.",
    desc: "Learn from every match, sharpen your strategy, and keep pushing toward your next win.",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative overflow-hidden py-24 px-4">
      {/* Background glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, #ff465508 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, #ff465505 0%, transparent 50%)",
        }}
      />

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Badge */}
        <span className="badge-red mb-6 inline-flex">
          <span className="w-1.5 h-1.5 rounded-full bg-red-light animate-pulse" />
          ArenaX Beta
          <span className="w-1.5 h-1.5 rounded-full bg-red-light animate-pulse" />
        </span>

        <h1 className="font-display font-bold text-5xl sm:text-6xl text-white leading-tight mb-6">
          The competitive gaming <span style={{ color: "#ff4655" }}>hub</span>{" "}
          you deserve
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
          ArenaX brings together tournaments, team-finding, communities, and
          live streaming in a single platform built for players who take their
          game seriously.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/register" className="btn-primary">
            Enlist Free
          </Link>
          <Link to="/tournament" className="btn-secondary">
            View tournaments
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatsBar() {
  return (
    <section className="border-y border-surface-border bg-surface-card/30">
      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {STATS.map(({ value, label }) => (
          <div key={label}>
            <p
              className="font-display font-bold text-3xl text-white mb-1"
              style={{ color: "#ff4655" }}
            >
              {value}
            </p>
            <p className="text-sm text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MissionSection() {
  return (
    <section className="max-w-5xl mx-auto px-4 py-20">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        {/* Text */}
        <div>
          <h2 className="font-display font-bold text-3xl text-white mb-4">
            Our mission
          </h2>

          <p className="text-gray-400 leading-relaxed mb-4">
            Our mission is simple: give every player — from weekend warriors to
            aspiring pros — a single home where they can compete, connect, and
            grow.
          </p>
        </div>
        <div>
          <h2 className="font-display font-bold text-3xl text-white mb-4">
            Our Vision
          </h2>

          <p className="text-gray-400 leading-relaxed mb-4">
            We envision a world where competitive gaming is as accessible and
            rewarding as playing itself. A world where every player can find
            their community, test their skills, and compete at the highest level
            — all without leaving the platform.
          </p>
        </div>

        {/* Visual card */}
        <div className="card border-red/20 relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 80% 20%, #ff465510 0%, transparent 60%)",
            }}
          />
          <div className="relative space-y-4">
            {[
              { label: "Founded", value: "2026" },
              { label: "HQ", value: "Remote — worldwide" },
              { label: "Model", value: "Free to play, fair monetisation" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2 border-b border-surface-border last:border-0"
              >
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section className="border-t border-surface-border py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl text-white mb-3">
            Everything on one platform
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Six core features, all interconnected. Your tournament history shows
            on your profile, and it all fits together.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-5">
          {FEATURES.map(({ icon, title, desc, to }) => (
            <Link
              key={title}
              to={to}
              className="card-hover group flex flex-col gap-3 w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)]"
            >
              <span className="text-3xl">{icon}</span>
              <h3 className="font-semibold text-white group-hover:text-red transition-colors">
                {title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed flex-1">
                {desc}
              </p>
              <span
                className="text-xs font-medium"
                style={{ color: "#ff4655" }}
              >
                Explore →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ValuesSection() {
  return (
    <section className="border-t border-surface-border py-20 px-4 bg-surface-card/20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl text-white mb-3">
            What we stand for
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            Four values that shape every product decision we make.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {VALUES.map(({ icon, title, desc }) => (
            <div key={title} className="card flex gap-4">
              <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
              <div>
                <h3 className="font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamSection() {
  const [activeIndex, setActiveIndex] = useState(null);

  return (
    <section className="border-t border-surface-border py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl text-white mb-3">
            The Team
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            A small crew of competitive gamers who got tired of switching
            between five tabs just to play one game.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-5">
          {TEAM.map(({ name, role, emoji, linkedin, instagram, email }, i) => (
            <div
              key={name}
              tabIndex={0}
              onClick={() => setActiveIndex((cur) => (cur === i ? null : i))}
              className="group relative card text-center flex flex-col items-center gap-3 w-full sm:w-[calc(50%-0.625rem)] md:w-[calc(25%-0.938rem)] overflow-hidden cursor-pointer outline-none"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl border border-surface-border"
                style={{ background: "rgba(255,70,85,0.08)" }}
              >
                {emoji}
              </div>
              <div>
                <p className="font-semibold text-white">{name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{role}</p>
              </div>

              {/* ── Hover / tap info card: name, LinkedIn, email ── */}
              <div
                className={
                  "absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl px-4 transition-opacity duration-200 " +
                  (activeIndex === i
                    ? "opacity-100 pointer-events-auto"
                    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto")
                }
                style={{
                  background: "rgba(10,12,20,0.92)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <p className="font-semibold text-white text-sm">{name}</p>
                <div className="flex items-center gap-2.5">
                  <a
                    href={linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`${name} on LinkedIn`}
                    title="LinkedIn"
                    className="flex items-center justify-center w-9 h-9 rounded-lg border border-surface-border text-gray-400 hover:text-red hover:border-red/40 transition-colors"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 110-4.124 2.062 2.062 0 010 4.124zM7.119 20.452H3.554V9h3.565v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                  <a
                    href={instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`${name} on Instagram`}
                    title="Instagram"
                    className="flex items-center justify-center w-9 h-9 rounded-lg border border-surface-border text-gray-400 hover:text-red hover:border-red/40 transition-colors"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                  </a>
                </div>
                <a
                  href={`mailto:${email}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-gray-500 hover:text-gray-300 break-all transition-colors"
                >
                  {email}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="border-t border-surface-border py-20 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="font-display font-bold text-3xl text-white mb-4">
          Ready to compete?
        </h2>
        <p className="text-gray-400 mb-8 leading-relaxed">
          Enlist in seconds. No credit card, no hidden fees — just you, your
          games, and the competition.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/register" className="btn-primary">
            Deploy Your Profile
          </Link>
          <Link to="/games" className="btn-secondary">
            Explore the Grid
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function About() {
  return (
    <div className="min-h-screen">
      <SEO
        title="About ArenaX"
        description="ArenaX is built for competitive FPS players — tournaments, team finding, live streams, and a real esports community."
        path="/about"
      />
      <HeroSection />
      <StatsBar />
      <MissionSection />
      <FeaturesSection />
      <ValuesSection />
      <TeamSection />
      <CtaSection />
    </div>
  );
}
