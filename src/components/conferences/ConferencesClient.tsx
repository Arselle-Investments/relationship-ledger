"use client";

import { useMemo, useRef, useState } from "react";
import { Conference, User } from "@prisma/client";
import { quarterBounds, conferenceInQuarter } from "@/lib/conferences";
import { REGIONS, Region, inferRegion } from "@/lib/region";
import { ConferencesGrid } from "./ConferencesGrid";
import { ConferencesCalendar } from "./ConferencesCalendar";
import { ConferencesMap } from "./ConferencesMap";
import { ConferenceModal } from "./ConferenceModal";
import { BulkConferenceRefreshModal } from "./BulkConferenceRefreshModal";

export function ConferencesClient({
  initialConferences,
  team,
  canEdit,
  currentUserId,
}: {
  initialConferences: Conference[];
  team: User[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const [conferences, setConferences] = useState(initialConferences);
  const [viewMode, setViewMode] = useState<"cards" | "calendar" | "map">("cards");
  const [cardsFilter, setCardsFilter] = useState<"all" | "quarter">("all");
  const [exportPreset, setExportPreset] = useState<"all" | "quarter" | "year" | "confirmed">("all");
  const [icsPreset, setIcsPreset] = useState<"all" | "attending" | "select">("attending");
  const [icsPickerOpen, setIcsPickerOpen] = useState(false);
  const [icsSelectedIds, setIcsSelectedIds] = useState<Set<string>>(new Set());
  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");
  const [editing, setEditing] = useState<Conference | null | "new">(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [bulkRefreshOpen, setBulkRefreshOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attendeeNamesById = useMemo(() => new Map(team.map((u) => [u.id, u.name || u.email || ""])), [team]);

  const byRegion = useMemo(() => {
    if (regionFilter === "all") return conferences;
    return conferences.filter((ev) => inferRegion(ev.name, ev.location) === regionFilter);
  }, [conferences, regionFilter]);

  const filteredCards = useMemo(() => {
    if (cardsFilter !== "quarter") return byRegion;
    const bounds = quarterBounds(0);
    return byRegion.filter((ev) => conferenceInQuarter(ev, bounds));
  }, [byRegion, cardsFilter]);

  function upsertLocal(conference: Conference) {
    setConferences((prev) => {
      const exists = prev.some((e) => e.id === conference.id);
      return exists ? prev.map((e) => (e.id === conference.id ? conference : e)) : [...prev, conference];
    });
    setEditing(null);
    setAutoRefresh(false);
  }

  function removeLocal(id: string) {
    setConferences((prev) => prev.filter((e) => e.id !== id));
    setEditing(null);
    setAutoRefresh(false);
  }

  function openForRefresh(conference: Conference) {
    setEditing(conference);
    setAutoRefresh(true);
  }

  function updateConferenceLocal(conference: Conference) {
    setConferences((prev) => prev.map((e) => (e.id === conference.id ? conference : e)));
  }

  function toggleIcsSelected(id: string) {
    setIcsSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function icsHref(): string {
    if (icsPreset === "select") return `/api/conferences/export-ics?filter=ids&ids=${Array.from(icsSelectedIds).join(",")}`;
    return `/api/conferences/export-ics?filter=${icsPreset}`;
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/conferences/import", { method: "POST", body: form });
    const json = await res.json();
    setImporting(false);
    if (!res.ok) {
      setImportMsg(json.error ?? "Import failed.");
      return;
    }
    setImportMsg(`Imported: ${json.added} added, ${json.updated} updated, ${json.skipped} skipped.`);
    const refreshed = await fetch("/api/conferences").then((r) => r.json());
    setConferences(refreshed.conferences);
  }

  return (
    <div>
      <div className="toolbar">
        <div className="view-toggle">
          <button className={viewMode === "cards" ? "active" : ""} onClick={() => setViewMode("cards")}>
            Cards
          </button>
          <button className={viewMode === "calendar" ? "active" : ""} onClick={() => setViewMode("calendar")}>
            Calendar
          </button>
          <button className={viewMode === "map" ? "active" : ""} onClick={() => setViewMode("map")}>
            Map
          </button>
        </div>
        {viewMode === "cards" && (
          <div className="view-toggle">
            <button className={cardsFilter === "all" ? "active" : ""} onClick={() => setCardsFilter("all")}>
              All conferences
            </button>
            <button className={cardsFilter === "quarter" ? "active" : ""} onClick={() => setCardsFilter("quarter")}>
              This quarter
            </button>
          </div>
        )}
        <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value as Region | "all")}>
          <option value="all">All regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <select value={exportPreset} onChange={(e) => setExportPreset(e.target.value as typeof exportPreset)} title="Export preset">
          <option value="all">Export: all conferences</option>
          <option value="quarter">Export: this quarter</option>
          <option value="year">Export: this year</option>
          <option value="confirmed">Export: confirmed with registration</option>
        </select>
        <a className="btn" href={`/api/conferences/export?filter=${exportPreset}`}>
          Export to Excel
        </a>
        <select
          value={icsPreset}
          onChange={(e) => {
            const next = e.target.value as typeof icsPreset;
            setIcsPreset(next);
            setIcsPickerOpen(next === "select");
          }}
          title="Calendar export preset"
        >
          <option value="attending">Calendar: I&rsquo;m attending</option>
          <option value="all">Calendar: all conferences</option>
          <option value="select">Calendar: pick a few…</option>
        </select>
        {icsPreset === "select" ? (
          <button className="btn" onClick={() => setIcsPickerOpen((v) => !v)}>
            {icsPickerOpen ? "Hide picker" : `Choose conferences (${icsSelectedIds.size})`}
          </button>
        ) : (
          <a className="btn" href={icsHref()}>
            Add to calendar (.ics)
          </a>
        )}
        {canEdit && (
          <>
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
            <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? "Importing…" : "Import"}
            </button>
            <button className="btn primary" onClick={() => setEditing("new")}>
              Add conference
            </button>
            <button className="btn" onClick={() => setBulkRefreshOpen(true)}>
              Refresh all conferences
            </button>
          </>
        )}
      </div>

      {icsPreset === "select" && icsPickerOpen && (
        <div className="card" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <div className="helptext" style={{ margin: 0 }}>
              Pick which conferences to add to your calendar, then download.
            </div>
            <div className="spacer" />
            <a
              className="btn small primary"
              style={icsSelectedIds.size === 0 ? { opacity: 0.5, pointerEvents: "none" } : undefined}
              href={icsSelectedIds.size === 0 ? undefined : icsHref()}
            >
              Add {icsSelectedIds.size || ""} to calendar (.ics)
            </a>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {conferences.map((ev) => (
              <label key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0" }}>
                <input type="checkbox" checked={icsSelectedIds.has(ev.id)} onChange={() => toggleIcsSelected(ev.id)} />
                <span style={{ fontWeight: 600 }}>{ev.name}</span>
                <span className="muted">
                  {new Date(ev.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                  {ev.location ? ` · ${ev.location}` : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="helptext" style={{ marginBottom: 16 }}>
        Recurring conferences aren&rsquo;t detected automatically. Open a past occurrence and use{" "}
        <strong>Create next year&rsquo;s occurrence</strong> to carry its details forward (marked{" "}
        <span className="tag forest" style={{ verticalAlign: "middle" }}>Recurring</span> on the card once it has more than one year on file).
        A conference with a registration link gets checked for updates via <strong>Check for updates</strong> on its
        card, or all at once with <strong>Refresh all conferences</strong> above. Nothing runs on a schedule, since
        registration pages rarely change often enough to be worth polling automatically.
      </div>

      {importMsg && <div className="helptext" style={{ marginBottom: 12 }}>{importMsg}</div>}

      {viewMode === "cards" ? (
        <ConferencesGrid conferences={filteredCards} attendeeNamesById={attendeeNamesById} onClickConference={setEditing} onRefreshConference={openForRefresh} />
      ) : viewMode === "calendar" ? (
        <ConferencesCalendar conferences={byRegion} />
      ) : (
        <ConferencesMap conferences={byRegion} />
      )}

      {editing !== null && (
        <ConferenceModal
          key={editing === "new" ? "new" : editing.id}
          conference={editing === "new" ? null : editing}
          allConferences={conferences}
          team={team}
          canEdit={canEdit}
          onClose={() => {
            setEditing(null);
            setAutoRefresh(false);
          }}
          onSaved={upsertLocal}
          onDeleted={removeLocal}
          onCreatedNext={(c) => {
            upsertLocal(c);
            setEditing(c);
          }}
          autoRefresh={autoRefresh}
        />
      )}

      {bulkRefreshOpen && (
        <BulkConferenceRefreshModal onClose={() => setBulkRefreshOpen(false)} onConferenceUpdated={updateConferenceLocal} />
      )}
    </div>
  );
}
