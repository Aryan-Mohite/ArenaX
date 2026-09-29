import { useEffect, useState } from "react";
import { listApiKeys, createApiKey, revokeApiKey } from "../services/organizerService";

// §2 Organization tier perk: read-only API key(s) for /api/v1/tournaments.
export default function ApiKeysPanel({ showToast }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null); // { secret, ... } shown once
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    listApiKeys()
      .then((r) => setKeys(r.data.keys))
      .catch((e) => showToast?.(e.response?.data?.message || "Couldn't load API keys", false))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async () => {
    setCreating(true);
    try {
      const { data } = await createApiKey("Default");
      setNewKey(data.key);
      load();
    } catch (e) {
      showToast?.(e.response?.data?.message || "Couldn't create key", false);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm("Revoke this key? Anything using it will stop working immediately.")) return;
    setBusyId(id);
    try {
      await revokeApiKey(id);
      load();
    } catch (e) {
      showToast?.(e.response?.data?.message || "Couldn't revoke key", false);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h3 className="font-display font-bold text-white">🔑 API Access</h3>
        <button className="btn-ghost text-xs px-3 py-1.5" onClick={create} disabled={creating}>
          {creating ? "Creating…" : "+ New key"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Read-only access to your own tournament data — <code>GET /api/v1/tournaments</code> and
        <code> /api/v1/tournaments/:id/registrations</code>, authenticated with an{" "}
        <code>X-API-Key</code> header.
      </p>

      {newKey && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
          <p className="text-xs text-yellow-400 font-semibold mb-1.5">
            Copy this now — it won't be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-white break-all bg-navy px-2 py-1.5 rounded">{newKey.secret}</code>
            <button
              className="btn-ghost text-xs px-2 py-1.5 shrink-0"
              onClick={() => { navigator.clipboard?.writeText(newKey.secret); showToast?.("Copied"); }}
            >
              Copy
            </button>
          </div>
          <button className="text-xs text-gray-500 hover:text-white mt-2" onClick={() => setNewKey(null)}>
            Done
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-gray-600">No API keys yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.key_id} className="flex items-center justify-between text-sm py-1.5 border-t border-surface-border first:border-t-0 first:pt-0">
              <div>
                <span className="text-white font-medium">{k.label}</span>{" "}
                <code className="text-gray-500">{k.key_prefix}…</code>
                {k.revoked_at && <span className="ml-2 text-xs text-red">revoked</span>}
              </div>
              {!k.revoked_at && (
                <button
                  className="text-xs text-gray-500 hover:text-red transition-colors"
                  disabled={busyId === k.key_id}
                  onClick={() => revoke(k.key_id)}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
