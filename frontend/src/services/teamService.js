import API from '../api/api'

export const getMyTeams           = ()                   => API.get('/teams/mine')
export const getAllTeams           = ()                   => API.get('/teams/all')
export const createTeam           = (data)               => API.post('/teams', data)
export const getTeam              = (id)                 => API.get(`/teams/${id}`)
export const deleteTeam           = (id)                 => API.delete(`/teams/${id}`)
export const leaveTeam            = (id)                 => API.delete(`/teams/${id}/leave`)
export const kickMember           = (teamId, userId)     => API.delete(`/teams/${teamId}/members/${userId}`)
export const inviteMember         = (teamId, userId)     => API.post(`/teams/${teamId}/invite`, { user_id: userId })
export const respondToInvitation  = (inviteId, action)  => API.patch(`/teams/invitations/${inviteId}`, { action })
