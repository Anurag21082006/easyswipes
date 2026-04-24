// AdminDashboard.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
const API_BASE = "http://localhost:3000/api/admin";

// ── tiny helpers ────────────────────────────────────────────────────────────
const fmt = (n) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function MetricCard({ label, value, pip }) {
  const pips = { total: "bg-stone-400", open: "bg-emerald-500", claimed: "bg-blue-500" };
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl p-4 relative overflow-hidden">
      <span className={`absolute top-3.5 right-3.5 w-2 h-2 rounded-full ${pips[pip]}`} />
      <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-medium mb-1.5">{label}</p>
      <p className="text-3xl font-semibold font-mono text-zinc-900 dark:text-zinc-50 leading-none">{value ?? "—"}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return status === "OPEN" ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />claimed
    </span>
  );
}

function HunterCell({ bounty }) {
  // Try to use mobile first
  if (bounty.hunterMobile) {
    return (
      <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">
        {bounty.hunterMobile}
      </span>
    );
  }

  // Fallback to hunterToken if claimed but mobile isn't present
  if (bounty.status === 'CLAIMED' || bounty.claimedBy?.hunterToken) {
    return (
      <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">
        {bounty.claimedBy?.hunterToken || 'N/A'}
      </span>
    );
  }

  // Otherwise, show the gray "awaiting" badge
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-500 border border-stone-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400 flex-shrink-0" />awaiting
    </span>
  );
}

