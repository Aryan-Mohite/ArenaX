import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { themeStyles } from "../utils/themeStyles";

// ─── Genre accent colors ───────────────────────────────────────────────────────
const GENRE_COLORS = {
  "Tactical FPS": "#ff4655",
  FPS: "#ff4655",
  MOBA: "#c89b3c",
  "Battle Royale": "#0082ff",
  Sports: "#1D9E75",
  Fighting: "#fc4b08",
  RPG: "#a855f7",
  Strategy: "#14b8a6",
  Simulation: "#f4a523",
  default: "#888780",
};
const genreColor = (g) => GENRE_COLORS[g] || GENRE_COLORS.default;

// ─── Local image map ──────────────────────────────────────────────────────────
const LOCAL_IMAGES = {
  "apex legends": "/ApexLegends.jpg",
  "battlegrounds mobile india": "/BGMI.jpg",
  "brawl stars": "/BrawlStars_1.jpg",
  "call of duty: mobile": "/COD_Mobile_1.jpg",
  "call of duty: warzone": "/COD_Warzone.jpg",
  "dota 2": "/dota_2.jpg",
  "ea sports fc": "/EA-Sports.jpg",
  fortnite: "/Frotnite.jpg",
  "free fire": "/FreeFire.jpg",
  "league of legends": "/league-of-legends_1.jpg",
  "pubg: battlegrounds": "/PUBG.jpg",
  "rocket league": "/Rocket_League_1.jpg",
  valorant: "/Valorant.jpg",
  "counter-strike": "/images.jpg",
  "mobile legends: bang bang": "/MobileLegends.png",
};
const getLocalImage = (name) =>
  LOCAL_IMAGES[name?.toLowerCase().trim()] || null;

// ─── Star rating ──────────────────────────────────────────────────────────────
function StarRating({ rating, max = 5, size = 10 }) {
  if (!rating) return null;
  const filled = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i < filled ? "#f4a523" : "none"}
          stroke={i < filled ? "#f4a523" : "#4b5563"}
          strokeWidth="2"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Cover image ──────────────────────────────────────────────────────────────
function GameCover({ game, height = "h-44" }) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const localImg = getLocalImage(game.game_name);
  const sources = [localImg, game.cover_image, game.icon].filter(Boolean);
  const [srcIndex, setSrcIndex] = useState(0);

  const src = sources[srcIndex] || null;
  const color = genreColor(game.genre);
  const abbr = game.game_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  const handleError = () => {
    if (srcIndex < sources.length - 1) setSrcIndex((i) => i + 1);
    else setSrcIndex(sources.length);
  };

  // overlay fades into the card body so text sits cleanly on top of the image
  const overlayBg = isLight
    ? "linear-gradient(to top, var(--bg-card) 0%, transparent 70%)"
    : "linear-gradient(to top, #1a2340 0%, transparent 70%)";

  return (
    <div className={`relative w-full ${height} overflow-hidden flex-shrink-0`}>
      {src ? (
        <img
          loading="lazy"
          src={src}
          alt={game.game_name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={handleError}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background: isLight
              ? `linear-gradient(160deg, ${color}20 0%, #e8edf5 100%)`
              : `linear-gradient(160deg, ${color}40 0%, #0a0a1a 100%)`,
          }}
        >
          <div className="flex flex-col items-center gap-1 opacity-80">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-black text-xl"
              style={{
                background: color + "25",
                border: `1.5px solid ${color}50`,
                color,
              }}
            >
              {abbr}
            </div>
          </div>
        </div>
      )}
      {/* gradient overlay — blends into card background */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{ background: overlayBg }}
      />
    </div>
  );
}

// ─── Main GameCard ─────────────────────────────────────────────────────────────
export default function GameCard({ game, onAdd, onRemove, isFav = false }) {
  const { theme } = useTheme();
  const ts = themeStyles(theme);
  const isLight = theme === "light";

  const [hovered, setHovered] = useState(false);
  const color = genreColor(game.genre);

  const cardStyle = {
    ...ts.cardBg,
    border: `1px solid ${hovered ? color + "55" : isLight ? "var(--border-color)" : "rgba(255,255,255,0.06)"}`,
    boxShadow: hovered
      ? isLight
        ? `0 8px 24px ${color}18`
        : `0 8px 32px ${color}20`
      : "none",
  };

  // Real <a> (via Link) rather than an onClick handler, so crawlers can
  // discover /games/:slug pages by following links, not just via sitemap.
  const CardTag = game.slug ? Link : "div";
  const cardTagProps = game.slug ? { to: `/games/${game.slug}` } : {};

  return (
    <CardTag
      {...cardTagProps}
      className="relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-200 hover:-translate-y-1 flex flex-col"
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative">
        <GameCover game={game} height="h-44" />

        <div className="absolute top-2 left-2 z-10">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: color + "25",
              color,
              border: `1px solid ${color}40`,
            }}
          >
            {game.genre || "Game"}
          </span>
        </div>

        {game.platforms && (
          <div className="absolute top-2 right-2 z-10">
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: isLight ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.6)",
                color: isLight ? "#475569" : "#9ca3af",
                border: isLight
                  ? "1px solid rgba(0,0,0,0.1)"
                  : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {game.platforms.includes("Mobile") &&
              !game.platforms.includes("PC")
                ? "📱"
                : game.platforms.includes("PC") &&
                    game.platforms.includes("Mobile")
                  ? "📱+🖥️"
                  : "🖥️"}
            </span>
          </div>
        )}

        {isFav && (
          <div
            className="absolute bottom-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: "#f4a52320", border: "1px solid #f4a52360" }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#f4a523">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1 gap-1.5">
        <div>
          <h3
            className="text-sm font-semibold truncate leading-tight"
            style={{ color: isLight ? "#0f172a" : "#fff" }}
          >
            {game.game_name}
          </h3>
          {game.developer && (
            <p className="text-gray-500 text-[10px] mt-0.5 truncate">
              {game.developer}
            </p>
          )}
        </div>

        {game.rating && (
          <div className="flex items-center gap-2">
            <StarRating rating={game.rating} />
            <span className="text-[10px] text-gray-400 font-medium">
              {Number(game.rating).toFixed(1)}
            </span>
          </div>
        )}

        {game.release_year && (
          <p className="text-[9px] text-gray-500">{game.release_year}</p>
        )}

        <div className="mt-auto pt-1">
          {isFav ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.(game.game_id);
              }}
              className="w-full text-xs py-1.5 rounded-lg font-semibold transition-all"
              style={{
                background: "#ff465518",
                color: "#ff4655",
                border: "1px solid #ff465540",
              }}
            >
              − Remove
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd?.(game);
              }}
              className="w-full text-xs py-1.5 rounded-lg font-semibold transition-all"
              style={{
                background: color + "18",
                color,
                border: `1px solid ${color}40`,
              }}
            >
              + Add to Library
            </button>
          )}
        </div>
      </div>
    </CardTag>
  );
}
