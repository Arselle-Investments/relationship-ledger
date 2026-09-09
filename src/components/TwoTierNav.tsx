"use client";

import { useState } from "react";
import Link from "next/link";

type TabDef = { href: string; label: string };
type SectionDef = { key: string; label: string; tabs: TabDef[] };

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
      { href: "/lookahead", label: "Look Ahead" },
    ],
  },
  {
    key: "fund-raise",
    label: "Fund Raise",
    tabs: [
      { href: "/funnel", label: "Funnel" },
      { href: "/priorities", label: "Priorities" },
      { href: "/stuck-contacts", label: "Going Cold" },
    ],
  },
  {
    key: "deal-capital",
    label: "Deal Capital",
    tabs: [{ href: "/deals", label: "Deals" }],
  },
  {
    key: "data-quality",
    label: "Data Quality",
    tabs: [
      { href: "/inbox", label: "Inbox" },
      { href: "/companies/review", label: "Company Review" },
      { href: "/data-hygiene", label: "Data Hygiene" },
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

function sectionKeyForHref(href: string): string {
  return SECTIONS.find((s) => s.tabs.some((t) => t.href === href))?.key ?? SECTIONS[0].key;
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
  const [activeSection, setActiveSection] = useState(() => sectionKeyForHref(activeHref));
  const section = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0];

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
            onClick={() => setActiveSection(s.key)}
          >
            {s.label}
          </button>
        ))}
        <div className="section-spacer" />
        <Link href="/settings" className={`settings-link ${activeHref === "/settings" ? "active" : ""}`}>
          Settings
        </Link>
      </div>

      <div id="tabs">
        {section.tabs.map((tab) => (
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
