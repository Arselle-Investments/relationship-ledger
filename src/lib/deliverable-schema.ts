import { z } from "zod";

export const deliverableInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    tagMatches: z
      .array(z.string().trim().min(1))
      .transform((arr) => Array.from(new Set(arr)))
      .default([]),
    customFieldKeys: z
      .array(z.string().trim().min(1))
      .transform((arr) => Array.from(new Set(arr.map((k) => k.toUpperCase()))))
      .default([]),
    notes: z.string().optional().default(""),
  })
  .refine((data) => data.tagMatches.length > 0 || data.customFieldKeys.length > 0, {
    message: "Add at least one matching tag or Agora custom field.",
    path: ["tagMatches"],
  });

export type DeliverableInput = z.infer<typeof deliverableInputSchema>;
