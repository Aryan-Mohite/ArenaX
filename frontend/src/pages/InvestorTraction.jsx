import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import TractionView from "../components/TractionView";

// Public, read-only, unlisted page. Reached only through a link an admin created.
// Uses plain fetch on purpose so no login token is ever attached.
export default function InvestorTraction() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, snapshot: null, error: "" });

  useEffect(() => {
    let live = true;
    fetch(`/api/traction/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message || "This link is invalid or has expired.");
        return d;
      })
      .then((d) => live && setState({ loading: false, snapshot: d.snapshot, error: "" }))
      .catch((e) => live && setState({ loading: false, snapshot: null, error: e.message }));
    return () => { live = false; };
  }, [token]);

  return (
    <div className="min-h-screen bg-navy text-gray-200">
      <Helmet>
        <title>ArenaX traction snapshot</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-widest" style={{ color: "#ff4655" }}>ArenaX</p>
          <h1 className="font-display font-bold text-3xl text-white">Traction snapshot</h1>
          {state.snapshot && (
            <p className="text-sm text-gray-500 mt-1">
              Live data, updated {new Date(state.snapshot.generated_at).toLocaleString("en-IN")}. Aggregated and anonymous: no player is identifiable.
            </p>
          )}
        </header>

        {state.loading && <div className="card text-gray-500">Loading…</div>}
        {state.error && <div className="card text-gray-300">{state.error}</div>}
        {state.snapshot && <TractionView snapshot={state.snapshot} />}

        <footer className="text-xs text-gray-600 mt-12 border-t border-white/5 pt-4">
          Confidential. Shared by the ArenaX team for evaluation purposes.
        </footer>
      </div>
    </div>
  );
}
