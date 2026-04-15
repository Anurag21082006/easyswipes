import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  Gift,
  Plus,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:3000";

// ─── Toast System ─────────────────────────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-80">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-xl border text-sm shadow-lg
            ${
              toast.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
          )}
          <span className="flex-1 leading-relaxed">{toast.message}</span>
          <button
            onClick={() => onRemove(toast.id)}
            className="text-current opacity-50 hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

/**
 * Parses error responses from the backend.
 * Tries to extract a human-readable message from the JSON body,
 * falling back to the HTTP status text.
 */
async function parseError(response) {
  try {
    const body = await response.json();
    return body?.message || body?.error || `Server error (${response.status})`;
  } catch {
    return `Server error (${response.status}: ${response.statusText})`;
  }
}

/**
 * GET /bounties/active
 * Returns array of: { bountyId, title, description, bountyAmount, status }
 */
async function fetchActiveBounties() {
  const response = await fetch(`${API_BASE}/bounties/active`);
  if (!response.ok) {
    const msg = await parseError(response);
    throw new Error(msg);
  }
  
  // 1. Get the JSON package from the backend
  const json = await response.json(); 
  
  // 2. Unbox it! Return ONLY the array inside the 'data' property
  return json.data || []; 
}

/**
 * POST /bounties
 * Uses FormData — required for file upload (multipart/form-data).
 * Do NOT set Content-Type manually; fetch sets it with the boundary automatically.
 *
 * Fields: mobile, title, description, bountyAmount, assignment (File)
 */
async function postBounty({ mobile, title, description, bountyAmount, assignment }) {
  const formData = new FormData();
  formData.append("mobile", mobile);
  formData.append("title", title);
  formData.append("description", description);
  formData.append("bountyAmount", bountyAmount);
  if (assignment) {
    formData.append("assignment", assignment); // raw File object
  }

  const response = await fetch(`${API_BASE}/bounties`, {
    method: "POST",
    headers: {
      "x-mobile": mobile // <-- ADD THIS LINE to bypass the locked body!
    },
    body: formData,
  });

  if (!response.ok) {
    const msg = await parseError(response);
    throw new Error(msg);
  }
  return response.json();
}

/**
 * PATCH /bounties/claim
 * Sends JSON body: { mobile, bountyId }
 * Returns the updated bounty object on success.
 */
async function claimBounty({ mobile, bountyId }) {
  const response = await fetch(`${API_BASE}/bounties/claim`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, bountyId }),
  });

  if (response.status === 409) {
    throw new Error(
      "This bounty was just claimed by someone else. Refresh to see updated listings."
    );
  }

  if (!response.ok) {
    const msg = await parseError(response);
    throw new Error(msg);
  }
  return response.json();
}

