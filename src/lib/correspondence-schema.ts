import { z } from "zod";

export const inboundMessageSchema = z.object({
  subject: z.string().trim().optional().nullable(),
  bodyText: z.string().trim().min(1, "bodyText is required."),
  receivedAt: z.string().trim().optional().nullable(),
  messageId: z.string().trim().optional().nullable(),
});

export type InboundMessageInput = z.infer<typeof inboundMessageSchema>;
