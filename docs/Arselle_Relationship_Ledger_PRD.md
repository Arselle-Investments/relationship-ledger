# PRD: Arselle Relationship Ledger (Production Build)

**Status:** Draft, for handoff to a coding agent (Cursor / Claude Code)
**Reference prototype:** `arselle-crm.html` (working single-file HTML artifact, built in Claude.ai)
**Author:** Ariela, Arselle Investments
**Last updated:** August 2026

---

## 1. Background

Arselle Investments currently uses Agora for fundraising and contact management, but the team finds it weak in three specific areas: consolidating contacts into one place, tracking cold outreach and follow-ups, and assigning/tracking internal tasks. Conference and event planning currently lives outside any system, in spreadsheets and calendar invites.

A working prototype (the "Arselle Relationship Ledger") was built as a single-file HTML artifact in Claude.ai to validate the concept, data model, and workflows with the team. It is fully interactive and has been used by the team, but it runs on Claude's artifact storage layer, which is not suitable for a real production tool (see §7). This PRD describes what should be rebuilt as a proper application, using the prototype as the functional and interaction-design reference.

**The prototype file should be given to the coding agent alongside this PRD** — it is a working reference for exact field names, computed logic (cadence math, sequence scheduling, list filtering), and UI structure. Treat this PRD as the spec and the HTML file as the executable illustration of that spec.

## 2. Goals

- Replace ad hoc spreadsheet/calendar tracking and Agora's weak spots with one tool for: contact consolidation, cold outreach tracking, task assignment, and event/conference planning.
- Support fundraising workflows: building mailing lists, tracking outreach cadence, surfacing what needs attention.
- Give the whole team (Ariela, Bianca Tomkoria, Gwyneth Leung, Mark Julius Mangao, Kev Zoryan, Aaron Greeno) a shared, always-current view — not per-person spreadsheets.
- Preserve the interaction patterns already validated in the prototype (see §5) rather than redesigning from scratch.

## 3. Non-goals

- **Not** a fund administration platform. No capital calls, waterfalls, distributions, K-1s, or LP subscription documents — Agora remains the system of record for those.
- **Not** a compliance/AML/KYC tool.
- **Not** an email/calendar sync product (no automatic activity capture) in this phase — outreach and contact touches are logged manually. This could be a future phase if outreach volume grows enough to justify the integration cost (OAuth into company email, data-processing agreements, ongoing maintenance).
- Not aiming for feature parity with full CRM suites (HubSpot, Affinity, Juniper Square, etc.) — see the team's CRM competitive audit for what was deliberately scoped out and why.

## 4. Users & Roles

- **Team members:** Ariela, Bianca Tomkoria, Gwyneth Leung, Mark Julius Mangao, Kev Zoryan, Aaron Greeno (team list should be editable, not hardcoded).
- **Permission model:** soft view/edit toggle in the prototype (anyone can browse; a mode switch gates who can currently edit). For production, this should become **real authentication with role-based access**: every team member has an account; an "edit" vs "view-only" role per user (admin-assignable), rather than a self-toggle. This is the single biggest permission gap between the prototype and what a production tool needs.

## 5. Functional Requirements

Each module below is fully built and working in the prototype. Rebuild with equivalent behavior; deviations should be intentional and called out.

### 5.1 Contacts
- Fields: name, organization, type (LP/Institutional, Family Office, Placement Agent, Broker/Advisor, Sponsor/Co-GP, Consultant, Other), tier (Tier 1/2/3), status (Not started, Outreach sent, Awaiting reply, Responded, Meeting scheduled, Diligence, Committed, Passed), owner, warm path (which team member already has the relationship, or none), email, city/region, last contact date, cadence override (days, optional), priority quarter, tags (multi), notes.
- Filterable/searchable table (search by name/org/tags; filter by type, tier, owner).
- Detail view showing all fields plus linked tasks and outreach sequence progress (see 5.6).
- **Required-field prompt:** changing a contact's status to anything other than "Not started" requires a non-empty note explaining context. Block save until satisfied.
- Excel import: flexible header-alias matching (case-insensitive) across Name, Organization, Type, Tier, Owner, Email, City, Last Contact, Status, Tags, Notes — any subset of columns works. Match/update existing contacts by name+organization to avoid duplicates on re-import.
- Excel export of the current filtered view.

