"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VerifyAgoraModal } from "./VerifyAgoraModal";
import { ExportLogEntry, ExportLogTable } from "./ExportLogTable";

export function AgoraSyncClient({
  pendingCount,
  companyPendingCount,
  initialExportLogs,
  canEdit,
}: {
  pendingCount: number;
  companyPendingCount: number;
  initialExportLogs: ExportLogEntry[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [exportLogs, setExportLogs] = useState(initialExportLogs);
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

  async function refreshLogs() {
    const res = await fetch("/api/agora-export-log");
    if (res.ok) {
      const json = await res.json();
      setExportLogs(json.logs);
    }
  }

  async function downloadExport(url: string, filenamePrefix: string) {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false as const, error: json.error ?? "Something went wrong." };
    }
    const skippedNoEmail = Number(res.headers.get("X-Skipped-No-Email") ?? "0");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    return { ok: true as const, skippedNoEmail };
  }

  async function handleExport() {
    setExporting(true);
    setExportMsg(null);
    const url = exportDays ? `/api/contacts/export-new-for-agora?days=${exportDays}` : "/api/contacts/export-new-for-agora";
    const result = await downloadExport(url, "arselle-new-contacts-for-agora");
    setExporting(false);
    setExportMsg(
      result.ok
        ? `Exported and marked as sent to Agora.${
            result.skippedNoEmail ? ` ${result.skippedNoEmail} held back for missing/placeholder email — see Data Hygiene.` : ""
          }`
        : result.error
    );
    if (result.ok) {
      router.refresh();
      refreshLogs();
    }
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
    if (result.ok) {
      router.refresh();
      refreshLogs();
    }
  }

  async function handleChangesExport() {
    setChangesExporting(true);
    setChangesExportMsg(null);
    const result = await downloadExport("/api/contacts/export-changes-for-agora", "arselle-contact-changes-for-agora");
    setChangesExporting(false);
    setChangesExportMsg(result.ok ? "Exported. Re-run any time to pick up what's changed since." : result.error);
    if (result.ok) {
      router.refresh();
      refreshLogs();
    }
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
          Companies added here that haven&rsquo;t been sent to Agora yet. Agora has no bulk-import for
          Organizations &mdash; each one has to be created by hand there (CRM &rarr; Organizations &rarr; New
          Organization) with its contacts then linked to it. This download is a reference list for that manual
          work, not a file Agora can import; it still marks everything included as sent, so the next export only
          shows what&rsquo;s new since this one.
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
          For contacts already sent to Agora: organization, phone, city, notes, or tags edited here since the last
          time this ran. Downloads their full current record in Agora&rsquo;s own import template (matched by
          email), so it drops straight into their re-import flow.
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

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <h3 style={{ marginBottom: 6 }}>Export log</h3>
        <div className="helptext" style={{ marginBottom: 14 }}>
          Every Agora export actually downloaded from here, most recent first — who ran it, when, and how many
          records. Redownload hands back the exact file that was sent, for comparison, even if records have
          changed since.
        </div>
        <ExportLogTable logs={exportLogs} />
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
