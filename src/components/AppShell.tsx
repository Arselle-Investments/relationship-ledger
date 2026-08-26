import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Role } from "@prisma/client";

const TABS: { href: string; label: string; enabled: boolean }[] = [
  { href: "/contacts", label: "Contacts", enabled: true },
  { href: "/inbox", label: "Inbox", enabled: true },
  { href: "/followups", label: "Needs follow-up", enabled: true },
  { href: "/lists", label: "Mailing lists", enabled: true },
  { href: "/tasks", label: "Tasks", enabled: true },
  { href: "/events", label: "Conferences & events", enabled: true },
  { href: "/travel", label: "Travel", enabled: true },
  { href: "/funnel", label: "Funnel", enabled: true },
  { href: "/stuck-contacts", label: "Stuck contacts", enabled: true },
  { href: "/priorities", label: "Priorities", enabled: true },
  { href: "/lookahead", label: "Look ahead", enabled: true },
  { href: "/settings", label: "Settings", enabled: true },
];

export function AppShell({
  activeHref,
  user,
  children,
  inboxCount,
}: {
  activeHref: string;
  user: { name?: string | null; email?: string | null; role: Role };
  children: React.ReactNode;
  inboxCount?: number;
}) {
  const canEdit = user.role === Role.ADMIN || user.role === Role.EDITOR;

  return (
    <div id="app">
      <div id="topbar">
        <div id="brand-block">
          <div id="brand-mark">
            <svg viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2L23 22H5L14 2Z" stroke="#F5F7F7" strokeWidth="2.6" strokeLinejoin="round" />
              <path d="M26 10L35 28H17L26 10Z" fill="#F5F7F7" />
            </svg>
          </div>
          <div>
            <h1>Arselle Relationship Ledger</h1>
            <div className="sub">Contacts &middot; mailing lists &middot; outreach &middot; tasks &middot; events &middot; priorities</div>
          </div>
        </div>
        <div id="identity-bar">
          <span className="muted" style={{ fontSize: 13 }}>
            {user.name || user.email}
          </span>
          <div className={`role-pill ${canEdit ? "can-edit" : "view-only"}`}>
            <span className="dot" />
            {user.role === Role.ADMIN ? "Admin" : canEdit ? "Can edit" : "View only"}
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="btn small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div id="tabs">
        {TABS.map((tab) =>
          tab.enabled ? (
            <Link
              key={tab.href}
              href={tab.href}
              className={`tab-btn ${activeHref === tab.href ? "active" : ""}`}
            >
              {tab.label}
              {tab.href === "/inbox" && !!inboxCount && <span className="n">{inboxCount}</span>}
            </Link>
          ) : (
            <span key={tab.href} className="tab-btn disabled" title="Coming in a later phase">
              {tab.label}
            </span>
          )
        )}
      </div>

      {!canEdit && (
        <div className="locked-msg" style={{ marginTop: 22 }}>
          You have view-only access. Ask an admin to grant edit access if you need to add or change records.
        </div>
      )}

      <div className="view">{children}</div>
    </div>
  );
}
