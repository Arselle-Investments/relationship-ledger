import { RecordContext } from "@prisma/client";

export const RECORD_CONTEXT_LABELS: Record<RecordContext, string> = {
  FUND: "Fund",
  DEAL: "Deal",
};

export const RECORD_CONTEXT_TAG_CLASS: Record<RecordContext, string> = {
  FUND: "forest",
  DEAL: "brass",
};
