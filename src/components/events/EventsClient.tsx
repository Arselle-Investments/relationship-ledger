"use client";

import { useMemo, useRef, useState } from "react";
import { Event, User } from "@prisma/client";
import { quarterBounds, eventInQuarter } from "@/lib/events";
import { REGIONS, Region, inferRegion } from "@/lib/region";
import { EventsGrid } from "./EventsGrid";
import { EventsCalendar } from "./EventsCalendar";
import { EventsMap } from "./EventsMap";
import { EventModal } from "./EventModal";

export function EventsClient({
  initialEvents,
  team,
  canEdit,
}: {
  initialEvents: Event[];
  team: User[];
  canEdit: boolean;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [viewMode, setViewMode] = useState<"cards" | "calendar" | "map">("cards");
  const [cardsFilter, setCardsFilter] = useState<"all" | "quarter">("all");
  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");
  const [editing, setEditing] = useState<Event | null | "new">(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attendeeNamesById = useMemo(() => new Map(team.map((u) => [u.id, u.name || u.email || ""])), [team]);

  const byRegion = useMemo(() => {
    if (regionFilter === "all") return events;
    return events.filter((ev) => inferRegion(ev.location) === regionFilter);
  }, [events, regionFilter]);

  const filteredCards = useMemo(() => {
    if (cardsFilter !== "quarter") return byRegion;
    const bounds = quarterBounds(0);
    return byRegion.filter((ev) => eventInQuarter(ev, bounds));
  }, [byRegion, cardsFilter]);

  function upsertLocal(event: Event) {
    setEvents((prev) => {
      const exists = prev.some((e) => e.id === event.id);
      return exists ? prev.map((e) => (e.id === event.id ? event : e)) : [...prev, event];
    });
    setEditing(null);
  }

  function removeLocal(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setEditing(null);
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/events/import", { method: "POST", body: form });
    const json = await res.json();
    setImporting(false);
    if (!res.ok) {
      setImportMsg(json.error ?? "Import failed.");
      return;
    }
    setImportMsg(`Imported: ${json.added} added, ${json.updated} updated, ${json.skipped} skipped.`);
    const refreshed = await fetch("/api/events").then((r) => r.json());
    setEvents(refreshed.events);
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
              All events
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
        <a className="btn" href={`/api/events/export${viewMode === "cards" ? `?filter=${cardsFilter}` : ""}`}>
          Export to Excel
        </a>
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
              Add event
            </button>
          </>
        )}
      </div>

      {importMsg && <div className="helptext" style={{ marginBottom: 12 }}>{importMsg}</div>}

      {viewMode === "cards" ? (
        <EventsGrid events={filteredCards} attendeeNamesById={attendeeNamesById} onClickEvent={setEditing} />
      ) : viewMode === "calendar" ? (
        <EventsCalendar events={byRegion} />
      ) : (
        <EventsMap events={byRegion} />
      )}

      {editing !== null && (
        <EventModal
          event={editing === "new" ? null : editing}
          team={team}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
          onSaved={upsertLocal}
          onDeleted={removeLocal}
        />
      )}
    </div>
  );
}
