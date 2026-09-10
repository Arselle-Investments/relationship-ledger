"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VerifyAgoraModal } from "./VerifyAgoraModal";

export function AgoraSyncClient({ pendingCount, canEdit }: { pendingCount: number; canEdit: boolean }) {
  const router = useRouter();
  const [exportDays, setExportDays] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const verifyFileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    setExportMsg(null);
    const url = exportDays ? `/api/contacts/export-new-for-agora?days=${exportDays}` : "/api/contacts/export-new-for-agora";
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setExporting(false);
      setExportMsg(json.error ?? "Something went wrong.");
      return;
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `arselle-new-contacts-for-agora-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    setExporting(false);
    setExportMsg("Exported and marked as sent to Agora.");
    router.refresh();
  }

  if (!canEdit) {
    return (
      <div className="empty">
        <h3>View-only</h3>
        <div>An editor can export new contacts to Agora or verify against a fresh Agora export.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ padding: 20, maxWidth: 640, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 6 }}>Export new contacts for Agora</h3>
        <div className="helptext" style={{ marginBottom: 14 }}>
          Contacts added here (manually, or confirmed from Data Quality &rarr; New Contacts) that haven&rsquo;t been
          sent to Agora yet. Downloads a spreadsheet formatted for Agora import and marks everything included as
          exported, so the next export only picks up what&rsquo;s new since this one.
        </div>
        {pendingCount === 0 ? (
          <div className="empty">
            <h3>Nothing pending</h3>
            <div>Every contact on file has already been exported to Agora.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <select value={exportDays} onChange={(e) => setExportDays(e.target.value)}>
                <option value="">All pending ({pendingCount})</option>
                <option value="15">Added in last 15 days</option>
                <option value="30">Added in last 30 days</option>
              </select>
              <button className="btn primary" onClick={handleExport} disabled={exporting}>
                {exporting ? "Exporting…" : "Export new for Agora"}
              </button>
            </div>
            {exportMsg && <div className="helptext">{exportMsg}</div>}
          </>
        )}
      </div>

      <div className="card" style={{ padding: 20, maxWidth: 640 }}>
        <h3 style={{ marginBottom: 6 }}>Compare against Agora</h3>
        <div className="helptext" style={{ marginBottom: 14 }}>
          After fixing something in Agora itself (a missing org, a placeholder email, etc.), upload a fresh export
          here to compare organization, phone, city, and notes against what&rsquo;s on file, then review and apply
          just the differences, one field at a time. Nothing changes until you choose to apply it.
        </div>
        <input
          ref={verifyFileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setVerifyFile(file);
            e.target.value = "";
          }}
        />
        <button className="btn" onClick={() => verifyFileInputRef.current?.click()}>
          Verify against Agora
        </button>
      </div>

      {verifyFile && (
        <VerifyAgoraModal
          file={verifyFile}
          onClose={() => {
            setVerifyFile(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
