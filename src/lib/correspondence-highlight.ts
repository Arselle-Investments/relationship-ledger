// The raw first few hundred characters of a forwarded/suggested message are
// usually boilerplate — a greeting, a quoted subject line, an email client's
// "On ... wrote:" header — not the part that actually tells the team why
// this message matters. This looks for the sentence that signals a genuine
// new interaction (a first meeting, an introduction, someone sharing their
// own contact details) so that's what surfaces on the Inbox card instead.
const HIGHLIGHT_KEYWORDS = [
  "nice to meet",
  "nice meeting",
  "great meeting",
  "great connecting",
  "nice connecting",
  "good connecting",
  "great to meet",
  "good to meet",
  "pleasure meeting",
  "pleasure to meet",
  "enjoyed meeting",
  "enjoyed connecting",
  "wanted to introduce",
  "let me introduce",
  "i'd like to introduce",
  "introduce you to",
  "introducing you to",
  "please meet",
  "meet my colleague",
  "here is my contact",
  "here's my contact",
  "attached is my",
  "attached my",
  "my contact info",
  "my contact information",
  "please save my",
  "save my contact",
  "my card",
  "reaching out to introduce",
  "following up from",
  "following up after",
  "meeting you at",
  "connecting after",
  "wanted to connect",
  "looking forward to connecting",
  "look forward to staying in touch",
];

const THREAD_BREAK_RE = /^(on .{0,80} wrote:|-{2,}\s*original message\s*-{2,}|from:\s|>)/i;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns the most relevant "this is a new interaction" sentence in a
 * message body, or null if nothing matched — callers should fall back to a
 * plain preview in that case.
 */
export function extractHighlight(bodyText: string): string | null {
  const lines = bodyText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !THREAD_BREAK_RE.test(l));
  const sentences = splitSentences(lines.join(" "));

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (HIGHLIGHT_KEYWORDS.some((k) => lower.includes(k))) {
      return sentence.length > 320 ? `${sentence.slice(0, 317)}…` : sentence;
    }
  }
  return null;
}
