import { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

const FAQ_SECTIONS = [
  {
    title: "About ArenaX",
    items: [
      {
        q: "What is ArenaX?",
        a: "ArenaX is an all-in-one esports platform for competitive FPS players. It brings together tournaments, a team finder, live streaming, and a community hub (The Nexus) in one place, so you don't need separate tools to compete, find teammates, and watch matches.",
      },
      {
        q: "Who is ArenaX for?",
        a: "ArenaX is built for competitive players of all levels — from casual squads looking for their next scrim to serious teams grinding ranked tournaments. If you play FPS titles like Valorant, CS2, Apex Legends, or similar competitive games, ArenaX is for you.",
      },
      {
        q: "How do I use ArenaX?",
        a: "Create a free account, then explore The Arena for tournaments, TeamUP Arena to find teammates, Spectate to watch or start streams, and The Nexus to join communities around your favorite games. Your dashboard keeps track of your matches, team, and upcoming tournaments in one place.",
      },
      {
        q: "Is ArenaX free to use?",
        a: "Yes. Creating an account, browsing tournaments, using the team finder, and watching streams on ArenaX is free. Some tournaments may have entry requirements set by their organizers (such as rank gates or prize-pool buy-ins), but the platform itself doesn't charge to join.",
      },
      {
        q: "Which games does ArenaX support?",
        a: "ArenaX currently focuses on competitive FPS titles, with Valorant as a primary supported game. Check the Game Library page for the full, up-to-date list of supported titles — new games are added as the platform grows.",
      },
      {
        q: "Do I need to download anything to use ArenaX?",
        a: "No. ArenaX runs entirely in your browser — there's nothing to install to browse tournaments, manage your team, or watch streams. You'll only need your game's own client installed to actually play your matches.",
      },
      {
        q: "Is ArenaX available worldwide?",
        a: "Yes, ArenaX is open to players globally. Tournament availability and regional brackets depend on what organizers set up, so check each tournament's region setting before registering.",
      },
    ],
  },
  {
    title: "Tournaments & Team Finder",
    items: [
      {
        q: "How do I join a tournament on ArenaX?",
        a: "Go to The Arena, browse open tournaments, and check the entry requirements and bracket format. If you have a full team, register together; if not, use TeamUP Arena to find teammates first. Registration closes before brackets are seeded, so register early.",
      },
      {
        q: "How do I find teammates on ArenaX?",
        a: "Use TeamUP Arena (the team finder) to browse open squads or post your own listing. You can filter by game, rank, role, and play style to find players who match how you want to compete.",
      },
      {
        q: "What tournament formats does ArenaX use?",
        a: "It depends on the specific tournament — organizers can run single elimination, double elimination, or Swiss-style brackets. The format is always listed on the tournament's page before you register, so check it before committing your team.",
      },
      {
        q: "Can I stream my matches on ArenaX?",
        a: "Yes — the Spectate feature lets you go live directly from the platform with one click, no separate streaming account or manual RTMP setup required. Other community members can then discover and watch your stream.",
      },
      {
        q: "Can I create my own tournament or community?",
        a: "Community creation through The Nexus lets you build a hub around your team, game, or content. Tournament hosting capabilities are expanding — check The Arena for the latest options on running your own bracket.",
      },
    ],
  },
  {
    title: "How ArenaX Compares",
    items: [
      {
        q: "How is ArenaX different from other esports platforms?",
        a: "Most platforms make you juggle a separate tournament site, a Discord server for team finding, and a third-party app for streaming. ArenaX combines tournaments, team finding, streaming, and community into a single account and a single interface, built specifically around competitive FPS play instead of being a general-purpose gaming site.",
      },
      {
        q: "Why should I use ArenaX instead of Discord or Reddit for finding teammates?",
        a: "Discord and Reddit rely on scattered posts that go stale fast. TeamUP Arena is a structured, filterable listing — you search by game, rank, and role instead of scrolling through unorganized messages, and profiles carry your ArenaX tournament history so teammates can see how you actually play.",
      },
      {
        q: "Does ArenaX lock me into one game or ecosystem?",
        a: "No. ArenaX is multi-game by design, so your profile, team connections, and community memberships carry across the titles you play instead of being siloed into a single game's own launcher or platform.",
      },
    ],
  },
  {
    title: "Data & Security",
    items: [
      {
        q: "Does ArenaX sell or share my data?",
        a: "No. ArenaX does not sell user profiles or gameplay data to third parties. For full details on what's collected and how it's used, see our Privacy Policy.",
      },
      {
        q: "How does ArenaX protect my account?",
        a: "Passwords are never stored in plain text, and account access is protected using standard industry practices for authentication. We recommend using a strong, unique password and enabling any additional account protections available in your settings.",
      },
      {
        q: "What information does ArenaX collect about me?",
        a: "ArenaX collects the information needed to run your account and match you with tournaments and teammates — things like your profile details, game stats you choose to share, and basic usage data. Full specifics are laid out in our Privacy Policy.",
      },
      {
        q: "Can I delete my account and data?",
        a: "Yes. You can request account deletion at any time by contacting support@arenax.io, and your personal data will be handled according to our Privacy Policy.",
      },
    ],
  },
  {
    title: "Support & Troubleshooting",
    items: [
      {
        q: "How do I contact ArenaX support?",
        a: "Email support@arenax.io for account or platform issues. You can also reach the team through ArenaX's social channels linked in the site footer.",
      },
      {
        q: "I found a bug or a stream isn't working — what do I do?",
        a: "Send the details to support@arenax.io, including what you were doing when it happened and, if possible, a screenshot. This helps the team track down and fix the issue quickly.",
      },
      {
        q: "Can I suggest a feature or a new game to add?",
        a: "Absolutely — feature and game requests are welcome. Send suggestions to support@arenax.io, and popular requests are prioritized as the platform grows.",
      },
    ],
  },
];

// Flattened list used for the FAQPage JSON-LD schema
const ALL_FAQS = FAQ_SECTIONS.flatMap((section) => section.items);

function FaqItem({ item, isOpen, onToggle }) {
  return (
    <div className="card !p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
        aria-expanded={isOpen}
      >
        <span className="font-display font-semibold text-white text-base">
          {item.q}
        </span>
        <span
          className="shrink-0 text-xl text-gray-400 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          +
        </span>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">
          {item.a}
        </div>
      )}
    </div>
  );
}

