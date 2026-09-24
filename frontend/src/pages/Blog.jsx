import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { getAllPosts } from "../data/blogPosts";

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function PostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="card flex flex-col h-full hover:-translate-y-1 transition-transform duration-200"
    >
      <div className="h-32 rounded-lg bg-surface-border/20 flex items-center justify-center text-5xl mb-4">
        {post.coverEmoji}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {post.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="badge-red text-[11px] py-0.5 px-2">
            {tag}
          </span>
        ))}
      </div>

      <h2 className="font-display font-bold text-lg text-white leading-snug mb-2">
        {post.title}
      </h2>

      <p className="text-sm text-gray-400 leading-relaxed mb-4 flex-1">
        {post.excerpt}
      </p>

      <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-surface-border">
        <span>{formatDate(post.date)}</span>
        <span>{post.readTime}</span>
      </div>
    </Link>
  );
}

export default function Blog() {
  const posts = getAllPosts();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": "https://arenax.io/blog#blog",
    name: "ArenaX Blog",
    description:
      "Guides, tips, and updates for competitive FPS players — tournaments, team building, streaming, and more.",
    url: "https://arenax.io/blog",
    publisher: {
      "@id": "https://arenax.io/#organization",
    },
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `https://arenax.io/blog/${p.slug}`,
      datePublished: p.date,
    })),
  };

  return (
    <div className="min-h-screen">
      <SEO
        title="Blog"
        description="Guides, tips, and updates for competitive FPS players — tournament prep, team finding, streaming setups, and esports fundamentals."
        path="/blog"
        jsonLd={jsonLd}
      />

      <section className="relative overflow-hidden py-20 px-4">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 20% 50%, #ff465508 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, #ff465505 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto text-center">
          <span className="badge-red mb-6 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-red-light animate-pulse" />
            ArenaX Blog
          </span>
          <h1 className="font-display font-bold text-4xl sm:text-5xl text-white leading-tight mb-4">
            Guides for competitive{" "}
            <span style={{ color: "#ff4655" }}>players</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
            Tournament prep, team building, streaming setups, and esports
            fundamentals — written for players who take their game seriously.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </section>
    </div>
  );
}
