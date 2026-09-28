import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPlans, getMySubscription } from "../services/paymentService";

// ─── Tier copy ──────────────────────────────────────────────────────────────
// Curated, human-readable descriptions of what each organizer tier includes.
// Keyed by plan_key so this stays in sync with `plans.feature_flags` in the
// DB without the display copy having to be derived from raw boolean flags.
// Only two tiers for now — Free and Pro. (Organization-tier features were
// folded into Pro; see migrations_section2b_tier_consolidation.sql.)
export const ORGANIZER_TIER_CONTENT = {
  organizer_free: {
    tagline: "Everything you need to run your first bracket.",
    icon: "🎮",
    features: [
      { label: "Public tournament listing", included: true },
      { label: "Bracket creation & team registration", included: true },
      { label: "Capped participants per tournament", included: true },
      { label: "Branded tournament page", included: false },
      { label: "Automated participant announcements", included: false },
      { label: "Registration & conversion analytics", included: false },
    ],
  },
  organizer_pro: {
    tagline: "Scale up with branding, automation, and real numbers.",
    icon: "🏆",
    badge: "Most Popular",
    highlight: true,
    features: [
      { label: "Everything in Free", included: true },
      { label: "Unlimited participants", included: true },
      { label: "Branded tournament page (banner + colors)", included: true },
      { label: "Automated participant announcements", included: true },
      { label: "Registration & conversion analytics", included: true },
      { label: "Multi-tournament dashboard + API access", included: true },
    ],
  },
};

// ─── Gamer tier copy (§4 — ArenaX Pro membership) ──────────────────────────
// Same pattern as ORGANIZER_TIER_CONTENT above, keyed by plan_key, kept in
// sync with the `gamer_pro` row's feature_flags rather than deriving copy
// from the raw booleans.
export const GAMER_TIER_CONTENT = {
  gamer_free: {
    tagline: "The free side of ArenaX — always wide open.",
    icon: "🎮",
    features: [
      { label: "Team Finder & tournament browsing", included: true },
      { label: "Community (The Nexus)", included: true },
      { label: "Verified-profile badge", included: false },
      { label: "Advanced player stats when scouting others", included: false },
      { label: "Priority placement in Team Finder", included: false },
      { label: "Profile banner customization", included: false },
    ],
  },
  gamer_pro: {
    tagline: "Stand out, scout smarter, get found first.",
    icon: "⭐",
    badge: "ArenaX Pro",
    highlight: true,
    features: [
      { label: "Everything free players get", included: true },
      { label: "Verified-profile badge", included: true },
      { label: "Advanced player stats when scouting others", included: true },
      { label: "Priority placement in Team Finder search", included: true },
      { label: "Profile banner customization", included: true },
    ],
  },
};

function formatPrice(plan) {
  const price = Number(plan.price);
  if (price === 0) return { amount: "Free", suffix: "" };
  return {
    amount: `₹${price.toLocaleString("en-IN")}`,
    suffix: `/${plan.billing_cycle === "annual" ? "yr" : "mo"}`,
  };
}

