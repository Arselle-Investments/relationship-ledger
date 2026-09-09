"use client";

import { useState } from "react";
import Link from "next/link";

type TabDef = { href: string; label: string };
type SubsectionDef = { key: string; label: string; tabs: TabDef[] };
type SectionDef = { key: string; label: string; tabs?: TabDef[]; subsections?: SubsectionDef[] };

const SECTIONS: SectionDef[] = [
  {
    key: "relationships",
    label: "Relationships",
    tabs: [
      { href: "/contacts", label: "Contacts" },
      { href: "/companies", label: "Companies" },
      { href: "/lists", label: "Mailing Lists" },
    ],
  },
  {
    key: "outreach",
    label: "Outreach",
    tabs: [
      { href: "/followups", label: "Follow-ups" },
      { href: "/tasks", label: "Tasks" },
      { href: "/conferences", label: "Conferences" },
      { href: "/travel", label: "Travel" },
      { href: "/lookahead", label: "Upcoming" },
    ],
  },
  {
    key: "pipeline",
    label: "Pipeline",
    subsections: [
      {
        key: "fund-raise",
        label: "Fund Raise",
        tabs: [
          { href: "/funnel", label: "Funnel" },
          { href: "/target-companies", label: "Target Companies" },
          { href: "/target-contacts", label: "Target Contacts" },
          { href: "/stuck-contacts", label: "Stalled Contacts" },
        ],
      },
      {
        key: "deal-capital",
        label: "Deal Capital",
        tabs: [
          { href: "/deals", label: "Deals" },
          { href: "/deals/recipients", label: "Deal Recipients" },
        ],
      },
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
];

// Data Quality is a utility/hygiene area, not a workflow the team lives in
// day to day — kept as its own tabbed section, but pinned beside Settings
// instead of sitting among the main pills.
const UTILITY_SECTIONS: SectionDef[] = [
  {
    key: "data-quality",
    label: "Data Quality",
    tabs: [
      { href: "/inbox", label: "Inbox" },
      { href: "/companies/review", label: "Company Review" },
      { href: "/data-hygiene", label: "Data Hygiene" },
    ],
  },
];

const ALL_SECTIONS = [...SECTIONS, ...UTILITY_SECTIONS];

function locate(href: string): { sectionKey: string; subsectionKey?: string } {
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
  companyReviewCount,
  dataHygieneCount,
}: {
  activeHref: string;
  inboxCount?: number;
  companyReviewCount?: number;
  dataHygieneCount?: number;
}) {
  const initialLocation = locate(activeHref);
  const [activeSection, setActiveSection] = useState(initialLocation.sectionKey);
  const [activeSubsection, setActiveSubsection] = useState(
    initialLocation.subsectionKey ?? ALL_SECTIONS.find((s) => s.key === initialLocation.sectionKey)?.subsections?.[0]?.key
  );

  const section = ALL_SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0];
  const subsection = section.subsections?.find((ss) => ss.key === activeSubsection) ?? section.subsections?.[0];
  const tabs = section.subsections ? subsection?.tabs ?? [] : section.tabs ?? [];

  function selectSection(s: SectionDef) {
    setActiveSection(s.key);
    setActiveSubsection(s.subsections?.[0]?.key);
  }

  return (
    <>
      <div id="section-row">
        <Link href="/" className={`settings-link ${activeHref === "/" ? "active" : ""}`} style={{ marginRight: 4 }}>
          Home
        </Link>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`section-pill ${activeSection === s.key ? "active" : ""}`}
            onClick={() => selectSection(s)}
          >
            {s.label}
          </button>
        ))}
        <div className="section-spacer" />
        {UTILITY_SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`section-pill ${activeSection === s.key ? "active" : ""}`}
            onClick={() => selectSection(s)}
          >
            {s.label}
          </button>
        ))}
        <Link href="/settings" className={`settings-link ${activeHref === "/settings" ? "active" : ""}`}>
          Settings
        </Link>
      </div>

      {section.subsections && (
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

      <div id="tabs">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={`tab-btn ${activeHref === tab.href ? "active" : ""}`}>
            {tab.label}
            {tab.href === "/inbox" && !!inboxCount && <span className="n">{inboxCount}</span>}
            {tab.href === "/companies/review" && !!companyReviewCount && <span className="n">{companyReviewCount}</span>}
            {tab.href === "/data-hygiene" && !!dataHygieneCount && <span className="n">{dataHygieneCount}</span>}
          </Link>
        ))}
      </div>
    </>
  );
}
