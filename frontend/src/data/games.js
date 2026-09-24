// ── Per-game landing page content ──────────────────────────────────────────
// Powers /games/:slug (GamePage.jsx). Kept static (not fetched from the API)
// on purpose: react-snap's prerender step runs in CI with no access to the
// live database, so any content this page needs in order to render properly
// for crawlers has to be available synchronously, without a network call.
// Live data (tournament counts, open team-finder posts) is layered on top
// client-side after mount as a progressive enhancement — see GamePage.jsx.
//
// IMPORTANT: keep `slug` values in sync with data/games.json (backend) and
// the GAME_SLUGS list in src/app.js (sitemap) — the backend can't import
// frontend source, so each side keeps its own copy of the slug list.

const GAMES = [
  {
    slug: "valorant",
    game_name: "Valorant",
    genre: "Tactical FPS",
    developer: "Riot Games",
    release_year: 2020,
    rating: 4.7,
    platforms: "PC / Console",
    description:
      "Valorant is Riot Games' tactical FPS blending precise gunplay with hero abilities. Two teams of five agents battle over a spike plant/defuse objective across multiple maps. The VCT (Valorant Champions Tour) is one of the fastest growing esports ecosystems globally.",
    cover_image: "https://cdn.akamai.steamstatic.com/steam/apps/2357570/header.jpg",
    intro:
      "Valorant is the biggest tactical shooter in competitive gaming right now, and ArenaX is where Indian and South Asian players go to actually prove it. If you're grinding ranked and want real stakes, free Valorant tournaments and a team finder built for 5-stack coordination are both right here.",
    whyCompete: [
      "Free entry Valorant tournaments for every skill level, from open brackets to ranked-gated brutes",
      "Team finder built for 5-person compositions — filter by role (duelist, controller, sentinel, initiator) and rank",
      "Live bracket tracking so your squad always knows what's next",
    ],
    faqs: [
      {
        q: "Are Valorant tournaments on ArenaX free to join?",
        a: "Yes — ArenaX tournaments are free to enter. You just need an account and a full squad (or use Team Finder to build one).",
      },
      {
        q: "Do I need a 5-stack to join a Valorant tournament?",
        a: "Most brackets are team-based and require a full 5-person roster. If you're missing players, use the Valorant Team Finder to fill your roster before registering.",
      },
      {
        q: "What ranks compete on ArenaX?",
        a: "All ranks — ArenaX runs a mix of open brackets for newer players and higher-stakes brackets for more experienced teams.",
      },
    ],
  },
  {
    slug: "counter-strike",
    game_name: "Counter-Strike",
    genre: "Tactical FPS",
    developer: "Valve",
    release_year: 2000,
    rating: 4.8,
    platforms: "PC / Console",
    description:
      "The world's most iconic tactical first-person shooter. Two teams — Terrorists and Counter-Terrorists — battle across iconic maps in search and destroy scenarios. Known for its precise gunplay, deep competitive meta, and massive esports scene.",
    cover_image: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/730/header.jpg",
    intro:
      "CS2 tournaments on ArenaX are built for players who take the competitive meta seriously — real economy management, real utility lineups, real 5v5 stakes. Whether you're queuing Premier or building a scrim-ready roster, this is where you go from lobby to bracket.",
    whyCompete: [
      "Free CS2 tournaments across multiple formats — BO1 opens through longer BO3 brackets",
      "Team finder filtered by role and rank so you're not stuck playing with randoms",
      "A community built specifically around tactical FPS coordination, not casual pubs",
    ],
    faqs: [
      {
        q: "Is this Counter-Strike 2 or the original CS?",
        a: "ArenaX tournaments run on CS2, Valve's current live version of Counter-Strike.",
      },
      {
        q: "Can I join a CS2 tournament without a full team?",
        a: "You'll need a roster to register for most brackets. Use the CS2 Team Finder to find teammates by rank and role before you sign up.",
      },
      {
        q: "How are CS2 tournament brackets decided?",
        a: "Brackets are seeded and displayed live on your tournament page, so your team always knows the next match and opponent.",
      },
    ],
  },
  {
    slug: "league-of-legends",
    game_name: "League of Legends",
    genre: "MOBA",
    developer: "Riot Games",
    release_year: 2009,
    rating: 4.5,
    platforms: "PC / Console",
    description:
      "League of Legends is the most played PC game in the world. Two teams of five champions battle to destroy the enemy Nexus across Summoner's Rift. With hundreds of champions, deep strategic depth, and the Worlds Championship drawing tens of millions of viewers, LoL is the defining esport.",
    cover_image: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Jinx_0.jpg",
    intro:
      "League of Legends rewards drafting, macro, and five players who actually know their roles. ArenaX gives you free tournaments to test that against real opponents, plus a team finder built around the standard top/jungle/mid/bot/support structure.",
    whyCompete: [
      "Free League of Legends tournaments for solo queue grinders ready to test 5v5 coordination",
      "Team finder filtered by role, so you can slot straight into a roster that needs exactly your position",
      "Live standings and bracket progress so your team knows what's on the line each round",
    ],
    faqs: [
      {
        q: "Do I need a fixed 5-man roster for League tournaments?",
        a: "Yes, most brackets are team-based. Use the League of Legends Team Finder to lock in a jungler, support, or whichever role you're missing.",
      },
      {
        q: "What rank do I need to compete?",
        a: "There's no minimum rank requirement — ArenaX runs brackets for a range of skill levels.",
      },
      {
        q: "Is entry free?",
        a: "Yes, League of Legends tournaments on ArenaX are free to enter.",
      },
    ],
  },
  {
    slug: "dota-2",
    game_name: "Dota 2",
    genre: "MOBA",
    developer: "Valve",
    release_year: 2013,
    rating: 4.6,
    platforms: "PC / Console",
    description:
      "Dota 2 is a deep, complex multiplayer online battle arena where two teams of five heroes clash to destroy the enemy Ancient. With over 120 heroes, a rich item system, and The International — one of the world's biggest esports events — Dota 2 rewards thousands of hours of mastery.",
    cover_image: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/570/header.jpg",
    intro:
      "Dota 2 has the steepest learning curve in esports — which is exactly why the players who stick with it want somewhere real to compete. ArenaX runs free Dota 2 tournaments and a team finder built for five-role drafting, from safe lane carries to hard support.",
    whyCompete: [
      "Free Dota 2 tournaments with real bracket structure, not just casual scrims",
      "Team finder filtered by role and rank, so your draft actually comes together",
      "A platform built for players who've put in the hours and want it to count for something",
    ],
    faqs: [
      {
        q: "Do I need a full 5-stack to enter a Dota 2 tournament?",
        a: "Most brackets require a complete roster. Use the Dota 2 Team Finder to fill any open role before registering.",
      },
      {
        q: "Are Dota 2 tournaments on ArenaX free?",
        a: "Yes, entry is free for all Dota 2 brackets.",
      },
      {
        q: "What format do matches use?",
        a: "Formats vary by tournament — check each bracket's page for BO1/BO3 details and scheduling.",
      },
    ],
  },
  {
    slug: "apex-legends",
    game_name: "Apex Legends",
    genre: "Battle Royale",
    developer: "Respawn Entertainment",
    release_year: 2019,
    rating: 4.5,
    platforms: "PC / Console",
    description:
      "Apex Legends is a free-to-play battle royale where squads of three choose from a roster of Legends with unique abilities. Fast movement, ping communication, and hero synergy set it apart. The ALGS (Apex Legends Global Series) hosts millions in prize money annually.",
    cover_image: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1172470/header.jpg",
    intro:
      "Apex Legends esports is about movement, third-partying, and squads that trust each other's calls. ArenaX runs free Apex tournaments for trios ready to prove it, plus a team finder built around Legend picks and playstyle.",
    whyCompete: [
      "Free Apex Legends tournaments for trios at every skill level",
      "Team finder built for 3-person squads — filter by Legend preference and rank",
      "Live bracket and placement tracking across matches",
    ],
    faqs: [
      {
        q: "How many players are on an Apex Legends team?",
        a: "Apex is played in trios — squads of three. Use Team Finder if you need one or two more players.",
      },
      {
        q: "Is entry free?",
        a: "Yes, Apex Legends tournaments on ArenaX are free to join.",
      },
      {
        q: "Does ArenaX support console and PC Apex players?",
        a: "Apex Legends is available across PC and console — check individual tournament listings for platform-specific brackets.",
      },
    ],
  },
  {
    slug: "fortnite",
    game_name: "Fortnite",
    genre: "Battle Royale",
    developer: "Epic Games",
    release_year: 2017,
    rating: 4.4,
    platforms: "PC / Console",
    description:
      "Fortnite is the world's biggest battle royale phenomenon. 100 players drop into a colorful island, build structures, and fight to be the last one standing. Epic's Fortnite Champion Series and mega-events like Fortnite World Cup offer millions in prize money and millions more viewers worldwide.",
    cover_image: "https://cdn2.unrealengine.com/fortnite-chapter5-season4-key-art-1920x1080-dc5ac6ce6a4b.jpg",
    intro:
      "Fortnite competitive is about building, editing, and closing out endgames under pressure. ArenaX runs free Fortnite tournaments so you can put those mechanics on the line against real opponents, solo or as a squad.",
    whyCompete: [
      "Free Fortnite tournaments across solo and squad formats",
      "Team finder for players building a squad ahead of tournament day",
      "Live placement tracking so you always know where your run stands",
    ],
    faqs: [
      {
        q: "Can I play Fortnite tournaments solo on ArenaX?",
        a: "Yes — Fortnite brackets include both solo and squad formats depending on the tournament.",
      },
      {
        q: "Is entry free?",
        a: "Yes, all Fortnite tournaments on ArenaX are free to enter.",
      },
      {
        q: "How do I find squadmates?",
        a: "Use the Fortnite Team Finder to post what you're looking for or browse open squad listings.",
      },
    ],
  },
  {
    slug: "warzone",
    game_name: "Call of Duty: Warzone",
    genre: "Battle Royale",
    developer: "Activision",
    release_year: 2020,
    rating: 4.3,
    platforms: "PC / Console",
    description:
      "Call of Duty: Warzone is a free-to-play battle royale dropping up to 150 players into Verdansk, Al Mazrah, and Urzikstan. With COD gunplay at its core, the Gulag resurrection system, and cross-play across all platforms, Warzone became one of the most-played games ever released.",
    cover_image: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1962663/header.jpg",
    intro:
      "Warzone rewards fast rotations, clean gunfights, and squads that communicate. ArenaX runs free Warzone tournaments across the current map pool so your trio or quad has somewhere real to compete.",
    whyCompete: [
      "Free Warzone tournaments open to PC and console players",
      "Team finder built for squad-based Warzone play",
      "Live bracket tracking across placement-based scoring",
    ],
    faqs: [
      {
        q: "Is Warzone cross-play on ArenaX tournaments?",
        a: "Warzone itself supports cross-play across PC and console — check each tournament listing for platform-specific rules.",
      },
      {
        q: "Is entry free?",
        a: "Yes, Warzone tournaments on ArenaX are free to enter.",
      },
      {
        q: "How do I build a full squad?",
        a: "Use the Warzone Team Finder to fill out your roster before registering for a tournament.",
      },
    ],
  },
  {
    slug: "pubg-battlegrounds",
    game_name: "PUBG: Battlegrounds",
    genre: "Battle Royale",
    developer: "Krafton",
    release_year: 2017,
    rating: 4.2,
    platforms: "PC / Console",
    description:
      "PUBG: Battlegrounds is the original battle royale that launched a genre. Up to 100 players parachute onto an island, scavenge for weapons and gear, and fight to be the last one standing inside a shrinking playzone. PUBG Global Championship is one of the most prestigious BR esports events.",
    cover_image: "https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/578080/header.jpg",
    intro:
      "PUBG still runs on patience, positioning, and a squad that plays the zone correctly. ArenaX runs free PUBG tournaments for players who'd rather win a firefight for real stakes than another pub match.",
    whyCompete: [
      "Free PUBG: Battlegrounds tournaments across squad formats",
      "Team finder for building a full 4-person roster",
      "Live placement and kill tracking through the bracket",
    ],
    faqs: [
      {
        q: "How many players are on a PUBG squad?",
        a: "Standard squads are 4 players. Use Team Finder if you need to fill your roster.",
      },
      {
        q: "Is entry free?",
        a: "Yes, PUBG: Battlegrounds tournaments on ArenaX are free to join.",
      },
      {
        q: "Which maps are used?",
        a: "Map rotation varies by tournament — check the specific bracket page for details.",
      },
    ],
  },
  {
    slug: "battlegrounds-mobile-india",
    game_name: "Battlegrounds Mobile India",
    genre: "Battle Royale",
    developer: "Krafton",
    release_year: 2021,
    rating: 4.3,
    platforms: "Mobile",
    description:
      "BGMI is the India-exclusive version of PUBG Mobile, built specifically for the Indian gaming audience. Teams of 4 compete across Erangel, Miramar, and Sanhok maps to be the last squad standing. BGMI Esports has exploded with massive prize pools and dedicated regional circuits.",
    cover_image: "https://play-lh.googleusercontent.com/JRd05pyBH41qjgsR_CDje2bF6EMk2WPFUdG5sNYjQOZ12M9hulZ_5a6CeYGXTxM4_Pg",
    intro:
      "BGMI has one of the most active competitive scenes in Indian mobile esports, and ArenaX is built for it — free tournaments, a team finder for squad-based play, and brackets that actually reward good rotations and clean fights.",
    whyCompete: [
      "Free BGMI tournaments built specifically for the Indian competitive scene",
      "Team finder for building a 4-person squad ahead of tournament day",
      "Live placement tracking across Erangel, Miramar, and Sanhok",
    ],
    faqs: [
      {
        q: "Is BGMI available outside India on ArenaX?",
        a: "BGMI tournaments on ArenaX follow the game's own regional availability, which is focused on the Indian market.",
      },
      {
        q: "Is entry free?",
        a: "Yes, BGMI tournaments on ArenaX are free to enter.",
      },
      {
        q: "How do I find squadmates for BGMI?",
        a: "Use the BGMI Team Finder to post what you need or browse open squad listings by rank.",
      },
    ],
  },
  {
    slug: "free-fire",
    game_name: "Free Fire",
    genre: "Battle Royale",
    developer: "Garena",
    release_year: 2017,
    rating: 4.2,
    platforms: "Mobile",
    description:
      "Garena Free Fire is the most downloaded mobile game in the world. 50 players drop onto a remote island, scavenge for weapons, and battle to be the last one alive in matches under 10 minutes. Designed for low-end devices, Free Fire has built a massive esports ecosystem across South and Southeast Asia.",
    cover_image: "https://play-lh.googleusercontent.com/WWcMGBjDMXpHyBFfxDhVuGpVZYyBECjTMj-hHX6BSipJoMv-Z_iMU6dFM3f2hE5RXQE",
    intro:
      "Free Fire's fast 10-minute matches leave no room for a bad rotation, and ArenaX gives squads a real place to test that under tournament pressure — free entry, live brackets, and a team finder built for quick squad-building.",
    whyCompete: [
      "Free Free Fire tournaments with fast, high-intensity match formats",
      "Team finder built for squad-based mobile play",
      "Live bracket and placement tracking",
    ],
    faqs: [
      {
        q: "How many players are on a Free Fire squad?",
        a: "Standard squads are 4 players. Use Team Finder to fill any open spot.",
      },
      {
        q: "Is entry free?",
        a: "Yes, Free Fire tournaments on ArenaX are free to join.",
      },
      {
        q: "Do I need a high-end phone to compete?",
        a: "Free Fire is designed to run on lower-end devices, so no high-end phone is required to compete.",
      },
    ],
  },
  {
    slug: "cod-mobile",
    game_name: "Call of Duty: Mobile",
    genre: "FPS",
    developer: "Activision / TiMi Studio",
    release_year: 2019,
    rating: 4.4,
    platforms: "Mobile",
    description:
      "Call of Duty: Mobile brings the signature COD multiplayer experience — classic maps, ranked play, and a full battle royale mode — to mobile devices. With iconic maps like Nuketown and Shipment, intuitive touch controls, and the COD Mobile World Championship, it is the #1 mobile FPS globally.",
    cover_image: "https://play-lh.googleusercontent.com/3rQX4_9s3f8hLO_4Z5Kf8FYz1-HI6LqDMlGF7P_M6G2lhSGXiMw7G4RBvMwGr_mvJE",
    intro:
      "COD Mobile brings console-style multiplayer to a touchscreen, and the competitive scene rewards exactly that: fast reflexes, map knowledge, and a squad that rotates together. ArenaX runs free COD Mobile tournaments across multiplayer and battle royale formats.",
    whyCompete: [
      "Free Call of Duty: Mobile tournaments across multiplayer ranked and battle royale",
      "Team finder for building a full squad before tournament day",
      "Live bracket tracking across matches",
    ],
    faqs: [
      {
        q: "Does ArenaX support both COD Mobile modes?",
        a: "Tournament formats vary — check individual listings for whether a bracket runs multiplayer, battle royale, or both.",
      },
      {
        q: "Is entry free?",
        a: "Yes, Call of Duty: Mobile tournaments on ArenaX are free to enter.",
      },
      {
        q: "How do I find teammates?",
        a: "Use the COD Mobile Team Finder to post what role you need or browse open squad listings.",
      },
    ],
  },
];

export function getAllGames() {
  return GAMES;
}

export function getGameBySlug(slug) {
  return GAMES.find((g) => g.slug === slug) || null;
}

export default GAMES;
