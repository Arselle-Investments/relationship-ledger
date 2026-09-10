"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VerifyAgoraModal } from "./VerifyAgoraModal";

export function AgoraSyncClient({
  pendingCount,
  companyPendingCount,
  canEdit,
}: {
  pendingCount: number;
  companyPendingCount: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [exportDays, setExportDays] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [companyExportDays, setCompanyExportDays] = useState("");
  const [companyExporting, setCompanyExporting] = useState(false);
  const [companyExportMsg, setCompanyExportMsg] = useState<string | null>(null);
  const [changesExporting, setChangesExporting] = useState(false);
  const [changesExportMsg, setChangesExportMsg] = useState<string | null>(null);
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const verifyFileInputRef = useRef<HTMLInputElement>(null);

  async function downloadExport(url: string, filenamePrefix: string) {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false as const, error: json.error ?? "Something went wrong." };
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    return { ok: true as const };
  }

  async function handleExport() {
    setExporting(true);
    setExportMsg(null);
    const url = exportDays ? `/api/contacts/export-new-for-agora?days=${exportDays}` : "/api/contacts/export-new-for-agora";
    const result = await downloadExport(url, "arselle-new-contacts-for-agora");
    setExporting(false);
    setExportMsg(result.ok ? "Exported and marked as sent to Agora." : result.error);
    if (result.ok) router.refresh();
  }

  async function handleCompanyExport() {
    setCompanyExporting(true);
    setCompanyExportMsg(null);
    const url = companyExportDays
      ? `/api/companies/export-new-for-agora?days=${companyExportDays}`
      : "/api/companies/export-new-for-agora";
    const result = await downloadExport(url, "arselle-new-companies-for-agora");
    setCompanyExporting(false);
    setCompanyExportMsg(result.ok ? "Exported and marked as sent to Agora." : result.error);
    if (result.ok) router.refresh();
  }

  async function handleChangesExport() {
    setChangesExporting(true);
    setChangesExportMsg(null);
    const result = await downloadExport("/api/contacts/export-changes-for-agora", "arselle-contact-changes-for-agora");
    setChangesExporting(false);
    setChangesExportMsg(result.ok ? "Exported. Re-run any time to pick up what's changed since." : result.error);
    if (result.ok) router.refresh();
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

      <div className="card" style={{ padding: 20, maxWidth: 640, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 6 }}>Export new companies for Agora</h3>
        <div className="helptext" style={{ marginBottom: 14 }}>
          Companies added here that haven&rsquo;t been sent to Agora yet. Downloads a spreadsheet formatted for Agora
          import and marks everything included as exported, so the next export only picks up what&rsquo;s new since
          this one.
        </div>
        {companyPendingCount === 0 ? (
          <div className="empty">
            <h3>Nothing pending</h3>
            <div>Every company on file has already been exported to Agora.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <select value={companyExportDays} onChange={(e) => setCompanyExportDays(e.target.value)}>
                <option value="">All pending ({companyPendingCount})</option>
                <option value="15">Added in last 15 days</option>
                <option value="30">Added in last 30 days</option>
              </select>
              <button className="btn primary" onClick={handleCompanyExport} disabled={companyExporting}>
                {companyExporting ? "Exporting…" : "Export new for Agora"}
              </button>
            </div>
            {companyExportMsg && <div className="helptext">{companyExportMsg}</div>}
          </>
        )}
      </div>

      <div className="card" style={{ padding: 20, maxWidth: 640, marginBottom: 20 }}>
        <h3 style={{ marginBottom: 6 }}>Export contact changes for Agora</h3>
        <div className="helptext" style={{ marginBottom: 14 }}>
          For contacts already sent to Agora: organization, phone, city, or notes edited here since the last time
          this ran. Downloads a spreadsheet of just what changed, so Agora can be updated to match.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <button className="btn primary" onClick={handleChangesExport} disabled={changesExporting}>
            {changesExporting ? "Exporting…" : "Export changes for Agora"}
          </button>
        </div>
        {changesExportMsg && <div className="helptext">{changesExportMsg}</div>}
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
