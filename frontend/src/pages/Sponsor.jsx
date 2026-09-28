import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { applyForSponsor, getMySponsorProfile } from "../services/sponsorService";
import { useAuth } from "../context/AuthContext";
import SEO from "../components/SEO";

const STATUS_COPY = {
  pending: "Your application is under review — we'll be in touch soon.",
  approved: "You're an approved ArenaX sponsor. Our team assigns placements manually; reach out to plan your first one.",
  rejected: "Your last application wasn't approved. Contact support if you'd like to reapply.",
};

export default function Sponsor() {
  const { isAuthenticated } = useAuth();
  const [existing, setExisting] = useState(null);
  const [form, setForm] = useState({ company_name: "", website: "", contact_email: "", logo_url: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!isAuthenticated) return;
    getMySponsorProfile().then((r) => setExisting(r.data.sponsor)).catch(() => {});
  }, [isAuthenticated]);

  const submit = async () => {
    setError("");
    if (!form.company_name.trim()) return setError("Company name is required");
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
      const r = await applyForSponsor(body);
      setDone(r.data.message);
      setExisting({ status: "pending", company_name: form.company_name });
    } catch (e) {
      const d = e.response?.data;
      setError(d?.errors?.length ? d.errors.map((x) => x.message).join(" · ") : d?.message || "Couldn't submit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">
      <SEO
        title="Sponsor ArenaX — Reach College Esports Players"
        description="Put your brand in front of India's college esports players. Sponsor tournaments on ArenaX."
        path="/sponsor"
      />
      <h1 className="font-display font-bold text-3xl text-white mb-2">Sponsor on ArenaX</h1>
      <p className="text-gray-400 mb-6">
        Present tournaments to an engaged, college-age competitive gaming audience. Placements
        are assigned by our team — apply below and we'll work out what fits your goals.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {[
          ["🏆", "Presented-by placement", "Your name and logo on featured tournaments"],
          ["🎓", "College reach", "Players tied to real campuses"],
          ["📊", "Participation data", "Aggregate, anonymised trends — no ad-impression guesswork"],
        ].map(([i, t, d]) => (
          <div key={t} className="card">
            <div className="text-2xl mb-1">{i}</div>
            <p className="font-semibold text-white text-sm">{t}</p>
            <p className="text-xs text-gray-500 mt-1">{d}</p>
          </div>
        ))}
      </div>

      {!isAuthenticated ? (
        <div className="card text-center">
          <p className="text-gray-400 mb-3">Log in to submit a sponsor application.</p>
          <Link to="/login" className="btn-primary">Log in</Link>
        </div>
      ) : existing ? (
        <div className="card">
          <p className="font-semibold text-white mb-1">
            {existing.company_name} · <span className="capitalize">{existing.status}</span>
          </p>
          <p className="text-sm text-gray-400">{done || STATUS_COPY[existing.status]}</p>
        </div>
      ) : (
        <div className="card space-y-3">
          <input className="input" placeholder="Company name *" value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)} />
          <input className="input" type="url" placeholder="Website (https://…)" value={form.website}
            onChange={(e) => set("website", e.target.value)} />
          <input className="input" type="email" placeholder="Contact email" value={form.contact_email}
            onChange={(e) => set("contact_email", e.target.value)} />
          <input className="input" type="url" placeholder="Logo URL (https://…)" value={form.logo_url}
            onChange={(e) => set("logo_url", e.target.value)} />
          {error && <p className="text-sm text-red">{error}</p>}
          <button className="btn-primary w-full" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Apply to sponsor"}
          </button>
        </div>
      )}
    </div>
  );
}
