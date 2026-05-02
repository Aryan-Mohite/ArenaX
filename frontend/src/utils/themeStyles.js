/**
 * themeStyles.js — theme-aware inline style values
 * Usage: const ts = themeStyles(theme)  /  style={ts.cardBg}
 */
export function themeStyles(theme) {
  const isLight = theme === 'light'

  return {
    // Card / panel background
    cardBg: {
      background: isLight ? 'var(--bg-card)' : 'linear-gradient(145deg,#1a2340,#131a2e)',
    },
    // Hero / banner background — main page hero banners
    heroBg: {
      background: isLight
        ? 'linear-gradient(135deg,#f8fafc 0%,#f1f5f9 60%,#e8edf5 100%)'
        : 'linear-gradient(135deg,#0f172a 0%,#1a2340 50%,#0d0f20 100%)',
    },
    // For the TeamFinder hero (slightly purple tint in dark)
    heroBgAlt: {
      background: isLight
        ? 'linear-gradient(135deg,#f8fafc 0%,#f1f5f9 60%,#eef0f5 100%)'
        : 'linear-gradient(135deg,#0f172a 0%,#1a2340 50%,#130a1a 100%)',
    },
    // Modal backdrop
    modalBackdrop: {
      backdropFilter: 'blur(10px)',
      background: isLight ? 'rgba(15,23,42,0.4)' : 'rgba(2,6,23,0.8)',
    },
    modalBackdropSm: {
      backdropFilter: 'blur(8px)',
      background: isLight ? 'rgba(15,23,42,0.35)' : 'rgba(2,6,23,0.75)',
    },
    // Modal card
    modalCard: (accent = 'rgba(255,70,85,0.15)') => ({
      background: isLight ? 'var(--bg-card)' : 'linear-gradient(145deg,#1a2340,#131a2e)',
      boxShadow: isLight
        ? `0 0 0 1px ${accent},0 32px 80px rgba(0,0,0,0.1)`
        : `0 0 0 1px ${accent},0 32px 100px rgba(0,0,0,0.7)`,
    }),
    // Chat modal (blue accent)
    chatCard: {
      background: isLight ? 'var(--bg-card)' : 'linear-gradient(145deg,#1a2340,#0f172a)',
      boxShadow: isLight
        ? '0 0 0 1px rgba(59,130,246,0.2),0 24px 80px rgba(0,0,0,0.1)'
        : '0 0 0 1px rgba(59,130,246,0.2),0 24px 80px rgba(0,0,0,0.7)',
    },
    // Gradient header inside modal
    modalHeader: (color = 'rgba(255,70,85,0.08)') => ({
      background: `linear-gradient(135deg,${color},transparent)`,
    }),
    // stat/mini-box bg
    statBox: {
      background: isLight ? '#f1f5f9' : 'rgba(15,23,42,0.6)',
      border: `1px solid ${isLight ? '#e2e8f0' : 'transparent'}`,
    },
    // Create form card (red tinted)
    createFormBg: {
      background: isLight
        ? 'var(--bg-card)'
        : 'linear-gradient(135deg,rgba(255,70,85,0.06),rgba(26,35,64,0.9))',
    },
    // TournamentCard image gradient overlay
    cardImgOverlay: {
      background: isLight
        ? 'linear-gradient(to top,rgba(241,245,249,0.97) 0%,transparent 60%)'
        : 'linear-gradient(to top,#1a2340,transparent)',
    },
    // Communities active tab
    communitySectionBg: (isActive = false) => ({
      background: isLight
        ? isActive ? 'rgba(255,70,85,0.04)' : 'var(--bg-card)'
        : isActive
          ? 'linear-gradient(135deg,rgba(255,70,85,0.3),rgba(26,35,64,1))'
          : 'linear-gradient(135deg,#1a2340,#131a2e)',
    }),
    // Stat pill boxes inside hero (bg-white/5 equiv)
    heroPill: {
      background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}`,
    },
    // GameCard accent icon box
    gameIconBox: (color = '#1a2340') => ({
      background: isLight ? 'var(--bg-card)' : color,
      border: isLight ? '1px solid var(--border-color)' : `1px solid ${color}30`,
    }),
    // Profile Live Sync section card
    syncSectionBg: {
      background: isLight
        ? 'var(--bg-card)'
        : 'linear-gradient(145deg,#1a2340,#131a2e)',
    },
  }
}
