import Anthropic from "@anthropic-ai/sdk";
import { FUNDRAISING_STAGE_LABELS } from "@/lib/contact-constants";
import { formatDateRange } from "@/lib/travel-templates";
import { FundraisingStage } from "@prisma/client";

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
      name: { type: ["string", "null"], description: "Sender's full name, or null if not determinable. Never the literal word \"unknown\" — use null instead." },
      email: { type: ["string", "null"], description: "Sender's email address, or null if not present. Never the literal word \"unknown\" — use null instead." },
      org: {
        type: ["string", "null"],
        description:
          "Sender's own organization/company, or null if not determinable. Never Arselle Investments (or any name/variant for our own firm) — that's whoever forwarded the message, not the sender's org. Never the literal word \"unknown\" — use null instead.",
      },
    },
    required: ["name", "email", "org"],
  },
};

// Guards against the two failure modes seen in practice: the model returning
// the literal word "unknown" instead of null, and (for a forwarded internal
// email) returning our own firm's name as the external sender's org, since
// "Arselle Investments" is usually just what's in the email signature of
// whoever forwarded it, not the actual sender's employer.
const JUNK_VALUE_RE = /^unknown$|^n\/?a$/i;
const OWN_FIRM_RE = /arselle/i;

function sanitizeExtracted(value: string | null): string | null {
  if (!value || JUNK_VALUE_RE.test(value.trim())) return null;
  return value;
}

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
        content: `This is a message forwarded into a shared team inbox. Identify the EXTERNAL sender (not anyone at our own company, Arselle Investments) — their name, email, and organization if mentioned. If this is a reply chain, use the most recent external sender. Never return "Arselle Investments" as the org — that's our own firm, not theirs. If a field genuinely can't be determined, use null, never the word "unknown".\n\nSubject: ${subject}\n\nBody:\n${bodyText.slice(0, 8000)}`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { name: null, email: null, org: null };
  }
  const input = toolUse.input as ExtractedContact;
  const org = sanitizeExtracted(input.org || null);
  return {
    name: sanitizeExtracted(input.name || null),
    email: sanitizeExtracted(input.email || null),
    org: org && OWN_FIRM_RE.test(org) ? null : org,
  };
}

export type StageSignal = {
  suggestedStatus: FundraisingStage | null;
  rationale: string | null;
};

