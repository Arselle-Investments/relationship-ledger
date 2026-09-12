"use client";

import { useEffect, useMemo, useState } from "react";
import { MailingList, User } from "@prisma/client";
import { CONTACT_TIER_LABELS, CONTACT_TYPE_LABELS, FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { ContactWithRelations } from "@/types/contact";
import { MailingListWithContacts } from "@/types/mailing-list";
import { ListModal } from "./ListModal";
import { UploadListSection } from "./UploadListSection";
import { ContactsTable } from "@/components/ContactsTable";
import { ContactModal } from "@/components/contacts/ContactModal";

/** Client-side mirror of computeListContacts (src/lib/mailing-lists.ts), so a
 * contact edit here can update every list's membership immediately without a
 * round trip. */
function recomputeListMembers(list: MailingList, allContacts: ContactWithRelations[]): ContactWithRelations[] {
  if (list.mode === "STATIC") {
    return allContacts.filter((c) => list.contactIds.includes(c.id));
  }
  let candidates = allContacts;
  if (list.filterType) candidates = candidates.filter((c) => c.type === list.filterType);
  if (list.filterTier) candidates = candidates.filter((c) => c.tier === list.filterTier);
  if (list.filterOwnerId) candidates = candidates.filter((c) => c.ownerId === list.filterOwnerId);
  if (list.filterStatus) candidates = candidates.filter((c) => c.status === list.filterStatus);
  if (list.filterTag) {
    const needle = list.filterTag.toLowerCase();
    candidates = candidates.filter((c) => c.tags.some((t) => t.toLowerCase().includes(needle)));
  }
  return candidates;
}

function filterSummary(entry: MailingListWithContacts, team: User[]): string | null {
  const { list } = entry;
  if (list.mode !== "DYNAMIC") return null;
  const parts: string[] = [];
  if (list.filterStatus) parts.push(FUNDRAISING_STAGE_LABELS[list.filterStatus]);
  if (list.filterType) parts.push(CONTACT_TYPE_LABELS[list.filterType]);
  if (list.filterTier) parts.push(CONTACT_TIER_LABELS[list.filterTier]);
  if (list.filterOwnerId) {
    const owner = team.find((u) => u.id === list.filterOwnerId);
    parts.push(`Owner: ${owner?.name || owner?.email || "—"}`);
  }
  if (list.filterTag) parts.push(`Tag: ${list.filterTag}`);
  return parts.length > 0 ? parts.join(" · ") : "Any contact";
}

export function ListsClient({
  initialLists,
  allContacts,
  team,
  canEdit,
}: {
  initialLists: MailingListWithContacts[];
  allContacts: ContactWithRelations[];
  team: User[];
  canEdit: boolean;
}) {
  const [lists, setLists] = useState(initialLists);
  const [contacts, setContacts] = useState(allContacts);
  const [editing, setEditing] = useState<MailingListWithContacts | null | "new">(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [lookupContact, setLookupContact] = useState<ContactWithRelations | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openContact, setOpenContact] = useState<ContactWithRelations | null>(null);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleContactSaved(contact: ContactWithRelations) {
    const nextContacts = contacts.map((c) => (c.id === contact.id ? contact : c));
    setContacts(nextContacts);
    setLists((prev) => prev.map((entry) => ({ ...entry, contacts: recomputeListMembers(entry.list, nextContacts) })));
    setOpenContact(null);
  }

  function handleContactDeleted(id: string) {
    const nextContacts = contacts.filter((c) => c.id !== id);
    setContacts(nextContacts);
    setLists((prev) => prev.map((entry) => ({ ...entry, contacts: entry.contacts.filter((c) => c.id !== id) })));
    setOpenContact(null);
  }

  // Agora only ever reads a contact's Tags, not this app's lists, so every
  // list's members need the list's name in their tags to be visible there.
  // Rather than a per-list button for people to remember to click, this just
  // keeps them in sync quietly in the background — a no-op once everyone's
  // already tagged, so it's cheap to repeat on every visit here.
  useEffect(() => {
    if (!canEdit) return;
    for (const entry of lists) {
      fetch(`/api/lists/${entry.list.id}/tag-members`, { method: "POST" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  const contactMatches = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return [];
    return contacts.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [contacts, contactSearch]);

  const listsContainingLookup = useMemo(() => {
    if (!lookupContact) return [];
    return lists.filter((entry) => entry.contacts.some((c) => c.id === lookupContact.id));
  }, [lists, lookupContact]);

  function emailsFor(entry: MailingListWithContacts): string[] {
    return entry.contacts.filter((c) => c.email).map((c) => c.email as string);
  }

  async function copyEmails(entry: MailingListWithContacts) {
    const emails = emailsFor(entry);
    if (emails.length === 0) {
      setCopyMsg(`No contacts with an email on file in "${entry.list.name}".`);
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopyMsg(`Copied ${emails.length} email${emails.length === 1 ? "" : "es"} from "${entry.list.name}".`);
    } catch {
      setCopyMsg("Couldn't copy to the clipboard. Check the browser's clipboard permission and try again.");
    }
  }

  function mailtoHref(entry: MailingListWithContacts): string {
    const emails = emailsFor(entry);
    return emails.length === 0 ? "mailto:" : `mailto:?bcc=${encodeURIComponent(emails.join(","))}`;
  }

  // mailto: links can fail silently — no default mail client registered, a
  // blocked protocol handler, or (with a long recipient list) a URL the
  // OS/browser won't hand off. Always copy the addresses too, so the click
  // does *something* visible even when the mail client never opens.
  async function handleMailtoClick(entry: MailingListWithContacts) {
    const emails = emailsFor(entry);
    if (emails.length === 0) return;
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopyMsg(`Also copied ${emails.length} email${emails.length === 1 ? "" : "es"} from "${entry.list.name}" to the clipboard, in case your email client didn't open.`);
    } catch {
      // Clipboard permission denied — the mailto: attempt still stands on its own.
    }
  }

  function upsertLocal(entry: MailingListWithContacts) {
    setLists((prev) => {
      const exists = prev.some((e) => e.list.id === entry.list.id);
      return exists ? prev.map((e) => (e.list.id === entry.list.id ? entry : e)) : [...prev, entry];
    });
    setEditing(null);
  }

  function removeLocal(id: string) {
    setLists((prev) => prev.filter((e) => e.list.id !== id));
    setEditing(null);
  }

  async function duplicateList(entry: MailingListWithContacts) {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${entry.list.name} (copy)`,
        description: entry.list.description,
        mode: entry.list.mode,
        contactIds: entry.list.contactIds,
        filterType: entry.list.filterType,
        filterTier: entry.list.filterTier,
        filterOwnerId: entry.list.filterOwnerId,
        filterTag: entry.list.filterTag,
        filterStatus: entry.list.filterStatus,
      }),
    });
    const json = await res.json();
    if (!res.ok) return;
    // Same filter/contactIds as the original, so its current membership is a safe stand-in
    // for the copy's — the copy is fully independent from here, editing it never touches the original.
    const newEntry = { list: json.list, contacts: entry.contacts };
    upsertLocal(newEntry);
    setEditing(newEntry);
  }

  return (
    <div>
      {canEdit && <UploadListSection onCreated={upsertLocal} />}

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>Search for a contact in mailing lists</div>
        <div style={{ position: "relative", maxWidth: 360 }}>
          <input
            type="text"
            placeholder="Search a contact by name…"
            value={lookupContact ? lookupContact.name : contactSearch}
            onChange={(e) => {
              setContactSearch(e.target.value);
              setLookupContact(null);
            }}
          />
          {contactMatches.length > 0 && !lookupContact && (
            <div
              className="card"
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 5,
                marginTop: 4,
                padding: 4,
                maxHeight: 220,
                overflow: "auto",
              }}
            >
              {contactMatches.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "7px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  className="lookup-row"
                  onClick={() => {
                    setLookupContact(c);
                    setContactSearch("");
                  }}
                >
                  {c.name} {c.org ? <span className="muted">({c.org})</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {lookupContact && (
          <div style={{ marginTop: 12 }}>
            {listsContainingLookup.length === 0 ? (
              <div className="helptext" style={{ margin: 0 }}>
                {lookupContact.name} isn&rsquo;t in any mailing list yet.
              </div>
            ) : (
              <div className="helptext" style={{ margin: 0 }}>
                {lookupContact.name} is in {listsContainingLookup.length} list{listsContainingLookup.length === 1 ? "" : "s"}:{" "}
                {listsContainingLookup.map((entry, i) => (
                  <span key={entry.list.id}>
                    <strong>{entry.list.name}</strong>
                    {i < listsContainingLookup.length - 1 ? ", " : ""}
                  </span>
                ))}
              </div>
            )}
            <button
              className="btn small ghost"
              style={{ marginTop: 8 }}
              onClick={() => {
                setLookupContact(null);
                setContactSearch("");
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="spacer" />
        {canEdit && (
          <button className="btn primary" onClick={() => setEditing("new")}>
            Create list
          </button>
        )}
      </div>

      {copyMsg && <div className="helptext" style={{ marginBottom: 12 }}>{copyMsg}</div>}

      {lists.length === 0 ? (
        <div className="empty">
          <h3>No mailing lists yet</h3>
          <div>Create a list to group contacts for a fundraising push.</div>
        </div>
      ) : (
        lists.map((entry) => (
          <div key={entry.list.id} className="card" style={{ padding: "16px 18px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ fontSize: 16 }}>
                  {entry.list.name}{" "}
                  {entry.list.mode === "DYNAMIC" && <span className="tag forest">smart list</span>}
                </h3>
                {entry.list.description && (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                    {entry.list.description}
                  </div>
                )}
                {filterSummary(entry, team) && (
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                    Filters: {filterSummary(entry, team)}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flex: "none" }}>
                <span className="tag brass">
                  {entry.contacts.length} contact{entry.contacts.length === 1 ? "" : "s"}
                </span>
                <a className="btn small" href={`/api/lists/${entry.list.id}/export`}>
                  Export
                </a>
                <button className="btn small" onClick={() => copyEmails(entry)}>
                  Copy emails
                </button>
                <a className="btn small" href={mailtoHref(entry)} onClick={() => handleMailtoClick(entry)}>
                  Email (BCC)
                </a>
                <button className="btn small" onClick={() => toggleExpand(entry.list.id)}>
                  {expanded.has(entry.list.id) ? "Hide" : "View"}
                </button>
                {canEdit && (
                  <button className="btn small" onClick={() => duplicateList(entry)}>
                    Duplicate
                  </button>
                )}
                {canEdit && (
                  <button className="btn small" onClick={() => setEditing(entry)}>
                    Edit
                  </button>
                )}
              </div>
            </div>
            {expanded.has(entry.list.id) && (
              <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <ContactsTable contacts={entry.contacts} onOpenContact={setOpenContact} emptyMessage="No contacts in this list." />
              </div>
            )}
          </div>
        ))
      )}

      {editing !== null && (
        <ListModal
          entry={editing === "new" ? null : editing}
          allContacts={contacts}
          team={team}
          onClose={() => setEditing(null)}
          onSaved={upsertLocal}
          onDeleted={removeLocal}
        />
      )}

      {openContact && (
        <ContactModal
          contact={openContact}
          team={team}
          canEdit={canEdit}
          onClose={() => setOpenContact(null)}
          onSaved={handleContactSaved}
          onDeleted={handleContactDeleted}
        />
      )}
    </div>
  );
}