export default function Faq() {
  // Track open item as "sectionIndex-itemIndex"; first item of first section open by default
  const [openKey, setOpenKey] = useState("0-0");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ALL_FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <div className="min-h-screen">
      <SEO
        title="Frequently Asked Questions"
        description="Answers to common questions about ArenaX — tournaments, team finding, streaming, data security, and how ArenaX compares to other esports platforms."
        path="/faq"
        jsonLd={jsonLd}
      />

      <section className="relative overflow-hidden py-20 px-4">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 20% 50%, #ff465508 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, #ff465505 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <span className="badge-red mb-6 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-red-light animate-pulse" />
            Help Center
          </span>
          <h1 className="font-display font-bold text-4xl sm:text-5xl text-white leading-tight mb-4">
            Frequently asked <span style={{ color: "#ff4655" }}>questions</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
            Can't find what you're looking for?{" "}
            <a
              href="mailto:support@arenax.io"
              className="underline hover:text-white transition-colors"
            >
              Email support@arenax.io
            </a>
            .
          </p>
        </div>
      </section>

      <section className="max-w-2xl mx-auto px-4 pb-24 space-y-12">
        {FAQ_SECTIONS.map((section, sIdx) => (
          <div key={section.title}>
            <h2 className="font-display font-bold text-2xl text-white mb-5">
              {section.title}
            </h2>
            <div className="space-y-3">
              {section.items.map((item, iIdx) => {
                const key = `${sIdx}-${iIdx}`;
                return (
                  <FaqItem
                    key={item.q}
                    item={item}
                    isOpen={openKey === key}
                    onToggle={() => setOpenKey(openKey === key ? "" : key)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Feedback / bug report block */}
        <div className="card text-center py-10 px-6">
          <h2 className="font-display font-bold text-2xl text-white mb-3">
            Still have questions?
          </h2>
          <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed mb-6">
            Didn't find what you needed, or run into a bug, glitch, or issue
            on ArenaX? Send us your feedback, bug reports, or suggestions and
            we'll take a look.
          </p>
          <a
            href="mailto:support@arenax.io"
            className="btn-primary inline-flex items-center gap-2"
          >
            Email support@arenax.io
          </a>
        </div>

        <div className="text-center">
          <Link to="/about" className="btn-secondary">
            Learn more about ArenaX
          </Link>
        </div>
      </section>
    </div>
  );
}
