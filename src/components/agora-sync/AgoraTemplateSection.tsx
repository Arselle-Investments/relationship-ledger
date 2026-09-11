"use client";

import { useRef, useState } from "react";

export function AgoraTemplateSection({
  initialHeaders,
  initialIsCustom,
  initialNewHeaders,
}: {
  initialHeaders: string[];
  initialIsCustom: boolean;
  initialNewHeaders: string[];
}) {
  const [headers, setHeaders] = useState(initialHeaders);
  const [isCustom, setIsCustom] = useState(initialIsCustom);
  const [newHeaders, setNewHeaders] = useState(initialNewHeaders);
  const [droppedHeaders, setDroppedHeaders] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    setMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/settings/agora-template", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(json.error ?? "Something went wrong.");
      return;
    }
    setHeaders(json.headers);
    setIsCustom(true);
    setNewHeaders(json.newHeaders ?? []);
    setDroppedHeaders(json.droppedHeaders ?? []);
    setMsg(`Template updated — ${json.headers.length} columns.`);
  }

  async function handleReset() {
    setResetting(true);
    setError(null);
    setMsg(null);
    const res = await fetch("/api/settings/agora-template", { method: "DELETE" });
    setResetting(false);
    if (!res.ok) {
      setError("Something went wrong.");
      return;
    }
    setIsCustom(false);
    setNewHeaders([]);
    setDroppedHeaders([]);
    setMsg("Reset to the built-in default template.");
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 640, marginBottom: 20 }}>
      <h3 style={{ marginBottom: 6 }}>Agora export template</h3>
      <div className="helptext" style={{ marginBottom: 14 }}>
        Every contact export above is built from this column list. When Agora adds or renames a custom field,
        upload their latest template file here — every export immediately picks up the new column layout, no
        code change or deploy needed. A brand-new column shows up in the file right away; it's just sent blank
        until someone maps it to a real value here in the Ledger.
      </div>

      <div style={{ fontSize: 12.5, marginBottom: 10 }}>
        Currently using: <b>{isCustom ? "a revised template" : "the built-in default"}</b> ({headers.length} columns)
      </div>

      {newHeaders.length > 0 && (
        <div className="helptext" style={{ background: "var(--brass-bg, #f3ecde)", padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>
          <b>{newHeaders.length} column{newHeaders.length === 1 ? "" : "s"} not yet mapped</b> — sent blank on every
          row until someone wires up a value source: {newHeaders.join(", ")}
        </div>
      )}
      {droppedHeaders.length > 0 && (
        <div className="helptext" style={{ marginBottom: 10 }}>
          {droppedHeaders.length} column{droppedHeaders.length === 1 ? "" : "s"} from the default template aren&rsquo;t
          in this revised one, so they&rsquo;re no longer exported: {droppedHeaders.join(", ")}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? "Reading…" : "Upload revised template"}
        </button>
        {isCustom && (
          <button className="btn small ghost" onClick={handleReset} disabled={resetting}>
            {resetting ? "Resetting…" : "Reset to default"}
          </button>
        )}
      </div>
      {msg && <div className="helptext" style={{ marginTop: 10 }}>{msg}</div>}
      {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
