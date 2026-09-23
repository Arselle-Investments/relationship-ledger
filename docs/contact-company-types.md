# Contact & Company `type` — definitions guide

Last updated: 2026-09-23

`Contact.type` and `Company.type` share one enum (`ContactType` in
`prisma/schema.prisma`). There's no live Agora path for `Company.type` today
(Agora has no bulk import for Organizations — each has to be hand-keyed), so
sharing the enum costs nothing and keeps one consistent classification
vocabulary across both.

Every value here is spelled to match Agora's own "Type" picklist **exactly**
(not a paraphrase), so a contact's `type` round-trips cleanly when exported
back to Agora — see `CONTACT_TYPE_LABELS` in `src/lib/contact-constants.ts`
and the export logic in `src/lib/agora-export-template.ts`.

## The 24 allowed values, and what each one actually means

| Value | Definition |
|---|---|
| **Public Pension Plan** | A state or municipal government pension fund. |
| **Private Pension Plan** | A corporate or union pension fund. |
| **Institutional Investor** | An institutional LP not covered by a more specific category below — the generic institutional bucket. |
| **Endowment** | A university or nonprofit endowment. |
| **Foundation** | A charitable foundation. |
| **Insurance Company** | An insurance company investing general or separate account assets. |
| **Sovereign Wealth Fund** | A state-owned investment fund. |
| **Single Family Office** | An investment office serving one family. |
| **Multi Family Office** | An investment office serving several unrelated families. |
| **Wealth Manager** | A firm managing money on behalf of individuals/HNW households — **includes any RIA** (Registered Investment Advisor). RIA is a regulatory registration, not its own category; a firm that's a family office *and* happens to be RIA-registered is still a family office (Single/Multi), not a Wealth Manager. |
| **HNW** | A high-net-worth **individual who is an actual fundraising prospect** for one of Arselle's own funds — not just any wealthy person we happen to know. |
| **Individual** | A personal-network contact we track for relationship reasons, who is **not** (yet, or ever) a fundraising prospect themselves. This is the default for "someone we know," distinct from HNW. |
| **Family Member** | A family member of a contact/principal we track — a personal relationship, not a capital source. |
| **Trusts/Trustee** | A trust or trustee acting as an investment vehicle. |
| **Private Equity Fund** | A fund investing as an LP or acting as a GP/sponsor — this single category deliberately absorbs what Agora splits into GP Fund/LP Fund; too fine a distinction for how Arselle tracks things. |
| **Fund of Funds** | A fund that invests in other funds rather than directly. |
| **Hedge Fund** | A hedge fund. |
| **Advisor** | A **third-party institutional** investment consultant or OCIO advising other institutions on manager/fund selection (e.g. Townsend, Cambridge Associates, StepStone Real Estate) — **not** an individual's personal wealth advisor; see Wealth Manager for that. |
| **Lawyer** | Legal counsel. |
| **Service Provider** | A vendor relationship that is specifically **not** a banker/broker, lawyer, or consultant — e.g. an architect, accountant, appraiser. |
| **Placement Agent** | A third-party firm raising capital on behalf of a fund/sponsor. |
| **CRE Sponsor** | A real estate **operator** — a potential platform partner, or a competitive operator in the market. Not a capital source. |
| **Broker** | A banker or real estate broker (e.g. JLL, Newmark, Evercore, Moelis) — distinct from Advisor (institutional consultant) and Placement Agent (raises capital on someone's behalf). |
| **Other** | True catch-all — used when nothing else fits, or when Agora's own signal for a record is too generic to classify (see below). |

### The Advisor / Wealth Manager split

These two are the easiest to mix up, so to be explicit:

- **Advisor** = serves *institutions* (pensions, endowments) as a paid
  consultant on where to allocate capital. Townsend, Cambridge Associates,
  StepStone Real Estate are all Advisor.
- **Wealth Manager** = serves *individuals/families* directly, including any
  RIA. Baker Street Advisors, Beacon Pointe, Lido Advisors, Morgan Stanley
  PWM, UBS PWM are all Wealth Manager, even though several of them have
  "Advisor" or "Advisors" in their own company name.

A firm's name containing the word "Advisor(s)" is **not** a reliable signal
for which of these two it is — always classify by who the firm's actual
clients are (institutions vs. individuals).

### Advisor vs. Broker vs. CRE Sponsor vs. Service Provider

Four categories that can all sound like "someone in the real estate
ecosystem who isn't a capital source" — the distinction is what role they
actually play:

- **Advisor** — advises institutions on capital allocation (a consultant/OCIO).
- **Broker** — a banker or real estate broker (JLL, Newmark, Evercore, Moelis).
- **CRE Sponsor** — an operator: a potential platform partner, or a
  competitor in the market. Not a capital source at all.
- **Service Provider** — everyone else in the vendor category: architects,
  accountants, appraisers — specifically not a banker/broker, lawyer, or
  consultant.

### No generic "Family Office"

Unlike most other categories, there is deliberately no plain "Family Office"
fallback. Every family office must be classified as Single or Multi, even
when that takes manual research to determine — see "Retired 2026-09-17"
below for why, and the known gap this creates.

## What's excluded, and why

Agora's real "Type" picklist has ~60 values; the ones below are intentionally
**not** part of `ContactType` and can't be selected anywhere in this app.
They're documented (not just dropped) in `AGORA_ARCHIVED_CONTACT_TYPES` in
`src/lib/contact-constants.ts` so a future developer knows they were
considered and excluded on purpose.

**Australian regulatory terms** (ASIC = Australia's securities regulator),
not relevant to a US-based CRE fund: Listed Companies or domestic regulated
companies, Unlisted companies (registered with ASIC), Unlisted companies
(unregistered with ASIC), Self-Manager Super Fund.

**Generic personal/internal-CRM relationship categories**, not capital-source
classifications: Accountant, Activist, Agent, Colleague, Developer, HR,
Partner, Recruiter, Sole trader, Spouse, University, Unaccredited Investor.

**Too granular, redundant, or a pipeline stage misfiled as a type:**
- GP Fund, LP Fund — fold into **Private Equity Fund** on import (too fine a
  distinction for how Arselle tracks things)
- Platform — no longer has a home; falls through to **Other**
- Other Institution — folds into **Institutional Investor**
- Unit Trust, Wealth Fund — not used
- Prospect, Potential Investor, Investor — these describe **pipeline stage**,
  not entity type; that's what `Contact.status` (`FundraisingStage`) is for

**Retired 2026-09-17** in favor of requiring more specificity:
- Family Office — no signal on its own; must become **Single Family Office**
  or **Multi Family Office**. Since neither our data nor Agora's raw export
  has ever distinguished single- from multi-family, every pre-existing
  "Family Office" record was migrated to Single Family Office as a
  **placeholder default**, not a confirmed classification — flagged for
  manual review (see the company-type-review spreadsheet from that cleanup).
  Going forward, a fresh Agora import with the plain "Family Office" value
  falls through to **Other** rather than guessing; a human has to pick
  Single or Multi by hand.
- Family Office/RIA — folds into **Wealth Manager** on import.

**Reinstated 2026-09-23** with narrower definitions than their old
pre-2026-09-16 meaning (see above for the current definitions):
- CRE Sponsor — now specifically an *operator* (platform partner or
  competitor), not a capital source
- Broker — now specifically a banker or real estate broker

**Never actually reviewed** — present in Agora's real picklist, but Arselle
has never encountered them in practice and no decision has been made:
Asset Manager, GP, Lender, Private Company, Professional Service,
Sovereign, UNHW. If one of these ever becomes relevant, it needs a real
decision (add to `ContactType`, fold into an existing value, or archive) —
don't guess a mapping for it.

## Where this shows up in code

- `prisma/schema.prisma` — the `ContactType` enum itself, with a summary
  comment pointing back here
- `src/lib/contact-constants.ts` — `CONTACT_TYPE_LABELS` (display labels,
  identical to Agora's own wording) and `AGORA_ARCHIVED_CONTACT_TYPES` (the
  excluded values, grouped by reason)
- `src/lib/agora-import.ts` — `AGORA_TYPE_TO_CONTACT_TYPE`, the actual mapping
  applied when importing a fresh Agora export
- `src/lib/agora-export-template.ts` — writes `CONTACT_TYPE_LABELS[type]`
  back into Agora's "Type" column on export (falls back to the contact's raw
  `agoraType` only when `type` is `OTHER`, since "Other" itself isn't a real
  Agora value worth writing back)
