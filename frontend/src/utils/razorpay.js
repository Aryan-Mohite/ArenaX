// Loads Razorpay's checkout script once and caches the promise so repeated
// upgrade clicks (from any checkout screen — organizer tiers, gamer ArenaX
// Pro, future college licenses) don't re-inject the <script> tag.
// Extracted from OrganizerDashboard.jsx so every checkout entry point shares
// one loader instead of each re-declaring the same module-level promise.
let razorpayScriptPromise = null;

export function loadRazorpayScript() {
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
