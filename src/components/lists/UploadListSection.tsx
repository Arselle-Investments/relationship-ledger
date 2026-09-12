"use client";

import { useRef, useState } from "react";
import { MailingListWithContacts } from "@/types/mailing-list";

export function UploadListSection({ onCreated }: { onCreated: (entry: MailingListWithContacts) => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ matched: number; totalRows: number; unmatchedCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    if (!name.trim()) {
      setError("Give this campaign a name first.");
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    form.append("name", name.trim());
    const res = await fetch("/api/lists/upload", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setResult({ matched: json.matched, totalRows: json.totalRows, unmatchedCount: json.unmatchedCount });
    onCreated({ list: json.list, contacts: json.contacts });
    setName("");
    setFile(null);
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Upload a mailing list</div>
      <div className="helptext" style={{ marginBottom: 12 }}>
        Upload a spreadsheet with an Email column (a Name column too, if you have one) to create a brand-new
        campaign from it. Each upload creates its own list — it never merges into an existing one, matched by
        email against contacts already on file.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Campaign name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="button" className="btn small" onClick={() => fileInputRef.current?.click()}>
          {file ? file.name : "Choose file…"}
        </button>
        <button type="button" className="btn small primary" onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>
      {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
      {result && (
        <div className="helptext" style={{ marginTop: 10 }}>
          Created — matched {result.matched} of {result.totalRows} row{result.totalRows === 1 ? "" : "s"} to existing
          contacts.
          {result.unmatchedCount > 0
            ? ` ${result.unmatchedCount} row${result.unmatchedCount === 1 ? "" : "s"} didn't match anyone on file.`
            : ""}
        </div>
      )}
    </div>
  );
}
