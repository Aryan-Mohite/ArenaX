import API from '../api/api'

export const getCommunities      = (params)       => API.get('/communities', { params })
export const getCommunityPosts   = (id, params)   => API.get(`/communities/${id}/posts`, { params })
export const createCommunityPost = (id, data)     => API.post(`/communities/${id}/posts`, data)
export const getPost             = (post_id)      => API.get(`/communities/posts/${post_id}`)
export const addComment          = (post_id, data)=> API.post(`/communities/posts/${post_id}/comments`, data)
export const votePost            = (post_id, vote)=> API.post(`/communities/posts/${post_id}/vote`, { vote })