// ─── TierCard ───────────────────────────────────────────────────────────────
// Collapsed: name, price, tagline. Click anywhere on the card to expand the
// full feature breakdown in place. The CTA is supplied by the caller since
// it differs (checkout in the dashboard vs. a link to the dashboard here).
export function TierCard({ plan, isCurrent, cta, contentMap = ORGANIZER_TIER_CONTENT }) {
  const [expanded, setExpanded] = useState(false);
  const content = contentMap[plan.plan_key] || {};
  const { amount, suffix } = formatPrice(plan);
  const highlight = !!content.highlight;

  return (
    <div
      className={`relative rounded-2xl p-6 transition-all duration-300 cursor-pointer ${
        highlight
          ? "border-2 border-red bg-gradient-to-b from-red/10 to-transparent glow-red"
          : "card-hover border border-surface-border"
      }`}
      style={!highlight ? { background: "var(--bg-card)" } : undefined}
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }}
    >
      {content.badge && (
        <div className="absolute -top-3 left-6 badge-red">
          ⭐ {content.badge}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl mb-1">{content.icon}</div>
          <div className="font-display font-bold text-lg text-white">{plan.name}</div>
          <p className="text-xs text-gray-500 mt-1 max-w-[220px]">{content.tagline}</p>
        </div>
        {isCurrent && <span className="badge-green shrink-0">Current</span>}
      </div>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-3xl font-display font-bold text-white">{amount}</span>
        {suffix && <span className="text-sm text-gray-500 font-medium">{suffix}</span>}
      </div>

      <button
        className="text-xs text-gray-500 mt-3 flex items-center gap-1 hover:text-gray-300 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
      >
        <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>›</span>
        {expanded ? "Hide details" : "See what's included"}
      </button>

      <div
        className={`grid transition-all duration-300 ease-out ${
          expanded ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0 mt-0"
        }`}
        style={{ display: "grid" }}
      >
        <div className="overflow-hidden">
          <ul className="space-y-2 pb-1">
            {(content.features || []).map((f) => (
              <li key={f.label} className="flex items-start gap-2 text-sm">
                <span className={f.included ? "text-green-400" : "text-gray-600"}>
                  {f.included ? "✓" : "—"}
                </span>
                <span className={f.included ? "text-gray-300" : "text-gray-600 line-through"}>
                  {f.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5" onClick={(e) => e.stopPropagation()}>
        {cta}
      </div>
    </div>
  );
}

// ─── PlansModal ─────────────────────────────────────────────────────────────
// Shared checkout picker: renders a grid of TierCards for whatever `plans`
// array the caller passes (organizer tiers or gamer tiers — same shape from
// `getPlans(category)`), and defers the actual checkout to `onSelect`.
// Originally lived only in OrganizerDashboard.jsx; pulled out here so the
// Profile page's ArenaX Pro upgrade flow (§4) can reuse the exact same
// picker instead of a second hand-rolled modal.
export function PlansModal({ plans, current, onClose, onSelect, contentMap }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display font-bold text-lg text-white">Choose a plan</h3>
            <p className="text-xs text-gray-500 mt-0.5">Tap a card to see what's included.</p>
          </div>
          <button className="btn-ghost text-sm" onClick={onClose}>Close</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {plans.map((p) => {
            const isCurrent = p.plan_key === current;
            return (
              <TierCard
                key={p.plan_id}
                plan={p}
                isCurrent={isCurrent}
                contentMap={contentMap}
                cta={
                  <button
                    className="btn-primary w-full text-sm"
                    disabled={isCurrent || Number(p.price) === 0}
                    onClick={() => onSelect(p)}
                  >
                    {isCurrent ? "Current Plan" : Number(p.price) === 0 ? "Free" : "Select"}
                  </button>
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── OrganizerTierSection ──────────────────────────────────────────────────
// Self-contained promo block for use on The Arena page (or anywhere else):
// fetches the two organizer plans and, if signed in, the viewer's current
// subscription, then renders the tier grid with a CTA into the Organizer
// Dashboard. Renders nothing if the plans fail to load, so a payments-infra
// hiccup never breaks the tournament browsing page around it.
export function OrganizerTierSection() {
  const { isAuthenticated } = useAuth();
  const [plans, setPlans] = useState([]);
  const [currentPlanKey, setCurrentPlanKey] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPlans("organizer")
      .then((res) => {
        if (!cancelled) setPlans(res.data.plans || []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));

    if (isAuthenticated) {
      getMySubscription()
        .then((res) => {
          if (!cancelled) setCurrentPlanKey(res.data.subscription?.plan_key || "organizer_free");
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (!loaded || plans.length === 0) return null;

  const isPro = currentPlanKey === "organizer_pro";

  return (
    <section className="relative mb-10 rounded-2xl overflow-hidden border border-surface-border">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 0% 0%, rgba(255,70,85,0.08) 0%, transparent 60%)",
        }}
      />
      <div className="relative z-10 px-6 sm:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-red/10 border border-red/20 rounded-full px-3 py-1 mb-3">
              <span className="text-xs text-red-light font-semibold tracking-wider uppercase">
                For Organizers
              </span>
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
              Run bigger events with <span className="text-gradient">ArenaX Pro</span>
            </h2>
            <p className="text-gray-400 text-sm mt-2 max-w-lg">
              Branded pages, automated announcements, and real analytics — everything you need
              once your bracket outgrows the basics.
            </p>
          </div>
          {isAuthenticated && isPro && (
            <span className="badge-green shrink-0">⚡ You're on Pro</span>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl">
          {plans.map((p) => (
            <TierCard
              key={p.plan_id}
              plan={p}
              isCurrent={isAuthenticated && currentPlanKey === p.plan_key}
              cta={
                isAuthenticated ? (
                  currentPlanKey === p.plan_key ? (
                    <button className="btn-ghost w-full text-sm" disabled>
                      Current Plan
                    </button>
                  ) : (
                    <Link to="/organizer" className="btn-primary w-full text-sm justify-center">
                      {Number(p.price) === 0 ? "Switch to Free" : "Upgrade in Dashboard →"}
                    </Link>
                  )
                ) : (
                  <Link to="/login" className="btn-primary w-full text-sm justify-center">
                    Sign In to Get Started
                  </Link>
                )
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
