import { z } from "zod";

export const SEQUENCE_STEP_TYPES = ["Email", "Call", "LinkedIn", "Other"] as const;

export const sequenceStepSchema = z.object({
  type: z.enum(SEQUENCE_STEP_TYPES),
  title: z.string().trim().min(1),
  waitDays: z.number().int().nonnegative(),
});

export const sequenceTemplateInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  steps: z.array(sequenceStepSchema).min(1, "Add at least one step."),
});

export type SequenceStepInput = z.infer<typeof sequenceStepSchema>;
export type SequenceTemplateInput = z.infer<typeof sequenceTemplateInputSchema>;

export const STARTER_TEMPLATES: SequenceTemplateInput[] = [
  {
    name: "Standard cold outreach",
    steps: [
      { type: "Email", title: "Intro email", waitDays: 0 },
      { type: "Call", title: "Follow-up call", waitDays: 5 },
      { type: "Email", title: "Follow-up email", waitDays: 5 },
      { type: "Other", title: "Final check-in", waitDays: 7 },
    ],
  },
  {
    name: "Conference warm intro",
    steps: [
      { type: "Email", title: "Post-event thank-you", waitDays: 1 },
      { type: "LinkedIn", title: "Connect on LinkedIn", waitDays: 3 },
      { type: "Call", title: "Follow-up call", waitDays: 5 },
    ],
  },
];
