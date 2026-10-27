import { Contact } from "@prisma/client";
import { hasRealEmailForAgora } from "@/lib/followups";

type SyncFields = Pick<Contact, "email" | "agoraExportedAt" | "agoraChangesSyncedAt" | "updatedAt">;

/**
 * Where a contact stands relative to Agora, shared by the Agora Sync page's
 * counts/preview and the export routes so they can never disagree:
 *  - "new": never sent to Agora
 *  - "changed": already sent, and touched here since it was last sent
 *    (updatedAt newer than agoraChangesSyncedAt, or agoraExportedAt if it
 *    has never been change-synced) — any field, not a whitelist
 *  - "synced": already sent and untouched since
 */
export function agoraSyncState(c: SyncFields): "new" | "changed" | "synced" {
  if (!c.agoraExportedAt) return "new";
  const lastSent = c.agoraChangesSyncedAt ?? c.agoraExportedAt;
  return c.updatedAt > lastSent ? "changed" : "synced";
}

/** Agora needs a real email to import a contact at all (see hasRealEmailForAgora). */
export function isExportableToAgora(c: Pick<Contact, "email">): boolean {
  return hasRealEmailForAgora(c.email);
}
