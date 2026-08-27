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
// Structured extraction and classification below both force a tool call with
// a small, fixed schema — there's no open-ended writing for a bigger model to
// do better at, so a much cheaper/faster model handles them just as
// reliably. Reserve the full model for the drafting/research functions
// further down, where writing quality and web-search reasoning matter.
const FAST_MODEL = process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-4-5-20251001";

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
    model: FAST_MODEL,
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
    model: FAST_MODEL,
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

/**
 * Drafts a short, low-pressure check-in email for a contact that's gone quiet
 * in their current stage. Plain text, no tool-use needed — this is meant to
 * be read and edited by a person before sending, not sent automatically.
 */
export async function draftCheckInEmail(params: {
  name: string;
  org: string | null;
  status: ContactStatus;
  daysInStage: number;
  notes: string | null;
}): Promise<string> {
  const anthropic = getClient();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `Draft a short, warm, low-pressure check-in email to an LP/investor contact who's gone quiet. Write only the email body (no subject line, no placeholders like [Your Name] — sign off simply as "Best,"). Keep it under 120 words, no hard sell.

Contact: ${params.name}${params.org ? `, ${params.org}` : ""}
Current pipeline stage: ${CONTACT_STATUS_LABELS[params.status]}
Time with no movement in this stage: ${params.daysInStage} days
${params.notes ? `Latest notes on file: ${params.notes}` : ""}`,
      },
    ],
  });
  const textBlock = message.content.find((c) => c.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
}

/**
 * Drafts a short "I'll be in town" email for a contact based in a city a
 * team member is about to visit. Same philosophy as the check-in draft:
 * plain text, meant to be read and edited before sending, never sent
 * automatically.
 */
export async function draftTravelOutreachEmail(params: {
  contactName: string;
  contactOrg: string | null;
  travelerName: string;
  city: string;
  startDate: string;
  endDate: string;
}): Promise<string> {
  const anthropic = getClient();
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `Draft a short, warm email from ${params.travelerName} to an LP/investor contact, letting them know ${params.travelerName} will be in the contact's city and proposing to meet up. Write only the email body (no subject line, no placeholders like [Your Name] — sign off simply as "Best,"). Keep it under 100 words, casual and low-pressure, not a sales pitch.

Contact: ${params.contactName}${params.contactOrg ? `, ${params.contactOrg}` : ""}
City: ${params.city}
Dates ${params.travelerName} will be there: ${params.startDate} to ${params.endDate}`,
      },
    ],
  });
  const textBlock = message.content.find((c) => c.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
}

export type ContactNewsItem = {
  title: string;
  url: string;
  date: string | null;
  summary: string;
};

export type ContactResearch = {
  bio: string | null;
  bioSource: string | null;
  news: ContactNewsItem[];
};

const RESEARCH_TOOL = {
  name: "contact_research",
  description: "Structured research findings about a person, extracted from web search results.",
  input_schema: {
    type: "object" as const,
    properties: {
      bio: {
        type: ["string", "null"],
        description:
          "2-4 sentence professional bio/background snippet (current role, firm, relevant experience). Null if nothing credible was found for this specific person.",
      },
      bioSource: { type: ["string", "null"], description: "URL the bio was drawn from. Null if bio is null." },
      news: {
        type: "array",
        description: "Recent news articles or press mentions specifically about this person, most recent first. Empty array if none found.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            date: { type: ["string", "null"], description: "Approximate publish date as YYYY-MM-DD, or null if unknown." },
            summary: { type: "string", description: "One sentence on what the article/mention says." },
          },
          required: ["title", "url", "date", "summary"],
        },
      },
    },
    required: ["bio", "bioSource", "news"],
  },
};

/**
 * Looks up a contact's public footprint on the open web — a short bio snippet
 * (firm site or another public bio page) and any recent news mentioning them
 * by name — so the team has more context and connection points before a
 * conversation. Deliberately two-pass: the first call lets Claude search
 * freely and reason in prose (server-side web search doesn't mix well with a
 * forced tool call), the second extracts that prose into a strict schema. On
 * a name with no public presence this correctly comes back empty rather than
 * inventing something — coverage is expected to be uneven across contacts.
 */
export async function researchContact(params: {
  name: string;
  org: string | null;
  city: string | null;
}): Promise<ContactResearch> {
  const anthropic = getClient();

  const searchStep = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
    messages: [
      {
        role: "user",
        content: `Research this person using web search. Find:
1. A short professional bio/background — current role, firm, and relevant experience — ideally from their firm's website or another credible public bio page.
2. Any recent news articles or press mentions specifically about them (not just general news about their firm).

Person: ${params.name}${params.org ? `, ${params.org}` : ""}${params.city ? ` (based in ${params.city})` : ""}

Report what you find, with source URLs. If you can't confidently find this specific person — e.g. the name is too common and results are ambiguous, or there's no public presence — say so clearly rather than guessing or substituting someone else with a similar name.`,
      },
    ],
  });
  const findingsText = searchStep.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("\n\n");

  const extractStep = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    tools: [RESEARCH_TOOL],
    tool_choice: { type: "tool", name: "contact_research" },
    messages: [
      {
        role: "user",
        content: `Extract structured findings from this research summary about ${params.name}. Only include information clearly about this specific person — discard anything uncertain, generic, or about someone else with a similar name.\n\n${
          findingsText || "No findings — the search returned nothing usable."
        }`,
      },
    ],
  });
  const toolUse = extractStep.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return { bio: null, bioSource: null, news: [] };
  const input = toolUse.input as ContactResearch;
  return {
    bio: input.bio || null,
    bioSource: input.bioSource || null,
    news: Array.isArray(input.news) ? input.news.slice(0, 5) : [],
  };
}
