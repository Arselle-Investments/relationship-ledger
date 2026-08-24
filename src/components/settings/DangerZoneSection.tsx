"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DangerZoneSection() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: confirmText }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setConfirmText("");
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640 }}>
      <h3 style={{ marginBottom: 6 }}>Danger zone</h3>
      <div className="helptext" style={{ marginBottom: 14 }}>
        Permanently deletes every contact, task, mailing list, and event — useful for wiping test data before real
        onboarding. Team accounts and roles are not affected.
      </div>
      <div className="field">
        <label>Type RESET to confirm</label>
        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} style={{ maxWidth: 200 }} />
      </div>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
      <button className="btn-danger btn" onClick={handleReset} disabled={confirmText !== "RESET" || busy}>
        {busy ? "Clearing…" : "Clear all data"}
      </button>
    </div>
  );
}
