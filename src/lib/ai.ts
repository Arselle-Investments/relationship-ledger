import Anthropic from "@anthropic-ai/sdk";

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
