import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getFeaturedTournaments } from "../services/tournamentService";

// §5: admin-assigned "Presented by <sponsor>" placements. Renders nothing
// when there are no active placements, so it's safe to drop anywhere.
export default function FeaturedTournaments({ className = "" }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    getFeaturedTournaments()
      .then((r) => setItems(r.data.featured || []))
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Featured tournaments</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.slice(0, 4).map((f) => (
          <Link
            key={f.placement_id}
            to={`/tournament/${f.tournament_id}`}
            className="card-hover flex items-center gap-4 overflow-hidden"
          >
            <div
              className="w-24 h-24 rounded-lg bg-navy bg-cover bg-center shrink-0"
              style={f.image_url ? { backgroundImage: `url(${f.image_url})` } : undefined}
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white truncate">{f.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {f.start_date ? new Date(f.start_date).toLocaleDateString("en-IN") : ""}
              </p>
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                Presented by
                {f.sponsor_logo && (
                  <img src={f.sponsor_logo} alt="" loading="lazy" className="h-4 w-4 rounded object-cover" />
                )}
                <span className="text-white font-semibold">{f.sponsor_name}</span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