// ─── Claim Modal ──────────────────────────────────────────────────────────────
function ClaimModal({ bounty, onClose, onSuccess, addToast }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = name.trim() && mobile.trim().length >= 10 && consent && !loading;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      // POST the claim — backend only needs mobile + bountyId
      await claimBounty({ mobile: mobile.trim(), bountyId: bounty.bountyId });
      addToast(
        `Bounty claimed! You'll be contacted at ${mobile} for ₹${bounty.bountyAmount - 50}.`,
        "success"
      );
      onSuccess(bounty.bountyId); // remove from local state
      onClose();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-md border border-gray-100 p-6 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-1">
          <h2 className="text-base font-medium text-gray-900">Claim this bounty</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Enter your details to coordinate payment offline.
        </p>

        {/* Bounty preview */}
        <div className="bg-gray-50 rounded-xl p-3 mb-5 border border-gray-100">
          <p className="text-sm font-medium text-gray-800 leading-snug">{bounty.title}</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Reward:{" "}
            <span className="text-green-600 font-semibold">
              ₹{bounty.bountyAmount - 50}
            </span>
          </p>
        </div>

        {/* Fields */}
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">
              Mobile number
            </label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>
        </div>

        {/* Consent */}
        <label className="flex gap-3 items-start bg-indigo-50 border border-indigo-100 rounded-xl p-3 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 accent-indigo-600 w-4 h-4 shrink-0"
          />
          <span className="text-xs text-gray-600 leading-relaxed">
            I agree to use this mobile number for secure, offline payment coordination
            regarding this bounty.
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="flex-[2] bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium
              hover:bg-indigo-700 transition disabled:bg-indigo-200 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Confirming...
              </>
            ) : (
              "Confirm Claim"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bounty Card ──────────────────────────────────────────────────────────────
function BountyCard({ bounty, index, onClaim }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-3 hover:border-indigo-200 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full px-2.5 py-0.5 w-fit">
            ${bounty.bountyId}$
          </span>
          <span className="text-xs text-gray-400">Sr. {index + 1}</span>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-900 leading-snug">{bounty.title}</h3>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
          {bounty.description}
        </p>
      </div>
      <div className="flex items-center gap-1.5 mt-auto">
        <span className="text-xs text-gray-400">Payable:</span>
        <span className="text-lg font-semibold text-green-600">
          ₹{bounty.bountyAmount - 50}
        </span>
        <span className="text-xs text-gray-400">(after fee)</span>
      </div>
      <button
        onClick={() => onClaim(bounty)}
        className="w-full bg-green-50 border border-green-200 text-green-700 rounded-xl
          py-2.5 text-sm font-medium hover:bg-green-100 transition flex items-center
          justify-center gap-2"
      >
        <Gift className="w-3.5 h-3.5" />
        Claim Bounty
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BountyChain() {
  // ── Bounty board state
  const [bounties, setBounties] = useState([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState(null);

  // ── Post form state
  const [form, setForm] = useState({
    mobile: "",
    title: "",
    description: "",
    bountyAmount: "",
  });
  const [file, setFile] = useState(null);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef(null);

  // ── Claim modal state
  const [claimTarget, setClaimTarget] = useState(null);

  // ── Toast system
  const { toasts, addToast, removeToast } = useToast();

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. FETCH ACTIVE BOUNTIES — runs on mount and can be manually re-triggered
  // ─────────────────────────────────────────────────────────────────────────────
  const loadBounties = useCallback(async () => {
    setBoardLoading(true);
    setBoardError(null);
    try {
      const data = await fetchActiveBounties();
      setBounties(data);
    } catch (err) {
      setBoardError(err.message);
      addToast(`Failed to load bounties: ${err.message}`, "error");
    } finally {
      setBoardLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadBounties();
  }, [loadBounties]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. POST A NEW BOUNTY — FormData with file upload
  // ─────────────────────────────────────────────────────────────────────────────
  const handlePost = async () => {
    const { mobile, title, description, bountyAmount } = form;

    // Client-side validation
    if (!mobile.trim()) return addToast("Enter your mobile number.", "error");
    if (!title.trim()) return addToast("Enter a title.", "error");
    if (!description.trim()) return addToast("Enter a description.", "error");
    if (!bountyAmount || Number(bountyAmount) < 50)
      return addToast("Minimum bounty amount is ₹50.", "error");

    setPosting(true);
    try {
      await postBounty({
        mobile: mobile.trim(),
        title: title.trim(),
        description: description.trim(),
        bountyAmount: Number(bountyAmount),
        assignment: file, // File object or null
      });

      addToast("Bounty posted successfully!", "success");

      // Reset form
      setForm({ mobile: "", title: "", description: "", bountyAmount: "" });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Re-fetch the board so the new bounty appears
      await loadBounties();
    } catch (err) {
      addToast(`Failed to post bounty: ${err.message}`, "error");
    } finally {
      setPosting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. CLAIM CALLBACK — removes bounty from local state after success
  // ─────────────────────────────────────────────────────────────────────────────
  const handleClaimSuccess = useCallback((bountyId) => {
    // Optimistic removal: instantly remove from UI without re-fetching
    setBounties((prev) => prev.filter((b) => b.bountyId !== bountyId));
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <span className="text-xs font-semibold tracking-widest text-indigo-500 uppercase">
            Student Marketplace · Anonymous
          </span>
          <h1 className="text-3xl font-medium text-gray-900 mt-1 leading-tight">
            Drop an Assignment or<br />Claim a Bounty.
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Post work anonymously. Hunters claim, coordinate offline, get paid.
          </p>
        </div>

        {/* ── Post Bounty Form ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-10">
          <div className="flex items-center gap-2 mb-5 text-sm font-medium text-gray-800">
            <Plus className="w-4 h-4 text-indigo-500" />
            Post a bounty
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mobile */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Your mobile number <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                placeholder="+91 98765 43210 (used for payment coordination)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            {/* Title */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Data Structures Assignment — Heap Sort"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the task, deadline, and specific requirements..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-none"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Bounty amount (₹) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="50"
                value={form.bountyAmount}
                onChange={(e) => setForm((f) => ({ ...f, bountyAmount: e.target.value }))}
                placeholder="e.g. 500"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">
                Upload assignment file
              </label>
              <div
                className="border-2 border-dashed border-indigo-200 rounded-xl p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-indigo-50 transition"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-medium text-indigo-600">
                  {file ? file.name : "Click to upload"}
                </span>
                <span className="text-xs text-gray-400">PDF, DOCX, ZIP up to 20MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.zip"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handlePost}
            disabled={posting}
            className="mt-5 w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-medium
              hover:bg-indigo-700 transition disabled:bg-indigo-300 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {posting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Posting...
              </>
            ) : (
              "Post Bounty"
            )}
          </button>
        </div>

        {/* ── Bounty Feed ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-medium text-gray-900">Active bounties</h2>
          <span className="bg-indigo-50 text-indigo-600 text-xs font-medium rounded-full px-2.5 py-0.5">
            {bounties.length} open
          </span>
          <button
            onClick={loadBounties}
            className="ml-auto text-gray-400 hover:text-indigo-500 transition"
            title="Refresh bounties"
          >
            <RefreshCw className={`w-4 h-4 ${boardLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {boardLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading bounties...
          </div>
        ) : boardError ? (
          <div className="text-center py-16">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{boardError}</p>
            <button
              onClick={loadBounties}
              className="mt-3 text-indigo-600 text-sm font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        ) : bounties.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No active bounties. Be the first to post!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bounties.map((b, i) => (
              <BountyCard
                key={b.bountyId}
                bounty={b}
                index={i}
                onClaim={setClaimTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Claim Modal ────────────────────────────────────────────────────── */}
      {claimTarget && (
        <ClaimModal
          bounty={claimTarget}
          onClose={() => setClaimTarget(null)}
          onSuccess={handleClaimSuccess}
          addToast={addToast}
        />
      )}

      {/* ── Toast Container ────────────────────────────────────────────────── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
