import { useEffect, useMemo, useState } from "react";
import { getGear, gearRedirectUrl } from "../services/gearService";
import { PageLoader, EmptyState } from "../components/UI";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

export default function Gear() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    getGear()
      .then((r) => setItems(r.data.gear || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ["all", ...new Set(items.map((i) => i.category).filter(Boolean))],
    [items],
  );
  const shown = category === "all" ? items : items.filter((i) => i.category === category);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <SEO
        title="Gaming Gear — Peripherals & Setup Picks"
        description="Hand-picked gaming peripherals and gear for competitive players, curated by the ArenaX team."
        path="/gear"
      />
      <h1 className="font-display font-bold text-3xl text-white mb-1">Gear</h1>
      <p className="text-sm text-gray-500 mb-6">
        Peripherals and setup picks from the ArenaX team.
      </p>

      <div className="card mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-300">
          Earn Arena Coins by playing, then redeem them for gift cards and in-game top-ups.
        </p>
        <Link to="/rewards" className="btn-secondary text-sm">Open Rewards</Link>
      </div>

      {categories.length > 2 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                category === c ? "bg-red text-white" : "bg-navy text-gray-400 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <EmptyState icon="🎧" title="Gear picks coming soon" subtitle="Check back shortly." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {shown.map((g) => (
            <a
              key={g.item_id}
              href={gearRedirectUrl(g.item_id)}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="card-hover flex flex-col"
            >
              <div className="aspect-square rounded-lg bg-navy overflow-hidden mb-3 flex items-center justify-center text-4xl">
                {g.image_url ? (
                  <img src={g.image_url} alt={g.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  "🎧"
                )}
              </div>
              <p className="font-semibold text-white text-sm leading-snug line-clamp-2">{g.name}</p>
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="text-xs text-gray-500">{g.price_display || ""}</span>
                <span className="text-xs text-red font-semibold">View →</span>
              </div>
            </a>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-600 mt-8">
        Some links are affiliate links — ArenaX may earn a small commission at no extra cost to you.
      </p>
    </div>
  );
}
