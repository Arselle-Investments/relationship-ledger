"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AgoraReplaceSection() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setMsg(null);
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/contacts/import-agora-replace-all", { method: "POST", body: form });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setConfirmText("");
    setMsg(
      `Replaced the roster with ${json.imported} contacts from Agora${json.skipped ? ` (${json.skipped} rows skipped)` : ""}${json.listsCleared ? ` — ${json.listsCleared} mailing list(s) were cleared` : ""}.`
    );
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640, marginBottom: 20 }}>
      <h3 style={{ marginBottom: 6 }}>Replace all contacts from Agora</h3>
      <div className="helptext" style={{ marginBottom: 14 }}>
        Deletes every contact and recreates the roster from a fresh Agora export — including anything local-only,
        like a contact confirmed from a Teams message that hasn&rsquo;t been pushed back to Agora yet, or notes/tags
        added here. Meant for a full re-baseline, not routine updates — for a handful of new entries, use
        &ldquo;Import from Agora&rdquo; on the Contacts page instead, which only adds/refreshes and never deletes.
      </div>
      <div className="field">
        <label>Type REPLACE to confirm</label>
        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} style={{ maxWidth: 200 }} />
      </div>
      {error && <div className="error-text" style={{ marginBottom: 10 }}>{error}</div>}
      {msg && <div className="helptext" style={{ marginBottom: 10 }}>{msg}</div>}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        className="btn-danger btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={confirmText !== "REPLACE" || busy}
      >
        {busy ? "Replacing…" : "Choose file and replace all"}
      </button>
    </div>
  );
}
