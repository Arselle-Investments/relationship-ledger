import { z } from "zod";

export const inboundMessageSchema = z.object({
  subject: z.string().trim().optional().nullable(),
  bodyText: z.string().trim().min(1, "bodyText is required."),
  // The email's To/Cc header line(s), when the sender passes them along. A
  // channel post's body doesn't carry them for mail we sent, but they're in
  // the saved .eml, and they're how we tell who the message went to.
  // Preferred over to/cc: the saved .eml itself, base64-encoded. The headers
  // (From/To/Cc) are parsed here, so the sender doesn't have to extract them.
  emlBase64: z.string().optional().nullable(),
  to: z.string().trim().optional().nullable(),
  cc: z.string().trim().optional().nullable(),
  receivedAt: z.string().trim().optional().nullable(),
  messageId: z.string().trim().optional().nullable(),
});

export type InboundMessageInput = z.infer<typeof inboundMessageSchema>;
