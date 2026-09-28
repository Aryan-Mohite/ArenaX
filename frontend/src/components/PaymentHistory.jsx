import { useEffect, useState } from "react";
import { getMyPayments, disputePayment } from "../services/paymentService";

// §9: the user-facing half of the refund/dispute path — lists past payments
// and lets the user open a dispute (manual admin review, no auto-refund).
export default function PaymentHistory() {
  const [payments, setPayments] = useState(null);
  const [disputing, setDisputing] = useState(null); // payment being disputed
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () =>
    getMyPayments()
      .then((r) => setPayments(r.data.payments || []))
      .catch(() => setPayments([]));

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!reason.trim()) return setMsg("Please tell us what went wrong");
    setBusy(true);
    setMsg("");
    try {
      const r = await disputePayment(disputing.payment_id, reason.trim());
      setMsg(r.data.message);
      setDisputing(null);
      setReason("");
      load();
    } catch (e) {
      setMsg(e.response?.data?.message || "Couldn't submit your dispute");
    } finally {
      setBusy(false);
    }
  };

  if (payments === null || payments.length === 0) return null; // nothing to show yet

  const badge = (p) => {
    if (p.status === "refunded") return { t: "Refunded", c: "#22c55e" };
    if (p.dispute_status === "open") return { t: "Dispute open", c: "#eab308" };
    if (p.dispute_status === "denied") return { t: "Dispute denied", c: "#9ca3af" };
    return null;
  };

  return (
    <div className="card">
      <h3 className="font-display font-bold text-white mb-1">Payment history</h3>
      <p className="text-xs text-gray-500 mb-4">
        Charged something you didn't expect? Open a dispute and an admin will review it.
      </p>
      {msg && <p className="text-sm text-gray-300 mb-3">{msg}</p>}
      <div className="divide-y divide-surface-border/50">
        {payments.map((p) => {
          const b = badge(p);
          const canDispute = p.status === "success" && p.dispute_status !== "open";
          return (
            <div key={p.payment_id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{p.plan_name || "Payment"}</p>
                <p className="text-xs text-gray-500">
                  {new Date(p.created_at).toLocaleDateString("en-IN")} · ₹{Number(p.amount).toLocaleString("en-IN")}
                </p>
              </div>
              {b && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: b.c + "22", color: b.c }}>{b.t}</span>
              )}
              {canDispute && (
                <button className="btn-ghost text-xs" onClick={() => { setDisputing(p); setMsg(""); }}>
                  Dispute
                </button>
              )}
            </div>
          );
        })}
      </div>

      {disputing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <h3 className="font-display font-bold text-lg text-white mb-1">Dispute payment</h3>
            <p className="text-xs text-gray-500 mb-3">
              {disputing.plan_name} · ₹{Number(disputing.amount).toLocaleString("en-IN")}
            </p>
            <textarea className="input w-full h-28" maxLength={1000} placeholder="What went wrong?"
              value={reason} onChange={(e) => setReason(e.target.value)} />
            {msg && <p className="text-sm text-red mt-2">{msg}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-ghost text-sm" onClick={() => { setDisputing(null); setMsg(""); }}>Cancel</button>
              <button className="btn-primary text-sm" disabled={busy} onClick={submit}>
                {busy ? "Submitting…" : "Submit dispute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
