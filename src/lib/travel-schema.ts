import { z } from "zod";

export const travelInputSchema = z.object({
  city: z.string().trim().min(1, "City is required."),
  startDate: z.string().trim().min(1, "Start date is required."),
  endDate: z.string().trim().optional().nullable(),
  notes: z.string().optional().default(""),
});

export type TravelInput = z.infer<typeof travelInputSchema>;
