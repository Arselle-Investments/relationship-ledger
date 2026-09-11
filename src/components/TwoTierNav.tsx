"use client";

import { useState } from "react";
import Link from "next/link";

type TabDef = { href: string; label: string };
type SubsectionDef = { key: string; label: string; tabs: TabDef[] };
type SectionDef = { key: string; label: string; tabs?: TabDef[]; subsections?: SubsectionDef[] };

// Small line icons, sized to sit inline with a pill's label — stroke-only so
// they inherit the pill's current text color (including active/hover states)
// automatically rather than needing their own color logic.
const ICON_PROPS = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function HomeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9.5" />
    </svg>
  );
}

function RelationshipsIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M3.5 20c.4-3.6 2.8-5.7 5.5-5.7s5.1 2.1 5.5 5.7" />
      <path d="M15.2 20c.3-2.4 1.7-4.2 3.5-4.7" />
    </svg>
  );
}

function OutreachIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4Z" />
    </svg>
  );
}

function PipelineIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 4h16l-6.5 8v6.5l-3 1.5v-8L4 4Z" />
    </svg>
  );
}

function DataQualityIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.3-4.3" />
      <path d="m8 10.5 1.8 1.8L13.5 8" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 17.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z" />
    </svg>
  );
}

const SECTION_ICONS: Record<string, () => React.ReactElement> = {
  relationships: RelationshipsIcon,
  outreach: OutreachIcon,
  pipeline: PipelineIcon,
  "data-quality": DataQualityIcon,
};

const SECTIONS: SectionDef[] = [
  {
    key: "relationships",
    label: "Relationships",
    tabs: [
      { href: "/contacts", label: "Contacts" },
      { href: "/companies", label: "Companies" },
      { href: "/lists", label: "Mailing Lists" },
      { href: "/deliverables", label: "Deliverables" },
    ],
  },
  {
    key: "outreach",
    label: "Outreach",
    subsections: [
      {
        key: "team-outreach",
        label: "Team Outreach",
        tabs: [
          { href: "/followups", label: "Follow-ups" },
          { href: "/tasks", label: "Tasks" },
          { href: "/conferences", label: "Conferences" },
          { href: "/travel", label: "Travel" },
          { href: "/lookahead", label: "Upcoming" },
        ],
      },
      {
        key: "emerging-managers",
        label: "Emerging Managers",
        tabs: [
          { href: "/capital-sources", label: "Capital Sources" },
          { href: "/consultants", label: "Consultants" },
          { href: "/emerging-managers/funnel", label: "EM Funnel" },
        ],
      },
    ],
  },
  {
    key: "pipeline",
    label: "Pipeline",
    subsections: [
      {
        key: "fund-raise",
        label: "AREF I Prospects",
        tabs: [
          { href: "/funnel", label: "Funnel" },
          { href: "/target-companies", label: "Target Companies" },
          { href: "/target-contacts", label: "Target Investors" },
          { href: "/stuck-contacts", label: "Stalled Contacts" },
        ],
      },
      {
        key: "deal-capital",
        label: "Deal Capital",
        tabs: [
          { href: "/deals", label: "Deals" },
          { href: "/deals/recipients", label: "Deal Recipients" },
          { href: "/deals/funnel", label: "Deal Cap Funnel" },
          { href: "/deals/target-lps", label: "Target LPs" },
        ],
      },
    ],
  },
];

// Data Quality is a utility/hygiene area, not a workflow the team lives in
// day to day — kept as its own tabbed section, but pinned beside Settings
// instead of sitting among the main pills.
const UTILITY_SECTIONS: SectionDef[] = [
  {
    key: "data-quality",
    label: "Data Quality",
    tabs: [
      { href: "/inbox", label: "Correspondence" },
      { href: "/new-contacts", label: "New Contacts" },
      { href: "/contacts/review", label: "Duplicate Contacts" },
      { href: "/new-companies", label: "New Companies" },
      { href: "/companies/review", label: "Duplicate Companies" },
      { href: "/data-hygiene", label: "Data Hygiene" },
      { href: "/agora-sync", label: "Agora Sync" },
      { href: "/edit-log", label: "Edit Log" },
    ],
  },
];

const ALL_SECTIONS = [...SECTIONS, ...UTILITY_SECTIONS];
const HOME_KEY = "home";

