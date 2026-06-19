import { Link } from "react-router-dom";

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
    // [COMING SOON] Original copy referenced live stat/rank sync — removed until Player Stats ships.
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
  { value: "50+", label: "Registered players" },
  { value: "100+", label: "Tournaments forged" },
  { value: "10+", label: "Games in the Grid" },
  { value: "24 / 7", label: "Live streams" },
];

const TEAM = [
  { name: "Aryan & Adi", role: "Founder & CEO", emoji: "🦁" },
  { name: "Aditya", role: "Head of Product", emoji: "🚀" },
  { name: "Aryan", role: "Lead Engineer", emoji: "⚡" },
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
    // [COMING SOON] Original copy referenced Service Record/rank tracking (Player Stats feature) — removed until it ships.
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
            {/* [COMING SOON] Original copy: "their community, test their skills, and rise through the ranks — all" — rank mention removed until Player Stats ships. */}
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
            {/* [COMING SOON] Original copy: "Your tournament wins show on your profile. Your stats power your team listing. It all fits together." — stats reference removed until Player Stats ships. */}
            Six core features, all interconnected. Your tournament history shows
            on your profile, and it all fits together.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon, title, desc, to }) => (
            <Link
              key={title}
              to={to}
              className="card-hover group flex flex-col gap-3"
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {TEAM.map(({ name, role, emoji }) => (
            <div
              key={name}
              className="card text-center flex flex-col items-center gap-3"
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
