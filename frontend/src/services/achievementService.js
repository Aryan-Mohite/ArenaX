import API from '../api/api'

// GET { achieved: [...], locked: [...], streak: { current_streak, longest_streak } }
export const getMyAchievements = () => API.get('/achievements/me')

// GET { alreadyCheckedIn, currentStreak, longestStreak }
export const getCheckinStatus = () => API.get('/achievements/checkin')

// POST -> { currentStreak, longestStreak, newlyEarnedAchievements }
export const claimCheckin = () => API.post('/achievements/checkin')
