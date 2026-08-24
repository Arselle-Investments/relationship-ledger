import { SequenceStepInput } from "@/lib/sequence-template-schema";

export type SequenceTemplateClient = {
  id: string;
  name: string;
  steps: SequenceStepInput[];
};
