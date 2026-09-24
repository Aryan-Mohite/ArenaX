import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PageLoader, PageHeader, EmptyState, ErrorMessage, StatCard } from "../components/UI";
import {
  getPlans,
  getMySubscription,
  createPaymentOrder,
  verifyPayment,
  cancelSubscription,
} from "../services/paymentService";
import {
  requestVerification,
  getVerificationStatus,
  getMyTournaments,
  getMyTournamentsSummary,
  updateTournamentBranding,
  getTournamentAnalytics,
  announceToTournament,
} from "../services/organizerService";

// Loads Razorpay's checkout script once and caches the promise so repeated
// upgrade clicks don't re-inject the <script> tag.
let razorpayScriptPromise = null;
function loadRazorpayScript() {
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [verification, setVerification] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [summary, setSummary] = useState(null);

  const [showPlans, setShowPlans] = useState(false);
  const [brandingModal, setBrandingModal] = useState(null); // tournament object
  const [analyticsModal, setAnalyticsModal] = useState(null); // { tournament, data }
  const [announceModal, setAnnounceModal] = useState(null); // tournament object

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const featureFlags = subscription?.feature_flags || {};

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subRes, plansRes, verRes, tRes] = await Promise.all([
        getMySubscription(),
        getPlans(),
        getVerificationStatus(),
        getMyTournaments(),
      ]);
      setSubscription(subRes.data.subscription);
      setPlans(plansRes.data.plans);
      setVerification(verRes.data.verification);
      setTournaments(tRes.data.tournaments);

      // Summary is gated — only fetch it if the org tier's flag is present,
      // so free/pro users don't hit an expected 403 on every page load.
      if (subRes.data.subscription?.feature_flags?.multi_tournament_dashboard) {
        const sumRes = await getMyTournamentsSummary();
        setSummary(sumRes.data.summary);
      }
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load your organizer dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpgrade = async (plan) => {
    const scriptOk = await loadRazorpayScript();
    if (!scriptOk) return showToast("Couldn't load the payment SDK — check your connection", false);

    try {
      const { data } = await createPaymentOrder(plan.plan_id);
      const rzp = new window.Razorpay({
        key: data.key_id,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.id,
        name: "ArenaX",
        description: `Upgrade to ${data.plan.name}`,
        theme: { color: "#ff4655" },
        handler: async (response) => {
          try {
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            showToast(`Upgraded to ${data.plan.name}!`);
            setShowPlans(false);
            load();
          } catch (e) {
            showToast(e.response?.data?.message || "Payment verification failed", false);
          }
        },
      });
      rzp.on("payment.failed", () => showToast("Payment failed — nothing was charged", false));
      rzp.open();
    } catch (e) {
      showToast(e.response?.data?.message || "Couldn't start checkout", false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Downgrade to the free plan? You'll lose Pro/Org features immediately.")) return;
    try {
      await cancelSubscription();
      showToast("Downgraded to free plan");
      load();
    } catch (e) {
      showToast(e.response?.data?.message || "Couldn't cancel subscription", false);
    }
  };

  const handleRequestVerification = async () => {
    try {
      const { data } = await requestVerification();
      showToast(data.message);
      load();
    } catch (e) {
      showToast(e.response?.data?.message || "Couldn't submit verification request", false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <PageHeader
        title="Organizer Dashboard"
        subtitle={`Signed in as ${user?.username || "—"}`}
      />

      {toast && (
        <div
          className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl font-semibold text-sm shadow-2xl animate-fade-in"
          style={{ background: toast.ok ? "#16a34a" : "#dc2626" }}
        >
          {toast.msg}
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      {/* ── Plan card ─────────────────────────────────────────────────── */}
      <div className="card mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Current Plan</div>
          <div className="text-xl font-display font-bold text-white">
            {subscription ? subscription.name : "Organizer — Free"}
          </div>
          {subscription?.renews_at && (
            <div className="text-xs text-gray-500 mt-1">
              Renews {new Date(subscription.renews_at).toLocaleDateString("en-IN")}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button className="btn-primary" onClick={() => setShowPlans(true)}>
            {subscription ? "Change Plan" : "Upgrade"}
          </button>
          {subscription && (
            <button className="btn-ghost" onClick={handleCancel}>
              Downgrade to Free
            </button>
          )}
        </div>
      </div>

      {/* ── Verification banner ──────────────────────────────────────── */}
      {featureFlags.branded_page && verification?.status !== "approved" && (
        <div className="card mb-8 border-yellow-500/30 bg-yellow-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="font-semibold text-white mb-1">Organizer verification required</div>
              <p className="text-sm text-gray-400">
                {verification?.status === "pending"
                  ? "Your request is pending admin review — new tournaments stay hidden from public listings until then."
                  : verification?.status === "rejected"
                  ? `Your last request was rejected${verification.note ? `: "${verification.note}"` : "."} You can request again.`
                  : "Your plan unlocks a branded tournament page — verify your account so new tournaments can go public."}
              </p>
            </div>
            {verification?.status !== "pending" && (
              <button className="btn-primary whitespace-nowrap" onClick={handleRequestVerification}>
                Request Verification
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Multi-tournament summary (Org tier) ──────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Tournaments" value={summary.totalTournaments} />
          <StatCard label="Upcoming" value={summary.upcomingTournaments} />
          <StatCard label="Ongoing" value={summary.ongoingTournaments} />
          <StatCard label="Total Registrations" value={summary.totalRegistrations} />
        </div>
      )}

      {/* ── My tournaments ────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="section-title">My Tournaments</h2>
        <Link to="/tournament" className="btn-ghost text-sm">Create Tournament</Link>
      </div>

      {tournaments.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="No tournaments yet"
          subtitle="Tournaments you create will show up here."
        />
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <div key={t.tournament_id} className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{t.name}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {t.game_name} · {t.registered_teams} team{t.registered_teams === 1 ? "" : "s"} registered
                  {t.max_teams ? ` / ${t.max_teams} max` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {featureFlags.branded_page && (
                  <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => setBrandingModal(t)}>
                    🎨 Branding
                  </button>
                )}
                {featureFlags.analytics && (
                  <button
                    className="btn-ghost text-xs px-3 py-1.5"
                    onClick={async () => {
                      try {
                        const { data } = await getTournamentAnalytics(t.tournament_id);
                        setAnalyticsModal({ tournament: t, data: data.analytics });
                      } catch (e) {
                        showToast(e.response?.data?.message || "Couldn't load analytics", false);
                      }
                    }}
                  >
                    📊 Analytics
                  </button>
                )}
                {featureFlags.announcements && (
                  <button className="btn-ghost text-xs px-3 py-1.5" onClick={() => setAnnounceModal(t)}>
                    📢 Announce
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {showPlans && (
        <PlansModal
          plans={plans}
          current={subscription?.plan_key}
          onClose={() => setShowPlans(false)}
          onSelect={handleUpgrade}
        />
      )}
      {brandingModal && (
        <BrandingModal
          tournament={brandingModal}
          onClose={() => setBrandingModal(null)}
          onSaved={() => { setBrandingModal(null); showToast("Branding updated"); load(); }}
          showToast={showToast}
        />
      )}
      {analyticsModal && (
        <AnalyticsModal analyticsData={analyticsModal} onClose={() => setAnalyticsModal(null)} />
      )}
      {announceModal && (
        <AnnounceModal
          tournament={announceModal}
          onClose={() => setAnnounceModal(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    upcoming: { color: "#22c55e", label: "Upcoming" },
    ongoing: { color: "#3b82f6", label: "Ongoing" },
    completed: { color: "#6b7280", label: "Completed" },
    cancelled: { color: "#dc2626", label: "Cancelled" },
    pending_review: { color: "#eab308", label: "Pending Review" },
  };
  const s = map[status] || { color: "#6b7280", label: status };
  return (
    <span
      className="px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ background: s.color + "22", color: s.color }}
    >
      {s.label}
    </span>
  );
}

function PlansModal({ plans, current, onClose, onSelect }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-white">Choose a plan</h3>
          <button className="btn-ghost text-sm" onClick={onClose}>Close</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {plans.map((p) => (
            <div key={p.plan_id} className="card border-surface-border">
              <div className="font-semibold text-white">{p.name}</div>
              <div className="text-2xl font-display font-bold text-white my-2">
                ₹{Number(p.price).toLocaleString("en-IN")}
                <span className="text-xs text-gray-500 font-normal">/{p.billing_cycle}</span>
              </div>
              {p.description && <p className="text-xs text-gray-500 mb-3">{p.description}</p>}
              <button
                className="btn-primary w-full text-sm"
                disabled={p.plan_key === current || Number(p.price) === 0}
                onClick={() => onSelect(p)}
              >
                {p.plan_key === current ? "Current Plan" : Number(p.price) === 0 ? "Free" : "Select"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BrandingModal({ tournament, onClose, onSaved, showToast }) {
  const [bannerUrl, setBannerUrl] = useState(tournament.banner_url || "");
  const [primary, setPrimary] = useState(tournament.brand_primary_color || "#ff4655");
  const [accent, setAccent] = useState(tournament.brand_accent_color || "#00d4ff");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateTournamentBranding(tournament.tournament_id, {
        banner_url: bannerUrl || null,
        brand_primary_color: primary,
        brand_accent_color: accent,
      });
      onSaved();
    } catch (e) {
      showToast(e.response?.data?.message || "Couldn't save branding", false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <h3 className="font-display font-bold text-lg text-white mb-4">
          Branding — {tournament.name}
        </h3>
        <label className="text-xs text-gray-500 uppercase tracking-wider">Banner URL</label>
        <input
          className="input w-full mb-4 mt-1"
          placeholder="https://…"
          value={bannerUrl}
          onChange={(e) => setBannerUrl(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Primary Color</label>
            <input
              type="color"
              className="w-full h-10 mt-1 rounded-lg cursor-pointer bg-transparent"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Accent Color</label>
            <input
              type="color"
              className="w-full h-10 mt-1 rounded-lg cursor-pointer bg-transparent"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnalyticsModal({ analyticsData, onClose }) {
  const { tournament, data } = analyticsData;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-white">Analytics — {tournament.name}</h3>
          <button className="btn-ghost text-sm" onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard label="Registrations" value={data.totalRegistrations} />
          <StatCard label="Conversion" value={`${Math.round(data.conversionRate * 100)}%`} />
          <StatCard label="No-show" value={`${Math.round(data.noShowRate * 100)}%`} />
        </div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Registrations Over Time</div>
        {data.registrationsOverTime.length === 0 ? (
          <p className="text-sm text-gray-600">No registrations yet</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data.registrationsOverTime.map((row) => (
              <div key={row.date} className="flex justify-between text-sm text-gray-400 border-b border-surface-border/50 py-1">
                <span>{new Date(row.date).toLocaleDateString("en-IN")}</span>
                <span className="text-white font-semibold">{row.registrations}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnnounceModal({ tournament, onClose, showToast }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const { data } = await announceToTournament(tournament.tournament_id, message.trim());
      showToast(data.notified > 0 ? `Sent to ${data.notified} participant${data.notified === 1 ? "" : "s"}` : data.message);
      onClose();
    } catch (e) {
      showToast(e.response?.data?.message || "Couldn't send announcement", false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <h3 className="font-display font-bold text-lg text-white mb-4">
          Announce — {tournament.name}
        </h3>
        <textarea
          className="input w-full mb-4"
          rows={4}
          maxLength={500}
          placeholder="Message to every registered participant…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="text-xs text-gray-600 mb-4 text-right">{message.length}/500</div>
        <div className="flex gap-3 justify-end">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={send} disabled={sending || !message.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
