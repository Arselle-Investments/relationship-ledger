// Tags that only show up in real HTML — checked so a plain-text body that merely
// contains "<name@example.com>" is left alone rather than having it stripped.
const HTML_TAG = /<\/?(?:html|body|div|p|br|span|table|tr|td|ul|ol|li|a|b|i|u|strong|em|h[1-6]|img|font|blockquote|style)\b[^>]*>/i;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
};

function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, dec, hex, name) => {
    if (dec || hex) {
      const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? match;
  });
}

/**
 * Turns the HTML body Power Automate hands over for a forwarded email into the
 * readable text it displays as — paragraph and line breaks kept, tags, styles
 * and mail-client filler removed. A body with no HTML in it comes back as-is.
 */
export function htmlToText(input: string): string {
  if (!HTML_TAG.test(input)) return input;
  return decodeEntities(
    input
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      // Hidden preheader text marketing emails stuff with filler characters.
      .replace(/<(\w+)[^>]*display:\s*none[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|tr|li|h[1-6]|table|blockquote)>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " ")
      .replace(/<[^>]+>/g, ""),
  )
    // Zero-width / soft-hyphen filler, then tidy whitespace.
    .replace(/[­͏​-‏⁠﻿]/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
