import API from '../api/api'

export const getCommunities      = (params)         => API.get('/communities', { params })
export const getCommunityPosts   = (id, params)     => API.get(`/communities/${id}/posts`, { params })
export const getFollowingPosts   = (id, params)     => API.get(`/communities/${id}/following-posts`, { params })
export const getAllFavGamesPosts  = (params)         => API.get('/communities/all-posts', { params })
export const getAllPosts          = (params)         => API.get('/communities/posts', { params })
export const createCommunityPost = (id, data)       => API.post(`/communities/${id}/posts`, data)
export const getPost             = (post_id)        => API.get(`/communities/posts/${post_id}`)
export const addComment          = (post_id, data)  => API.post(`/communities/posts/${post_id}/comments`, data)
export const deleteComment       = (comment_id)     => API.delete(`/communities/comments/${comment_id}`)
export const deleteCommunityPost = (post_id)        => API.delete(`/communities/posts/${post_id}`)
export const votePost            = (post_id, vote)  => API.post(`/communities/posts/${post_id}/vote`, { vote })
