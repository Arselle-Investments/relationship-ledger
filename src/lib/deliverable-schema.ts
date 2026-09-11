import { z } from "zod";

export const deliverableInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  tagMatches: z
    .array(z.string().trim().min(1))
    .min(1, "Add at least one tag to match on.")
    .transform((arr) => Array.from(new Set(arr))),
  notes: z.string().optional().default(""),
});

export type DeliverableInput = z.infer<typeof deliverableInputSchema>;
