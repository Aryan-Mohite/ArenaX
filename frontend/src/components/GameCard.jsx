import { useState } from 'react'

// ─── Genre accent colors ───────────────────────────────────────────────────────
const GENRE_COLORS = {
  'Tactical FPS':  '#ff4655',
  'FPS':           '#ff4655',
  'MOBA':          '#c89b3c',
  'Battle Royale': '#0082ff',
  'Sports':        '#1D9E75',
  'Fighting':      '#fc4b08',
  'RPG':           '#a855f7',
  'Strategy':      '#14b8a6',
  'Simulation':    '#f4a523',
  'default':       '#888780',
}
const genreColor = (g) => GENRE_COLORS[g] || GENRE_COLORS.default

// ─── Star rating display ──────────────────────────────────────────────────────
function StarRating({ rating, max = 5, size = 10 }) {
  if (!rating) return null
  const filled = Math.round(rating)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i < filled ? '#f4a523' : 'none'}
          stroke={i < filled ? '#f4a523' : '#4b5563'}
          strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  )
}

// ─── Metacritic badge ─────────────────────────────────────────────────────────
function MetacriticBadge({ score }) {
  if (!score) return null
  const color = score >= 75 ? '#1D9E75' : score >= 50 ? '#f4a523' : '#ff4655'
  return (
    <div className="flex flex-col items-center justify-center w-9 h-9 rounded-lg font-display font-black text-sm leading-none"
      style={{ background: color + '20', border: `1.5px solid ${color}60`, color }}>
      {score}
    </div>
  )
}

// ─── Cover image with fallback gradient ───────────────────────────────────────
function GameCover({ game, height = 'h-44', showScreenshot = false }) {
  const [imgErr, setImgErr] = useState(false)
  const [ssErr,  setSsErr]  = useState(false)

  const coverUrl = game.cover_image || game.icon || null
  const ssUrl    = showScreenshot && Array.isArray(game.screenshots) && game.screenshots[0]
  const src      = showScreenshot && ssUrl && !ssErr ? ssUrl : (!imgErr && coverUrl ? coverUrl : null)
  const color    = genreColor(game.genre)
  const abbr     = game.game_name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()

  return (
    <div className={`relative w-full ${height} overflow-hidden flex-shrink-0`}>
      {src ? (
        <img
          src={src}
          alt={game.game_name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => showScreenshot ? setSsErr(true) : setImgErr(true)}
        />
      ) : (
        // Gradient fallback when no image is available
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: `linear-gradient(160deg, ${color}40 0%, #0a0a1a 100%)` }}
        >
          <div className="flex flex-col items-center gap-1 opacity-80">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-black text-xl"
              style={{ background: color + '25', border: `1.5px solid ${color}50`, color }}>
              {abbr}
            </div>
          </div>
        </div>
      )}
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #1a2340, transparent)' }} />
    </div>
  )
}

// ─── Main GameCard component ──────────────────────────────────────────────────
export default function GameCard({ game, onAdd, onRemove, isFav = false }) {
  const [hovered, setHovered] = useState(false)
  const color = genreColor(game.genre)

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-200 hover:-translate-y-1 flex flex-col"
      style={{
        background: '#1a2340',
        border: `1px solid ${hovered ? color + '55' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: hovered ? `0 8px 32px ${color}20` : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Cover image area ── */}
      <div className="relative">
        <GameCover game={game} height="h-44" />

        {/* Genre badge */}
        <div className="absolute top-2 left-2 z-10">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: color + '25', color, border: `1px solid ${color}40` }}>
            {game.genre || 'Game'}
          </span>
        </div>

        {/* Fav star */}
        {isFav && (
          <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: '#f4a52320', border: '1px solid #f4a52360' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#f4a523">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
        )}

        {/* Metacritic — bottom right of image */}
        {game.metacritic && (
          <div className="absolute bottom-2 right-2 z-10">
            <MetacriticBadge score={game.metacritic} />
          </div>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="p-3 flex flex-col flex-1 gap-1.5">
        {/* Title + developer */}
        <div>
          <h3 className="text-white text-sm font-semibold truncate leading-tight">{game.game_name}</h3>
          {game.developer && (
            <p className="text-gray-500 text-[10px] mt-0.5 truncate">{game.developer}</p>
          )}
        </div>

        {/* Rating row */}
        {(game.rating || game.rating_count) && (
          <div className="flex items-center gap-2">
            <StarRating rating={game.rating} />
            {game.rating && (
              <span className="text-[10px] text-gray-400 font-medium">
                {Number(game.rating).toFixed(1)}
                {game.rating_count > 0 && (
                  <span className="text-gray-600"> · {game.rating_count.toLocaleString()}</span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Platforms */}
        {game.platforms && (
          <p className="text-[9px] text-gray-600 truncate">{game.platforms}</p>
        )}

        {/* Action button */}
        <div className="mt-auto pt-1">
          {isFav ? (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove?.(game.game_id) }}
              className="w-full text-xs py-1.5 rounded-lg font-semibold transition-all"
              style={{ background: '#ff465518', color: '#ff4655', border: '1px solid #ff465540' }}
            >
              − Remove
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd?.(game) }}
              className="w-full text-xs py-1.5 rounded-lg font-semibold transition-all"
              style={{ background: color + '18', color, border: `1px solid ${color}40` }}
            >
              + Add to Library
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
