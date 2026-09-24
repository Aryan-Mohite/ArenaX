import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function TeamFinderCard({ post, onApply }) {
  const { isAuthenticated } = useAuth()
  const [copied, setCopied] = useState(false)

  const {
    post_id, username, profile_picture,
    game_name, game_icon, rank_required,
    role_required, region, description,
    poster_rank, /* poster_elo, */ created_at,
  } = post

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60)  return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)   return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const handleShare = (e) => {
    e.stopPropagation()
    const url = `${window.location.origin}/teamfinder?post=${post_id}`
    const shareData = { title: `${username} is looking for teammates`, text: `${username} is looking for teammates in ${game_name}`, url }
    if (navigator.share) {
      navigator.share(shareData).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
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
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-600">{timeAgo(created_at)}</span>
          <button
            onClick={handleShare}
            title="Share post"
            className="flex items-center justify-center w-7 h-7 rounded-md bg-white/5 hover:bg-red/20 border border-white/10 hover:border-red/40 text-gray-400 hover:text-red transition-all duration-200"
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {role_required  && <span className="badge-red">{role_required}</span>}
        {rank_required  && <span className="badge-blue">{rank_required}</span>}
        {region         && <span className="badge-gray">{region}</span>}
        {/* {poster_elo && <span className="badge-gray">ELO {poster_elo}</span>} */}
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
