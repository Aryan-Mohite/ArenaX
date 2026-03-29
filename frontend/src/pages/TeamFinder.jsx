
import { useEffect, useState } from "react";
import { getPosts } from "../services/teamFinderService";

export default function TeamFinder() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    const res = await getPosts();
    setPosts(res.data);
  };

  return (
    <div>
      <h2>Team Finder</h2>

      {posts.map((p) => (
        <div key={p.post_id}>
          <p>{p.role_required}</p>
        </div>
      ))}
    </div>
  );
}
