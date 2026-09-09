"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VerifyAgoraModal } from "./VerifyAgoraModal";

export function ContactImportSection() {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [agoraImporting, setAgoraImporting] = useState(false);
  const [agoraImportMsg, setAgoraImportMsg] = useState<string | null>(null);
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agoraFileInputRef = useRef<HTMLInputElement>(null);
  const verifyFileInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/contacts/import", { method: "POST", body: form });
    const json = await res.json();
    setImporting(false);
    if (!res.ok) {
      setImportMsg(json.error ?? "Import failed.");
      return;
    }
    setImportMsg(`Imported: ${json.added} added, ${json.updated} updated, ${json.skipped} skipped.`);
    router.refresh();
  }

  async function handleAgoraImportFile(file: File) {
    setAgoraImporting(true);
    setAgoraImportMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/contacts/import-agora", { method: "POST", body: form });
    const json = await res.json();
    setAgoraImporting(false);
    if (!res.ok) {
      setAgoraImportMsg(json.error ?? "Import failed.");
      return;
    }
    setAgoraImportMsg(
      `Agora sync: ${json.created} new contact${json.created === 1 ? "" : "s"} added, ${json.updated} refreshed${json.skipped ? `, ${json.skipped} rows skipped` : ""}.`
    );
    router.refresh();
  }

  return (
    <div className="card" style={{ padding: 22, maxWidth: 640, marginBottom: 20 }}>
      <h3 style={{ marginBottom: 6 }}>Import contacts</h3>
      <div className="helptext" style={{ marginBottom: 14 }}>
        &ldquo;Import&rdquo; adds/updates contacts from a plain spreadsheet. &ldquo;Import from Agora&rdquo; is the
        everyday sync from an Agora export — it only adds new contacts and refreshes Agora-owned fields on existing
        ones, and never deletes. &ldquo;Verify against Agora&rdquo; is for after you&rsquo;ve fixed something in
        Agora itself (a missing org, a placeholder email, etc.) — it compares organization, phone, city, and notes
        against the file and lets you review and apply just the differences, one field at a time. For a full
        re-baseline instead, see &ldquo;Replace all contacts from Agora&rdquo; below.
      </div>

      {importMsg && <div className="helptext" style={{ marginBottom: 10 }}>{importMsg}</div>}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportFile(file);
          e.target.value = "";
        }}
      />
      <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={importing} style={{ marginBottom: 14 }}>
        {importing ? "Importing…" : "Import"}
      </button>

      {agoraImportMsg && <div className="helptext" style={{ marginBottom: 10 }}>{agoraImportMsg}</div>}
      <input
        ref={agoraFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAgoraImportFile(file);
          e.target.value = "";
        }}
      />
      <div style={{ marginBottom: 14 }}>
        <button className="btn" onClick={() => agoraFileInputRef.current?.click()} disabled={agoraImporting}>
          {agoraImporting ? "Syncing…" : "Import from Agora"}
        </button>
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
      <div>
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
