"use client";

import { useRef, useState } from "react";
import { CapitalSource, Consultant, Contact, FundraisingStage, Correspondence } from "@prisma/client";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";

const STATUS_OPTIONS = Object.values(FundraisingStage);

function EmlImportSection({ canEdit }: { canEdit: boolean }) {
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setImporting(true);
    setMsg(null);
    setError(null);
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    const res = await fetch("/api/correspondence/import-eml", { method: "POST", body: form });
    const json = await res.json();
    setImporting(false);
    if (!res.ok) {
      setError(json.error ?? "Import failed.");
      return;
    }
    setMsg(
      `Processed ${files.length} file${files.length === 1 ? "" : "s"}: ${json.matched} matched to existing contacts, ${json.suggested} suggested as new, ${json.duplicates} already imported${json.failed.length ? `, ${json.failed.length} failed to parse` : ""}.`
    );
    window.location.reload();
  }

  if (!canEdit) return null;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>Import historical emails</div>
          <div className="helptext" style={{ marginTop: 2 }}>
            Upload saved .eml files from before the Teams channel was connected. Each one runs through the same
            contact-matching pipeline as a live message.
          </div>
        </div>
        <div className="spacer" />
        <input
          ref={fileInputRef}
          type="file"
          accept=".eml"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          {importing ? "Importing…" : "Upload .eml files"}
        </button>
      </div>
      {msg && <div className="helptext" style={{ marginTop: 10 }}>{msg}</div>}
      {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}

type CorrespondenceWithContact = Correspondence & {
  contact: Contact | null;
  consultant: Consultant | null;
  capitalSource: CapitalSource | null;
};

function linkedEntityLabel(item: CorrespondenceWithContact): string {
  if (item.contact) return item.contact.name;
  if (item.consultant) return `${item.consultant.name} (Consultant)`;
  if (item.capitalSource) return `${item.capitalSource.name} (Capital Source)`;
  return "Unknown";
}

function StageSuggestionCard({
  item,
  canEdit,
  selected,
  onToggleSelect,
  statusChoice,
  onStatusChoiceChange,
  onResolved,
}: {
  item: CorrespondenceWithContact;
  canEdit: boolean;
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  statusChoice: FundraisingStage;
  onStatusChoiceChange: (status: FundraisingStage) => void;
  onResolved: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const overridden = item.suggestedStatus !== null && statusChoice !== item.suggestedStatus;

  async function confirm() {
    setBusy(true);
    const res = await fetch(`/api/correspondence/${item.id}/confirm-suggestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusChoice }),
    });
    setBusy(false);
    if (res.ok) onResolved(item.id);
  }

  async function dismiss() {
    setBusy(true);
    const res = await fetch(`/api/correspondence/${item.id}/dismiss-suggestion`, { method: "POST" });
    setBusy(false);
    if (res.ok) onResolved(item.id);
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {canEdit && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggleSelect(e.target.checked)}
              style={{ marginTop: 3 }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{linkedEntityLabel(item)}</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              {item.subject || "(no subject)"} &middot; {new Date(item.receivedAt).toLocaleString()}
            </div>
          </div>
        </div>
        <span className="tag brass">stage suggestion</span>
      </div>
      {item.suggestedStatus && (
        <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--forest-bg)", borderRadius: 6, fontSize: 12.5 }}>
          AI suggests <strong>{FUNDRAISING_STAGE_LABELS[item.suggestedStatus]}</strong>
          {item.suggestionRationale ? `: ${item.suggestionRationale}` : ""}
        </div>
      )}
      {canEdit ? (
        <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={statusChoice}
            onChange={(e) => onStatusChoiceChange(e.target.value as FundraisingStage)}
            style={{ fontSize: 12.5 }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {FUNDRAISING_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <button className="btn small primary" onClick={confirm} disabled={busy}>
            {overridden ? `Confirm as ${FUNDRAISING_STAGE_LABELS[statusChoice]}` : "Confirm"}
          </button>
          <button className="btn small ghost" onClick={dismiss} disabled={busy}>
            Dismiss
          </button>
        </div>
      ) : (
        <div className="helptext" style={{ marginTop: 10 }}>
          View-only. An editor needs to resolve this.
        </div>
      )}
    </div>
  );
}

export function InboxClient({
  initialPendingStageChanges,
  canEdit,
}: {
  initialPendingStageChanges: CorrespondenceWithContact[];
  canEdit: boolean;
}) {
  const [stageSuggestions, setStageSuggestions] = useState(initialPendingStageChanges);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusChoices, setStatusChoices] = useState<Record<string, FundraisingStage>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  function resolveStageSuggestion(id: string) {
    setStageSuggestions((prev) => prev.filter((i) => i.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function statusChoiceFor(item: CorrespondenceWithContact): FundraisingStage {
    return statusChoices[item.id] ?? item.suggestedStatus ?? FundraisingStage.NOT_STARTED;
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(stageSuggestions.map((i) => i.id)) : new Set());
  }

  async function confirmSelected() {
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const item = stageSuggestions.find((i) => i.id === id);
      if (!item) continue;
      const res = await fetch(`/api/correspondence/${id}/confirm-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusChoiceFor(item) }),
      });
      if (res.ok) resolveStageSuggestion(id);
    }
    setBulkBusy(false);
  }

  async function dismissSelected() {
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const res = await fetch(`/api/correspondence/${id}/dismiss-suggestion`, { method: "POST" });
      if (res.ok) resolveStageSuggestion(id);
    }
    setBulkBusy(false);
  }

  return (
    <div>
      <EmlImportSection canEdit={canEdit} />

      <div className="stat-row" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="num">{stageSuggestions.length}</div>
          <div className="label">Pending stage suggestions</div>
        </div>
      </div>

      <h3 style={{ marginBottom: 10 }}>Suggested stage changes</h3>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Correspondence that looks like it signals a pipeline move. Review before anything on the contact changes
      </div>
      {stageSuggestions.length === 0 ? (
        <div className="empty">
          <h3>Nothing pending</h3>
          <div>No AI-suggested stage changes waiting on review.</div>
        </div>
      ) : (
        <div>
          {canEdit && (
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === stageSuggestions.length}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
                Select all
              </label>
              <div className="spacer" />
              <div className="muted" style={{ fontSize: 12.5 }}>
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : ""}
              </div>
              <button className="btn small primary" onClick={confirmSelected} disabled={selectedIds.size === 0 || bulkBusy}>
                {bulkBusy ? "Working…" : "Confirm selected"}
              </button>
              <button className="btn small ghost" onClick={dismissSelected} disabled={selectedIds.size === 0 || bulkBusy}>
                Dismiss selected
              </button>
            </div>
          )}
          {stageSuggestions.map((item) => (
            <StageSuggestionCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              selected={selectedIds.has(item.id)}
              onToggleSelect={(checked) => toggleSelect(item.id, checked)}
              statusChoice={statusChoiceFor(item)}
              onStatusChoiceChange={(status) => setStatusChoices((prev) => ({ ...prev, [item.id]: status }))}
              onResolved={resolveStageSuggestion}
            />
          ))}
        </div>
      )}
    </div>
  );
}