function locate(href: string): { sectionKey: string; subsectionKey?: string } {
  if (href === "/") return { sectionKey: HOME_KEY };
  for (const s of ALL_SECTIONS) {
    if (s.tabs?.some((t) => t.href === href)) return { sectionKey: s.key };
    const sub = s.subsections?.find((ss) => ss.tabs.some((t) => t.href === href));
    if (sub) return { sectionKey: s.key, subsectionKey: sub.key };
  }
  return { sectionKey: SECTIONS[0].key };
}

export function TwoTierNav({
  activeHref,
  inboxCount,
  newContactsCount,
  newCompaniesCount,
  companyReviewCount,
  contactReviewCount,
  dataHygieneCount,
}: {
  activeHref: string;
  inboxCount?: number;
  newContactsCount?: number;
  newCompaniesCount?: number;
  companyReviewCount?: number;
  contactReviewCount?: number;
  dataHygieneCount?: number;
}) {
  const initialLocation = locate(activeHref);
  const [activeSection, setActiveSection] = useState(initialLocation.sectionKey);
  const [activeSubsection, setActiveSubsection] = useState(
    initialLocation.subsectionKey ?? ALL_SECTIONS.find((s) => s.key === initialLocation.sectionKey)?.subsections?.[0]?.key
  );

  // No entry in ALL_SECTIONS matches "home" — that's deliberate. Home isn't a
  // workflow section with its own tabs, so nothing here renders as active and
  // no tab row shows, instead of falling back to whichever section happened
  // to be first (the bug this replaced: Home silently looked like Relationships).
  const section = ALL_SECTIONS.find((s) => s.key === activeSection);
  const subsection = section?.subsections?.find((ss) => ss.key === activeSubsection) ?? section?.subsections?.[0];
  const tabs = section?.subsections ? subsection?.tabs ?? [] : section?.tabs ?? [];

  function selectSection(s: SectionDef) {
    setActiveSection(s.key);
    setActiveSubsection(s.subsections?.[0]?.key);
  }

  return (
    <>
      <div id="section-row">
        <Link
          href="/"
          className={`settings-link ${activeHref === "/" ? "active" : ""}`}
          style={{ marginRight: 4, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <HomeIcon />
          Home
        </Link>
        {SECTIONS.map((s) => {
          const Icon = SECTION_ICONS[s.key];
          return (
            <button
              key={s.key}
              type="button"
              className={`section-pill ${activeSection === s.key ? "active" : ""}`}
              onClick={() => selectSection(s)}
            >
              {Icon && <Icon />}
              {s.label}
            </button>
          );
        })}
        <div className="section-spacer" />
        {UTILITY_SECTIONS.map((s) => {
          const Icon = SECTION_ICONS[s.key];
          return (
            <button
              key={s.key}
              type="button"
              className={`section-pill ${activeSection === s.key ? "active" : ""}`}
              onClick={() => selectSection(s)}
            >
              {Icon && <Icon />}
              {s.label}
            </button>
          );
        })}
        <Link
          href="/settings"
          className={`settings-link ${activeHref === "/settings" ? "active" : ""}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <SettingsIcon />
          Settings
        </Link>
      </div>

      {section?.subsections && (
        <div className="subsection-row">
          {section.subsections.map((ss) => (
            <button
              key={ss.key}
              type="button"
              className={`subsection-pill ${activeSubsection === ss.key ? "active" : ""}`}
              onClick={() => setActiveSubsection(ss.key)}
            >
              {ss.label}
            </button>
          ))}
        </div>
      )}

      {tabs.length > 0 && (
        <div id="tabs">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className={`tab-btn ${activeHref === tab.href ? "active" : ""}`}>
              {tab.label}
              {tab.href === "/inbox" && !!inboxCount && <span className="n">{inboxCount}</span>}
              {tab.href === "/new-contacts" && !!newContactsCount && <span className="n">{newContactsCount}</span>}
              {tab.href === "/new-companies" && !!newCompaniesCount && <span className="n">{newCompaniesCount}</span>}
              {tab.href === "/companies/review" && !!companyReviewCount && <span className="n">{companyReviewCount}</span>}
              {tab.href === "/contacts/review" && !!contactReviewCount && <span className="n">{contactReviewCount}</span>}
              {tab.href === "/data-hygiene" && !!dataHygieneCount && <span className="n">{dataHygieneCount}</span>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
