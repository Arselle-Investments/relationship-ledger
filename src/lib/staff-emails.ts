import { DEV_TEAM } from "@/lib/dev-team";

// The AI extraction step is told to identify the external sender, not
// anyone on our own team — but for a message that's genuinely internal
// (a teammate's note *about* an investor conversation, with no external
// party actually on the thread), there's nothing external to find, and it
// can end up returning the internal author instead. This guard catches
// that after the fact: a staff email is never accepted as "the contact,"
// whether it came from a header or from the model.
export const STAFF_EMAILS = new Set(DEV_TEAM.map((m) => m.email.toLowerCase()));

export function isStaffEmail(email: string | null | undefined): boolean {
  return !!email && STAFF_EMAILS.has(email.toLowerCase());
}

// Same guard, by name instead of email — a forwarded thread's visible names
// are sometimes ours even when the address the AI/header-parser landed on
// isn't (a team member's display name on an internal note, a reply-all cc),
// so a staff name is never accepted as "the contact" either.
const STAFF_NAMES = new Set(DEV_TEAM.map((m) => m.name.toLowerCase()));

export function isStaffName(name: string | null | undefined): boolean {
  return !!name && STAFF_NAMES.has(name.trim().toLowerCase());
}
