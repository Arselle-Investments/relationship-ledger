# Data cleanup & Agora mapping — working tracker

Living status doc for the ongoing contact/company taxonomy cleanup and
Agora template re-mapping. Update as items resolve; not meant to be a
polished reference (that's `docs/contact-company-types.md`) — this is
just "what's open, what's waiting on whom."

## Agora template re-mapping (in progress, started 2026-09-24)

Agora's outgoing "Import/Update Contacts" template changed materially —
11 columns removed, 3 added. See conversation for the full diff.

- [x] **AREF I – Stage** — Agora's fixed dropdown confirmed 2026-09-24:
      Decline, Fund II Prospect, 1. Outreach Sent, 2. Initial Interest,
      3. Meeting Occurred, 4a. Active Prospect, 4b. Final Close Potential,
      5. Due Diligence / Dataroom, 6. Committed. `FUNDRAISING_STAGE_LABELS`
      capitalization updated to match exactly, `AREF_STAGE_TO_AGORA_VALUE`
      added in `agora-export-template.ts` (both PASSED_NOT_INTERESTED and
      DO_NOT_CONTACT collapse to Agora's one "Decline"), and the column is
      now live in `AGORA_TEMPLATE_HEADERS` + `Settings.agoraContactTemplateHeaders`.
      Spelling confirmed 2026-09-24: "Active Prospect" (standard spelling,
      not a repeat of the "Propsect Type" typo) — no code change needed,
      already implemented correctly.
- [x] **Prospect Type** — resolved 2026-09-24: `RecordContext` expanded from
      2 values (`FUND`, `DEAL`) to Agora's full 5 (`FUND`, `DEAL`,
      `MGMT_CO`, `PLATFORM_LEVEL_PROPCO`, `PLATFORM_LEVEL_OPCO`), same
      pattern as `ContactType`. The existing "Fund/Deal" checkbox UI in
      `ContactModal`/`NewContactsClient` is enum-driven
      (`Object.values(RecordContext).map(...)`), so all 5 options now show
      automatically — verified live in the dev preview, zero UI code
      changes needed. Fund-vs-deal funnel logic (`fund-signal.ts`/
      `company-fund-signal.ts`) only ever checks for FUND/DEAL specifically,
      so it's unaffected by the 3 new values. Export wired up in
      `agora-export-template.ts` — a direct pass-through multiselect (values
      joined with `"; "`), same "spelled to match Agora exactly" approach as
      Type. Note: the simple "Fund / Deal" quick-filter toggle buttons on
      the main Companies/Contacts list pages were **not** expanded to all 5
      — those stay as a deliberate two-option quick filter unless asked
      otherwise.
- [x] **Platform OpCo Prospect** — deprecated as its own column, folding
      into an option under Prospect Type. No separate mapping needed; left
      unmapped in the header list until Agora actually removes the column.
- [x] Removed the 11 dead columns from `agora-export-template.ts` entirely
      (Low/High Commitment, Acting on Behalf x2, Asset Class/Equity Check
      Range/Risk Profile, the 3 old Type-of-Prospect Yes/No flags, Received
      Hiawatha Email 2026) — see the "no Agora destination" note below.
- [ ] **Bianca is separately reviewing**: the fields that now have *zero*
      Agora destination since the template shrank — `commitmentLow/High`,
      and Company's whole investment profile (`targetAssetClasses`,
      `investmentSizeMin/Max`, `investmentStrategies`). Decide whether any
      of these need a new custom field requested from Agora, or if they
      just stay Ledger-only.
- [ ] Once the above lands: refresh the full field-by-field mapping table
      (Contact + Company) against the new template for an accurate
      "what's in Agora / what isn't" picture.

## Contact/Company type taxonomy (mostly done)

- [x] Rebuilt as a 25-value curated subset of Agora's real Type picklist
      (added CRE Sponsor, Broker, Lender back with narrower definitions)
- [x] All 1,142 contacts + all companies reclassified
- [x] 12 duplicate contact merges + several company merges completed
      (2026-09-24 round)
- [ ] Contact sheet: rows still marked plain `1` (TBD, no research done
      yet) — ongoing, Bianca working through these
- [ ] Company sheet: same TBD rows still open
- [ ] Keep an eye out for more duplicates as review continues (same
      pattern as Adept Urban, BentallGreenOak, Mullahey, etc.)

## Housekeeping (not urgent)

- [ ] One-off scripts sitting untracked in the repo root
      (`scripts-oneoff-*.js`) — safe to delete once no more spreadsheet
      rounds are expected
- [ ] Scratch spreadsheets (`scratch-*.xlsx`) — same, local-only, never
      committed
