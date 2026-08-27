"use client";

import { Settings, User } from "@prisma/client";
import { SequenceTemplateClient } from "@/types/sequence-template";
import { CadenceSection } from "./CadenceSection";
import { TeamRolesSection } from "./TeamRolesSection";
import { SequenceTemplatesSection } from "./SequenceTemplatesSection";
import { AgoraReplaceSection } from "./AgoraReplaceSection";
import { DangerZoneSection } from "./DangerZoneSection";

export function SettingsClient({
  initialSettings,
  initialTeam,
  initialTemplates,
  currentUserId,
  canEdit,
  isAdmin,
}: {
  initialSettings: Settings;
  initialTeam: User[];
  initialTemplates: SequenceTemplateClient[];
  currentUserId: string;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  return (
    <div>
      <CadenceSection settings={initialSettings} canEdit={canEdit} />
      <TeamRolesSection initialTeam={initialTeam} currentUserId={currentUserId} isAdmin={isAdmin} />
      <SequenceTemplatesSection initialTemplates={initialTemplates} canEdit={canEdit} />
      {isAdmin && <AgoraReplaceSection />}
      {isAdmin && <DangerZoneSection />}
    </div>
  );
}
