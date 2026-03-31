export default function GameCard({ game, onAdd, onRemove, isFav = false }) {
  const GAME_IMAGES = {
    'Valorant':      'https://images.unsplash.com/photo-1637594439872-44d1b1fe0a0e?w=400&q=80',
    'CS2':           'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80',
    'League of Legends': 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&q=80',
    'PUBG':          'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80',
    'Fortnite':      'https://images.unsplash.com/photo-1612404819070-b2f2e0f28c20?w=400&q=80',
    'Dota 2':        'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&q=80',
  }

  const img = game.icon || GAME_IMAGES[game.game_name] || `https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&q=80`

  return (
    <div className="card-hover group relative overflow-hidden flex flex-col">
      {/* Cover image */}
      <div className="h-36 -mx-5 -mt-5 mb-4 overflow-hidden relative">
        <img
          src={img}
          alt={game.game_name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-transparent" />
        {game.genre && (
          <span className="absolute top-2 right-2 badge-gray text-xs">{game.genre}</span>
        )}
      </div>

      <h3 className="font-display font-bold text-lg text-white">{game.game_name}</h3>
      {game.developer && <p className="text-xs text-gray-500 mt-0.5">{game.developer}</p>}

      <div className="mt-auto pt-4">
        {isFav ? (
          <button
            onClick={() => onRemove?.(game.game_id)}
            className="w-full btn-secondary text-sm border-red/30 text-red hover:bg-red/10"
          >
            Remove
          </button>
        ) : (
          <button
            onClick={() => onAdd?.(game)}
            className="w-full btn-secondary text-sm"
          >
            + Add to Library
          </button>
        )}
      </div>
    </div>
  )
}