const STATUS_VALUES = Object.values(FundraisingStage);

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
  currentStatus: FundraisingStage;
  recentHistory: string; // short plain-text summary of recent stage changes, if any
  subject: string;
  bodyText: string;
}): Promise<StageSignal> {
  const anthropic = getClient();
  const statusList = STATUS_VALUES.map((s) => `${s} (${FUNDRAISING_STAGE_LABELS[s]})`).join(", ");
  const message = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 512,
    tools: [STAGE_SIGNAL_TOOL],
    tool_choice: { type: "tool", name: "stage_signal" },
    messages: [
      {
        role: "user",
        content: `You're tracking an LP/investor's position in a fundraising pipeline. The possible stages are: ${statusList}.

Important stage definitions:
- DUE_DILIGENCE specifically means the LP has been sent an NDA to execute and/or been given access to a data room. Don't suggest this stage just because someone said they're "looking into it" or "reviewing" the deal — that's still ACTIVE_PROSPECT unless the message explicitly mentions an NDA or data room access.
- PASSED_OPEN means they declined this specific deal but remain open to future ones (a soft no).
- PASSED_NOT_INTERESTED means a genuine, unambiguous no — not just declining one deal, but signaling they don't want to hear about future ones either.
- DO_NOT_CONTACT is stronger than PASSED_NOT_INTERESTED — only suggest it when the message explicitly asks to stop being contacted (e.g. "please remove me from your list," "do not email me again"), not just a firm no on the fund.

This contact's current stage: ${params.currentStatus} (${FUNDRAISING_STAGE_LABELS[params.currentStatus]}).
${params.recentHistory ? `Recent history: ${params.recentHistory}` : "No prior stage history."}

A new message just came in from them. Does it clearly signal a move to a different stage? Only suggest a change if the message content itself makes it evident (e.g. explicitly scheduling a meeting, confirming a commitment, mentioning an NDA or data room, passing) — don't guess from a vague or routine message.

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
  status: FundraisingStage;
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
Current pipeline stage: ${FUNDRAISING_STAGE_LABELS[params.status]}
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
        content: `Draft a short, professional-but-warm email written in the first person, as if ${params.travelerName} is writing it themselves, letting an LP/investor contact know they'll be in the contact's city and proposing to meet up. Write in first person ("I'll be in town...", never "${params.travelerName} will be..."). Write only the email body (no subject line, no placeholders like [Your Name] — sign off simply as "Best,"). Keep it under 100 words, warm but professional — not overly casual, and not a sales pitch.

Contact: ${params.contactName}${params.contactOrg ? `, ${params.contactOrg}` : ""}
City: ${params.city}
Dates ${params.travelerName} will be there: ${formatDateRange(params.startDate, params.endDate)}`,
      },
    ],
  });
  const textBlock = message.content.find((c) => c.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
}

export type ConferenceRefreshResult = {
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  location: string | null;
  registrationStatus: string | null;
  registrationLink: string | null;
  registrationOpensAt: string | null; // YYYY-MM-DD
  dateConfidence: string | null;
  fitNote: string | null;
  summary: string | null; // one-line human summary of what changed / was confirmed
};

const CONFERENCE_REFRESH_TOOL = {
  name: "conference_refresh",
  description: "Updated conference details extracted from its registration page, compared against what's currently on file.",
  input_schema: {
    type: "object" as const,
    properties: {
      startDate: { type: ["string", "null"], description: "The conference's start date as YYYY-MM-DD, only if it's different from what's on file. Null if unchanged or not stated." },
      endDate: { type: ["string", "null"], description: "The conference's end date as YYYY-MM-DD, only if it's different from what's on file. Null if unchanged, a single-day event, or not stated." },
      location: { type: ["string", "null"], description: "Venue/city, only if the page states one. Null if not found or unchanged from what's on file." },
      registrationStatus: {
        type: ["string", "null"],
        description: "Short freeform status, e.g. 'Registration open', 'Registration not yet open', 'Sold out', 'Waitlist only'. Null if the page gives no clear signal.",
      },
      registrationLink: { type: ["string", "null"], description: "The direct registration/signup URL if the page links to one distinct from the page checked. Null otherwise." },
      registrationOpensAt: { type: ["string", "null"], description: "Date registration opens/opened, as YYYY-MM-DD. Null if not stated." },
      dateConfidence: {
        type: ["string", "null"],
        description: "One short phrase on how confident the page's information seems, e.g. 'Confirmed on official site', 'Date not yet announced'. Null if nothing to note.",
      },
      fitNote: { type: ["string", "null"], description: "Null unless the page reveals something relevant to whether this fits Arselle's outreach (audience, theme). Otherwise null." },
      summary: { type: ["string", "null"], description: "One short sentence a human can scan to see what's new or confirmed. Null if nothing found." },
    },
    required: [
      "startDate",
      "endDate",
      "location",
      "registrationStatus",
      "registrationLink",
      "registrationOpensAt",
      "dateConfidence",
      "fitNote",
      "summary",
    ],
  },
};

/**
 * Reads a conference's registration page (already fetched and stripped to
 * text by the caller) and extracts anything that looks new or changed versus
 * what's currently on file. Never applies anything itself — the caller
 * surfaces this as a suggestion for a human to accept or dismiss field by
 * field, same as every other AI-assisted feature in this app.
 */
export async function refreshConferenceInfo(params: {
  conferenceName: string;
  currentStartDate: string; // YYYY-MM-DD
  currentEndDate: string; // YYYY-MM-DD
  currentLocation: string | null;
  currentRegistrationStatus: string | null;
  pageUrl: string;
  pageText: string;
}): Promise<ConferenceRefreshResult> {
  const anthropic = getClient();
  const message = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 700,
    tools: [CONFERENCE_REFRESH_TOOL],
    tool_choice: { type: "tool", name: "conference_refresh" },
    messages: [
      {
        role: "user",
        content: `This is the text content of a conference's registration/info page. Compare it against what we currently have on file and report only what's new, changed, or newly confirmed. Leave a field null if the page doesn't say anything different from what's already on file, or doesn't mention it at all.

Conference: ${params.conferenceName}
Page checked: ${params.pageUrl}
Currently on file — dates: ${params.currentStartDate} to ${params.currentEndDate}, location: ${params.currentLocation ?? "(none)"}, registration status: ${params.currentRegistrationStatus ?? "(none)"}

Page text:
${params.pageText.slice(0, 12000)}`,
      },
    ],
  });
  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return {
      startDate: null,
      endDate: null,
      location: null,
      registrationStatus: null,
      registrationLink: null,
      registrationOpensAt: null,
      dateConfidence: null,
      fitNote: null,
      summary: null,
    };
  }
  const input = toolUse.input as ConferenceRefreshResult;
  return {
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    location: input.location || null,
    registrationStatus: input.registrationStatus || null,
    registrationLink: input.registrationLink || null,
    registrationOpensAt: input.registrationOpensAt || null,
    dateConfidence: input.dateConfidence || null,
    fitNote: input.fitNote || null,
    summary: input.summary || null,
  };
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

export type CompanyResearch = {
  website: string | null;
  linkedinUrl: string | null;
  aum: string | null;
  founded: string | null;
  blurb: string | null;
};

const COMPANY_RESEARCH_TOOL = {
  name: "company_research",
  description: "Structured research findings about a company/investment firm, extracted from web search results.",
  input_schema: {
    type: "object" as const,
    properties: {
      website: { type: ["string", "null"], description: "The firm's official website URL. Null if not confidently found." },
      linkedinUrl: { type: ["string", "null"], description: "The firm's LinkedIn company page URL. Null if not found." },
      aum: {
        type: ["string", "null"],
        description: "Assets under management, as free text (e.g. '~$10B+'). Null if not publicly disclosed or not found.",
      },
      founded: { type: ["string", "null"], description: "Year founded, as free text. Null if not found." },
      blurb: {
        type: ["string", "null"],
        description: "1-3 sentence description of what the firm does/invests in. Null if nothing credible was found.",
      },
    },
    required: ["website", "linkedinUrl", "aum", "founded", "blurb"],
  },
};

/**
 * Same idea as researchContact, for a company/firm name instead of a person —
 * used to pre-fill a draft when creating a new Company record from an org
 * string the team already has on file. Same two-pass shape and the same
 * "come back empty rather than guess" contract on a name with no public
 * presence or too ambiguous to resolve confidently.
 */
export async function researchCompany(params: { name: string; city: string | null }): Promise<CompanyResearch> {
  const anthropic = getClient();

  const searchStep = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
    messages: [
      {
        role: "user",
        content: `Research this investment firm/company using web search. Find its official website, LinkedIn company page, assets under management (AUM) if publicly disclosed, year founded, and a short description of what it invests in or does.

Company: ${params.name}${params.city ? ` (based in ${params.city})` : ""}

Report what you find, with source URLs. If you can't confidently find this specific firm — e.g. the name is too generic/common and results are ambiguous — say so clearly rather than guessing or substituting a different firm with a similar name.`,
      },
    ],
  });
  const findingsText = searchStep.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("\n\n");

  const extractStep = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    tools: [COMPANY_RESEARCH_TOOL],
    tool_choice: { type: "tool", name: "company_research" },
    messages: [
      {
        role: "user",
        content: `Extract structured findings from this research summary about ${params.name}. Only include information clearly about this specific firm — discard anything uncertain, generic, or about a different firm with a similar name.\n\n${
          findingsText || "No findings — the search returned nothing usable."
        }`,
      },
    ],
  });
  const toolUse = extractStep.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return { website: null, linkedinUrl: null, aum: null, founded: null, blurb: null };
  const input = toolUse.input as CompanyResearch;
  return {
    website: input.website || null,
    linkedinUrl: input.linkedinUrl || null,
    aum: input.aum || null,
    founded: input.founded || null,
    blurb: input.blurb || null,
  };
}

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
