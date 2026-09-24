import { useParams, Link, Navigate } from "react-router-dom";
import SEO from "../components/SEO";
import { getPostBySlug, getAllPosts } from "../data/blogPosts";

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Block({ block }) {
  if (block.type === "h2") {
    return (
      <h2 className="font-display font-bold text-2xl text-white mt-10 mb-4">
        {block.text}
      </h2>
    );
  }
  if (block.type === "h3") {
    return (
      <h3 className="font-display font-bold text-lg text-white mt-6 mb-3">
        {block.text}
      </h3>
    );
  }
  if (block.type === "ul") {
    return (
      <ul className="list-disc list-outside pl-5 space-y-2 mb-5 text-gray-300 leading-relaxed text-base">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "cta") {
    return (
      <Link
        to={block.to}
        className="card flex items-center justify-between gap-4 px-5 py-4 mb-6 hover:-translate-y-0.5 transition-transform duration-200 no-underline"
      >
        <span className="text-sm text-white font-semibold">{block.text}</span>
        <span className="text-red text-sm shrink-0">→</span>
      </Link>
    );
  }
  return (
    <p className="text-gray-300 leading-relaxed mb-5 text-base">
      {block.text}
    </p>
  );
}

export default function BlogPost() {
  const { slug } = useParams();
  const post = getPostBySlug(slug);

  if (!post) {
    // Unknown slug — send to 404 rather than render an empty SEO-less page
    return <Navigate to="/404" replace />;
  }

  const otherPosts = getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: {
      "@type": "Organization",
      name: post.author,
    },
    publisher: {
      "@id": "https://arenax.io/#organization",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://arenax.io/blog/${post.slug}`,
    },
  };

  return (
    <div className="min-h-screen">
      <SEO
        title={post.title}
        description={post.excerpt}
        path={`/blog/${post.slug}`}
        jsonLd={jsonLd}
      />

      <article className="max-w-3xl mx-auto px-4 py-16">
        <Link
          to="/blog"
          className="text-sm text-gray-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-8"
        >
          ← Back to Blog
        </Link>

        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <span key={tag} className="badge-red text-[11px] py-0.5 px-2">
              {tag}
            </span>
          ))}
        </div>

        <h1 className="font-display font-bold text-3xl sm:text-4xl text-white leading-tight mb-4">
          {post.title}
        </h1>

        <div className="flex items-center gap-3 text-sm text-gray-500 mb-10 pb-8 border-b border-surface-border">
          <span>{post.author}</span>
          <span>·</span>
          <span>{formatDate(post.date)}</span>
          <span>·</span>
          <span>{post.readTime}</span>
        </div>

        <div className="text-6xl mb-10">{post.coverEmoji}</div>

        <div>
          {post.content.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>

        <div className="mt-14 pt-8 border-t border-surface-border flex flex-wrap gap-3">
          <Link to="/tournament" className="btn-secondary">
            Browse Tournaments
          </Link>
          <Link to="/teamfinder" className="btn-secondary">
            Find Teammates
          </Link>
        </div>
      </article>

      {otherPosts.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 pb-20">
          <h2 className="font-display font-bold text-xl text-white mb-5">
            More guides
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {otherPosts.map((p) => (
              <Link
                key={p.slug}
                to={`/blog/${p.slug}`}
                className="card hover:-translate-y-1 transition-transform duration-200"
              >
                <div className="text-3xl mb-2">{p.coverEmoji}</div>
                <p className="font-display font-bold text-sm text-white leading-snug">
                  {p.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