### 5.2 Needs Follow-up
Three sections, computed live (not manually maintained):
1. **Overdue by cadence** — active-outreach-status contacts (Outreach sent, Awaiting reply) where `today - lastContact >= cadence` (cadence = per-contact override or the team default, e.g. 14 days). Sortable by most-overdue. One-click "mark followed up" sets last contact to today.
2. **Overdue sequence steps** — contacts on an active outreach sequence (see 5.6) whose next pending step's due date has passed.
3. **Data hygiene flags** — contacts flagged regardless of status if: no activity within a configurable stale-days threshold (default 45), OR missing organization, OR missing owner. Purpose: catch contacts that are quietly going stale, not just ones mid-outreach.

### 5.3 Mailing Lists
- Two list types:
  - **Static** — an explicit, manually chosen set of contacts.
  - **Smart/dynamic** — a saved filter (type, tier, owner, tag-contains) that live-recomputes matching contacts every time the list is viewed, rather than storing a fixed membership. This was a deliberate addition based on competitive research (Juniper Square, Dynamo Software both support saved dynamic segments; Arselle's prior lists were static and needed manual upkeep).
- Excel export per list (works for both types — export always reflects current computed membership for smart lists).

### 5.4 Tasks
- Kanban board: Open / In Progress / Done columns.
- Fields: title, related contact (optional), owner, due date, status, priority (High/Medium/Low), notes.
- Filter by owner.
- **Drag-and-drop** between columns updates status immediately; edit-mode gated (view-only users can't drag).
- Excel export.

### 5.5 Conferences & Events
- Fields: name, start date, end date, location, type (Conference, Networking, Roadshow, Other), attendees (multi-select from team), goals, notes.
- Two views:
  - **Cards** — list view, filterable to "All events" or "This quarter" (based on today's date).
  - **Calendar** — month-grid layout, togglable between a 3-month quarter view and a full 12-month year view, with prev/next navigation. Days with events are highlighted; clicking a day lists what's on it.
- Excel import: flexible header matching for a conference-tracker-style spreadsheet (Start Date, End Date, Event Name, Location, Link, Registration, Registration Deadline, Costs, Duration). Reads every sheet in the workbook. Re-importing the same file updates existing events (matched by name + start date) rather than duplicating.
- Excel export respects the active Cards-view filter (all vs. this quarter).

### 5.6 Outreach Sequences
- Reusable **templates**, each a named ordered list of steps: `{type: Email|Call|LinkedIn|Other, title, waitDays (days after the prior step)}`. Managed in Settings.
- From a contact's detail view, start a sequence: creates a per-contact instance with computed due dates (cumulative offset from the start date), independent of later template edits.
- Mark the next pending step done (advances progress, updates the contact's last-contact date); cancel a sequence at any time.
- Feeds directly into Needs Follow-up (overdue steps) and Look Ahead (upcoming steps).
- Two starter templates should ship by default: "Standard cold outreach" (intro email → wait 5d → call → wait 5d → follow-up email → wait 7d → final check-in) and "Conference warm intro" (shorter, post-event-meeting cadence).

### 5.7 Priorities Dashboard
- Grid: rows = tiers (Tier 1/2/3), columns = next 4 quarters. Each cell shows count of contacts tagged to that tier + quarter (via the contact's `priorityQuarter` field). Click a cell to see the matching contacts.

### 5.8 Look Ahead Report
- Toggle: "Next 2 weeks" / "Next 30 days."
- Four sections, computed from the same underlying data as the other tabs (no separate data entry):
  1. **Required follow-ups** — currently overdue (cadence-based + overdue sequence steps).
  2. **Recommended outreach** — due within the selected window but not yet overdue (upcoming sequence steps + upcoming cadence deadlines).
  3. **Milestones** — open/in-progress tasks due within the window.
  4. **Conferences & events** — events overlapping the window.
- Excel export as a 4-sheet workbook (one sheet per section above).

### 5.9 Settings
- Default follow-up cadence (days).
- Stale-contact threshold (days).
- Team member list (add/remove).
- Outreach sequence template management (add/edit/delete templates and their steps).
- Data reset/clear utility for onboarding.

## 6. Data Model (reference schema)

```
Contact {
  id, name, org, type, tier, status, owner, warmPath,
  email, city, lastContact (date), cadenceOverrideDays (nullable),
  priorityQuarter, tags: string[], notes,
  activeSequence: { templateId, templateName, startDate,
    steps: [{ type, title, dueDate, done, doneDate }], completed } | null,
  createdAt
}

MailingList {
  id, name, description, mode: 'static' | 'dynamic',
  contactIds: string[]  // static mode
  filter: { type, tier, owner, tag } | null  // dynamic mode
}

Task {
  id, title, relatedContactName, owner, dueDate, status, priority, notes
}

Event {
  id, name, startDate, endDate, location, type,
  attendeeNames: string[], goals, notes
}

SequenceTemplate {
  id, name, steps: [{ type, title, waitDays }]
}

Settings {
  defaultCadenceDays, staleDays, team: string[]
}
```

Team member identity is currently a plain string (name); production build should map this to real user accounts (see §4).

## 7. Non-Functional Requirements / Migration Notes

This is the most important section for the engineering handoff — it's what changes fundamentally between the prototype and a production build.

- **Persistence:** the prototype uses Claude's in-browser `window.storage` API (shared key-value store), which **only functions inside Claude.ai** and has no equivalent outside it. Production needs a real backend: a database (Postgres recommended given the relational nature of contacts/lists/tasks/events) plus an API layer. All the client-side logic described in §5 (cadence math, sequence scheduling, dynamic list filtering, stale-contact detection) is currently computed in the browser at render time from the full in-memory dataset — this can either stay client-side against a synced local cache or move server-side; either is fine as long as behavior matches.
- **Authentication & permissions:** replace the soft edit/view toggle with real login (SSO via Google Workspace/Microsoft 365 would fit Arselle's existing tools) and per-user roles.
- **Hosting:** internal-only; no public access. Given the sensitivity of LP/contact data, prioritize a private deployment (internal URL, VPN, or access-gated hosting) over a public SaaS-style deploy.
- **Excel import/export:** the prototype uses SheetJS (`xlsx` package) client-side for both reading uploaded workbooks and generating downloads. This library and approach can be reused directly in a production frontend, or replaced with a server-side equivalent (e.g., `openpyxl` in Python, `exceljs` in Node) if exports should be generated server-side.
- **No email/calendar integration** in this phase (see Non-goals).

## 8. Design & Branding

- Reference: Arselle's Q3 2026 corporate overview deck (`Arselle_Corporate_Overview_3Q2026.pdf`) is the canonical brand source.
- Palette: navy ink (`#1E2E36`), slate-teal accents (`#46626C`, `#5B7D82`), sage-green for positive states (`#7C9992`-family), cool grey-white background (`#F5F7F7`). Avoid warm/cream tones — the brand deck is consistently cool-toned navy/slate.
- Typography: **Poppins** for headers (matches the deck's geometric display type), **Work Sans** for body/data. No monospace anywhere.
- Logo mark: two-peak mountain glyph, echoing Arselle's actual logomark (see deck cover page).
- The existing prototype's CSS can be lifted close to verbatim as a starting design system (color variables, spacing, card/table styles) — it was built specifically to match the brand deck.

## 9. Open Questions for the Engineering Team

1. Hosting environment: internal server, cloud (which provider), or on-prem given the OneDrive/Microsoft 365 environment the team already uses?
2. Should contact/list/task data sync with Microsoft 365 (e.g., Outlook contacts, SharePoint) at all, or remain fully independent of Agora and Microsoft tooling?
3. Long-term: is an Agora contact export/import a one-time migration or does it need to stay a recurring sync?
4. Should relationship-strength scoring or an activity timeline (deferred features from the CRM competitive audit) be roadmapped for a later phase?

## 10. Acceptance Criteria Summary

The production build should be considered functionally complete when a team member can, without touching a spreadsheet:
- Add/import contacts and find any contact via search or filter in under 2 clicks.
- See, at a glance, every contact overdue for follow-up, on any active outreach sequence, or flagged for data hygiene.
- Build a mailing list (static or smart) and export it to Excel.
- Assign, track, and drag-and-drop tasks across a team.
- View conferences in both list and calendar form, filtered to the current quarter.
- Pull a Look Ahead report for the next 2 weeks or 30 days covering follow-ups, outreach, tasks, and events in one export.
