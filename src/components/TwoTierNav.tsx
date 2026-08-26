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
      { href: "/lists", label: "Mailing Lists" },
    ],
  },
  {
    key: "outreach",
    label: "Outreach",
    tabs: [
      { href: "/followups", label: "Follow-ups" },
      { href: "/tasks", label: "Tasks" },
      { href: "/events", label: "Events" },
      { href: "/travel", label: "Travel" },
      { href: "/lookahead", label: "Look Ahead" },
    ],
  },
  {
    key: "diligence",
    label: "Diligence",
    tabs: [
      { href: "/funnel", label: "Funnel" },
      { href: "/priorities", label: "Priorities" },
      { href: "/stuck-contacts", label: "Going Cold" },
    ],
  },
  {
    key: "connectors",
    label: "Connectors",
    tabs: [{ href: "/inbox", label: "Inbox" }],
  },
];

function sectionKeyForHref(href: string): string {
  return SECTIONS.find((s) => s.tabs.some((t) => t.href === href))?.key ?? SECTIONS[0].key;
}

export function TwoTierNav({ activeHref, inboxCount }: { activeHref: string; inboxCount?: number }) {
  const [activeSection, setActiveSection] = useState(() => sectionKeyForHref(activeHref));
  const section = SECTIONS.find((s) => s.key === activeSection) ?? SECTIONS[0];

  return (
    <>
      <div id="section-row">
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
          </Link>
        ))}
      </div>
    </>
  );
}