// ── main component ──────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState(sessionStorage.getItem("adminKey") || "");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [bounties, setBounties] = useState([]);
  const [meta, setMeta] = useState({ total: 0, open: 0, claimed: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [deleting, setDeleting] = useState(new Set());
  const [toast, setToast] = useState(null);

  // ── fetch all bounties ────────────────────────────────────────────────────
  const fetchBounties = useCallback(async (key = adminKey) => {
    if (!key) return; // Wait for login
    setLoading(true);
    setError(null);
    setLoginError("");
    try {
      const res = await fetch(`${API_BASE}/bounties`, {
        headers: { "x-admin-key": key },
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        sessionStorage.removeItem("adminKey");
        throw new Error("Invalid password");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { meta, bounties } = await res.json();
      setBounties(bounties);
      setMeta(meta);
      setIsAuthenticated(true);
      sessionStorage.setItem("adminKey", key);
    } catch (e) {
      setError(e.message);
      if (e.message === "Invalid password") {
        setLoginError("Invalid admin password.");
      }
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (adminKey && !isAuthenticated) {
      fetchBounties(adminKey);
    }
  }, [adminKey, isAuthenticated, fetchBounties]);

  // ── login handler ─────────────────────────────────────────────────────────
  const handleLogin = (e) => {
    e.preventDefault();
    fetchBounties(adminKey);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminKey");
    setAdminKey("");
    setIsAuthenticated(false);
    setBounties([]);
  };

  // ── delete handler ────────────────────────────────────────────────────────
  const handleDelete = async (bountyId) => {
    if (!window.confirm(`Delete bounty ${bountyId}? This cannot be undone.`)) return;

    setDeleting(prev => new Set(prev).add(bountyId));
    try {
      const res = await fetch(`${API_BASE}/bounties/${bountyId}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setBounties(prev => prev.filter(b => b.bountyId !== bountyId));
      setMeta(prev => {
        const deleted = bounties.find(b => b.bountyId === bountyId);
        return {
          total: prev.total - 1,
          open: deleted?.status === "OPEN" ? prev.open - 1 : prev.open,
          claimed: deleted?.status === "CLAIMED" ? prev.claimed - 1 : prev.claimed
        };
      });
      showToast(`${bountyId} deleted`);
    } catch (e) {
      showToast(`Failed: ${e.message}`, true);
    } finally {
      setDeleting(prev => { const s = new Set(prev); s.delete(bountyId); return s; });
    }
  };

  // ── toast helper ──────────────────────────────────────────────────────────
  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2400);
  };

  // ── filtered + searched rows ──────────────────────────────────────────────
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bounties.filter(b => {
      const matchFilter = filter === "ALL" || b.status === filter;
      const matchSearch = !q || b.bountyId.toLowerCase().includes(q)
        || b.title.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [bounties, query, filter]);

  // ── render ────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center justify-center mb-6">
            <div className="w-10 h-10 bg-zinc-900 dark:bg-zinc-100 rounded-xl flex items-center justify-center shadow-inner">
              <svg className="w-5 h-5 stroke-zinc-100 dark:stroke-zinc-900" fill="none" viewBox="0 0 16 16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6V5a4 4 0 0 1 8 0v1m-9 0h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
              </svg>
            </div>
          </div>
          <div className="text-center mb-8">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-1">Admin Access</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Please enter your authorization key.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="••••••••••••"
                className="w-full h-11 px-4 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-zinc-900 transition-all font-mono tracking-widest text-center"
                autoFocus
              />
              {loginError && <p className="text-xs text-red-500 font-medium text-center mt-2">{loginError}</p>}
            </div>
            <button
              type="submit"
              disabled={loading || !adminKey}
              className="w-full h-11 px-4 text-sm font-medium bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 border border-transparent rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? "Verifying..." : "Authenticate"}
            </button>
          </form>
        </div>

        <p className="mt-8 text-xs font-mono text-zinc-400 dark:text-zinc-500">
          SECURE CONNECTION • RESTRICTED SYSTEM
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">

      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-zinc-900 dark:bg-zinc-100 rounded-md flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 stroke-zinc-100 dark:stroke-zinc-900" fill="none" viewBox="0 0 16 16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Bounty Chain</p>
            <p className="text-[10px] font-mono text-zinc-400 mt-0.5">admin console</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono font-medium px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
            restricted
          </span>
          <button onClick={handleLogout} className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <MetricCard label="Total bounties" value={meta.total} pip="total" />
          <MetricCard label="Open" value={meta.open} pip="open" />
          <MetricCard label="Claimed" value={meta.claimed} pip="claimed" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 stroke-zinc-400"
              fill="none" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by bounty ID or title…"
              className="w-full h-9 pl-8 pr-3 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors font-sans"
            />
          </div>
          <div className="flex gap-1.5">
            {["ALL", "OPEN", "CLAIMED"].map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 h-8 rounded-md border font-medium transition-all ${filter === f
                    ? "bg-zinc-900 text-zinc-50 border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100"
                    : "bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  }`}>
                {f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <button onClick={fetchBounties}
            className="h-8 px-3 text-xs border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            ↻ Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
          {error ? (
            <div className="p-8 text-center text-sm text-red-500">
              Failed to load: {error}
              <button onClick={fetchBounties} className="ml-2 underline">retry</button>
            </div>
          ) : loading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading bounties…</div>
          ) : (
            <>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/60">
                    {["Bounty", "Poster", "Hunter", "Reward", "Status", "Action"].map(h => (
                      <th key={h} className="text-left text-[10px] uppercase tracking-widest text-zinc-400 font-medium px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-zinc-400">No bounties match your search.</td></tr>
                  ) : rows.map((b, i) => (
                    <tr key={b.bountyId}
                      className={`border-b border-zinc-50 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${i === rows.length - 1 ? "border-b-0" : ""}`}>

                      {/* Bounty ID + Title */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="font-mono text-[11px] text-zinc-400 leading-none mb-1">{b.bountyId}</p>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate text-[13px]" title={b.title}>{b.title}</p>
                      </td>

                      {/* Poster mobile */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300">{b.posterMobile}</span>
                      </td>

                      {/* Hunter mobile or awaiting */}
                      <td className="px-4 py-3"><HunterCell bounty={b} /></td>

                      {/* Amount */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          ₹{fmt(b.bountyAmount)}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>

                      {/* Delete */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(b.bountyId)}
                          disabled={deleting.has(b.bountyId)}
                          className="text-[12px] font-medium px-3 py-1 rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95">
                          {deleting.has(b.bountyId) ? "…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer count */}
              <div className="px-4 py-2.5 text-[11px] font-mono text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 border-t border-zinc-100 dark:border-zinc-800">
                {rows.length} {rows.length === 1 ? "bounty" : "bounties"} shown
              </div>
            </>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 text-xs font-mono px-4 py-2.5 rounded-lg shadow-lg transition-all z-50 ${toast.isError
            ? "bg-red-600 text-white"
            : "bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}