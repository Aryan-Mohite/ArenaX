import { useAuth } from '../context/AuthContext'

export default function TeamFinderCard({ post, onApply }) {
  const { isAuthenticated } = useAuth()

  const {
    post_id, username, profile_picture,
    game_name, game_icon, rank_required,
    role_required, region, description,
    poster_rank, poster_elo, created_at,
  } = post

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60)  return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)   return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="card-hover flex flex-col gap-3">
      {/* User row */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red/20 border border-red/30 flex items-center justify-center text-red font-bold text-sm shrink-0">
          {username?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{username}</p>
          <p className="text-xs text-gray-500">{game_name}</p>
        </div>
        <span className="text-xs text-gray-600">{timeAgo(created_at)}</span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {role_required  && <span className="badge-red">{role_required}</span>}
        {rank_required  && <span className="badge-blue">{rank_required}</span>}
        {region         && <span className="badge-gray">{region}</span>}
        {poster_elo     && <span className="badge-gray">ELO {poster_elo}</span>}
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">{description}</p>
      )}

      {/* Apply button */}
      {isAuthenticated && (
        <button
          onClick={() => onApply?.(post_id)}
          className="mt-auto btn-primary text-sm w-full"
        >
          Apply to Join
        </button>
      )}
    </div>
  )
}
