import { prisma } from "@/lib/prisma";
import { FundraisingStage, Prisma } from "@prisma/client";

const SETTINGS_ID = "singleton";

export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.settings.create({ data: { id: SETTINGS_ID } });
}

export async function updateSettings(data: {
  defaultCadenceDays?: number;
  staleDays?: number;
  stuckDays?: number;
  autoApplyStageSuggestions?: boolean;
  // Always a full replacement object (possibly empty, meaning "reset every
  // stage to its default label") — never null, so there's no ambiguity
  // between "leave alone" and Prisma's DbNull/JsonNull for a Json? column.
  funnelStageLabels?: Partial<Record<FundraisingStage, string>>;
  // string[] to set a revised template, or null to reset to the built-in
  // default — unlike funnelStageLabels, null is a meaningful choice here, so
  // it's passed through as Prisma.DbNull rather than omitted.
  agoraContactTemplateHeaders?: string[] | null;
}) {
  await getSettings(); // ensure the row exists
  const { agoraContactTemplateHeaders, ...rest } = data;
  return prisma.settings.update({
    where: { id: SETTINGS_ID },
    data: {
      ...rest,
      funnelStageLabels: rest.funnelStageLabels as Prisma.InputJsonValue | undefined,
      ...(agoraContactTemplateHeaders !== undefined
        ? { agoraContactTemplateHeaders: agoraContactTemplateHeaders ?? Prisma.DbNull }
        : {}),
    },
  });
}
