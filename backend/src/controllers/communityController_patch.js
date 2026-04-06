// PATCH for getCommunities — add support for ?user_id=X to filter by fav games
// and getCommunityPosts — add ?following=true to filter posts from followed users

// Add this to communityController.js getCommunityPosts:
// If req.query.following === 'true' and req.user exists, filter to only show posts
// from users the current user follows.

// This is the updated getCommunityPosts to add at the end of communityController.js:
