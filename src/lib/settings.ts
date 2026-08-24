import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "singleton";

export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.settings.create({ data: { id: SETTINGS_ID } });
}

export async function updateSettings(data: { defaultCadenceDays?: number; staleDays?: number }) {
  await getSettings(); // ensure the row exists
  return prisma.settings.update({ where: { id: SETTINGS_ID }, data });
}
