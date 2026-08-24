import { SequenceStepInput } from "@/lib/sequence-template-schema";

export type SequenceStepState = {
  type: string;
  title: string;
  dueDate: string; // ISO yyyy-mm-dd
  done: boolean;
  doneDate: string | null;
};

export type ActiveSequence = {
  templateId: string;
  templateName: string;
  startDate: string;
  completed: boolean;
  steps: SequenceStepState[];
};

/** Cumulative offset from startISO, independent of later template edits — matches the reference prototype. */
export function computeSequenceSteps(templateSteps: SequenceStepInput[], startISO: string): SequenceStepState[] {
  let cumulative = 0;
  return templateSteps.map((s) => {
    cumulative += s.waitDays || 0;
    const d = new Date(startISO + "T00:00:00");
    d.setDate(d.getDate() + cumulative);
    return { type: s.type, title: s.title, dueDate: d.toISOString().slice(0, 10), done: false, doneDate: null };
  });
}

export function nextPendingSequenceStep(seq: ActiveSequence | null): SequenceStepState | null {
  if (!seq || seq.completed) return null;
  return seq.steps.find((s) => !s.done) ?? null;
}

/** Marks the next pending step done; returns the updated sequence (caller also bumps lastContact). */
export function markNextSequenceStepDone(seq: ActiveSequence, today: string): ActiveSequence {
  const idx = seq.steps.findIndex((s) => !s.done);
  if (idx < 0) return seq;
  const steps = seq.steps.map((s, i) => (i === idx ? { ...s, done: true, doneDate: today } : s));
  return { ...seq, steps, completed: steps.every((s) => s.done) };
}

export type ContactWithActiveSequence = { id: string; activeSequence: unknown };

export type OverdueSequenceContact<T extends ContactWithActiveSequence> = T & { step: SequenceStepState };

/** Contacts on an active sequence whose next pending step's due date has passed. */
export function getOverdueSequenceContacts<T extends ContactWithActiveSequence>(
  contacts: T[],
  today: string = new Date().toISOString().slice(0, 10)
): OverdueSequenceContact<T>[] {
  return contacts.flatMap((c) => {
    const step = nextPendingSequenceStep(c.activeSequence as ActiveSequence | null);
    return step && step.dueDate < today ? [{ ...c, step }] : [];
  });
}

/** Contacts on an active sequence whose next pending step falls within the window but isn't overdue yet. */
export function getUpcomingSequenceItems<T extends ContactWithActiveSequence>(
  contacts: T[],
  windowEnd: string,
  today: string = new Date().toISOString().slice(0, 10)
): OverdueSequenceContact<T>[] {
  return contacts
    .flatMap((c) => {
      const step = nextPendingSequenceStep(c.activeSequence as ActiveSequence | null);
      return step && step.dueDate >= today && step.dueDate <= windowEnd ? [{ ...c, step }] : [];
    })
    .sort((a, b) => a.step.dueDate.localeCompare(b.step.dueDate));
}
