import Anthropic from "@anthropic-ai/sdk";
import { CONTACT_STATUS_LABELS } from "@/lib/contact-constants";
import { ContactStatus } from "@prisma/client";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
    client = new Anthropic({ apiKey });
  }
  return client;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

export type ExtractedContact = {
  name: string | null;
  email: string | null;
  org: string | null;
};

const EXTRACT_TOOL = {
  name: "extracted_contact",
  description: "The sender's identity extracted from an email/message.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: ["string", "null"], description: "Sender's full name, or null if not determinable." },
      email: { type: ["string", "null"], description: "Sender's email address, or null if not present." },
      org: { type: ["string", "null"], description: "Sender's organization/company, or null if not determinable." },
    },
    required: ["name", "email", "org"],
  },
};

/**
 * Reads an inbound message (subject + body, typically a forwarded email) and
 * extracts the external sender's identity so it can be matched against an
 * existing contact or proposed as a new one. Never writes anything itself —
 * callers decide what to do with the result.
 */
export async function extractContactFromMessage(subject: string, bodyText: string): Promise<ExtractedContact> {
  const anthropic = getClient();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "extracted_contact" },
    messages: [
      {
        role: "user",
        content: `This is a message forwarded into a shared team inbox. Identify the EXTERNAL sender (not anyone at our own company) — their name, email, and organization if mentioned. If this is a reply chain, use the most recent external sender.\n\nSubject: ${subject}\n\nBody:\n${bodyText.slice(0, 8000)}`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { name: null, email: null, org: null };
  }
  const input = toolUse.input as ExtractedContact;
  return {
    name: input.name || null,
    email: input.email || null,
    org: input.org || null,
  };
}

export type StageSignal = {
  suggestedStatus: ContactStatus | null;
  rationale: string | null;
};

const STATUS_VALUES = Object.values(ContactStatus);

const STAGE_SIGNAL_TOOL = {
  name: "stage_signal",
  description: "Whether a message signals the contact has moved to a new pipeline stage.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestedStatus: {
        type: ["string", "null"],
        enum: [...STATUS_VALUES, null],
        description:
          "The pipeline stage this message suggests, or null if the message doesn't clearly signal any stage change (e.g. a routine check-in with no new information).",
      },
      rationale: {
        type: ["string", "null"],
        description: "One short sentence on why, quoting or paraphrasing the specific line that signals it. Null if suggestedStatus is null.",
      },
    },
    required: ["suggestedStatus", "rationale"],
  },
};

/**
 * Reads one new message against a contact's current stage and recent history,
 * and proposes a stage change if the content clearly signals one. Deliberately
 * conservative — returns null rather than guessing when a message is
 * ambiguous, since a wrong suggestion is worse than no suggestion (a human
 * still confirms every non-null result before anything on the contact
 * actually changes).
 */
export async function classifyStageSignal(params: {
  currentStatus: ContactStatus;
  recentHistory: string; // short plain-text summary of recent stage changes, if any
  subject: string;
  bodyText: string;
}): Promise<StageSignal> {
  const anthropic = getClient();
  const statusList = STATUS_VALUES.map((s) => `${s} (${CONTACT_STATUS_LABELS[s]})`).join(", ");
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [STAGE_SIGNAL_TOOL],
    tool_choice: { type: "tool", name: "stage_signal" },
    messages: [
      {
        role: "user",
        content: `You're tracking an LP/investor's position in a fundraising pipeline. The possible stages are: ${statusList}.

This contact's current stage: ${params.currentStatus} (${CONTACT_STATUS_LABELS[params.currentStatus]}).
${params.recentHistory ? `Recent history: ${params.recentHistory}` : "No prior stage history."}

A new message just came in from them. Does it clearly signal a move to a different stage? Only suggest a change if the message content itself makes it evident (e.g. explicitly scheduling a meeting, confirming a commitment, passing) — don't guess from a vague or routine message.

Subject: ${params.subject}

Body:
${params.bodyText.slice(0, 8000)}`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return { suggestedStatus: null, rationale: null };
  const input = toolUse.input as StageSignal;
  const suggestedStatus = input.suggestedStatus && STATUS_VALUES.includes(input.suggestedStatus) ? input.suggestedStatus : null;
  return {
    suggestedStatus: suggestedStatus === params.currentStatus ? null : suggestedStatus,
    rationale: suggestedStatus ? input.rationale : null,
  };
}
