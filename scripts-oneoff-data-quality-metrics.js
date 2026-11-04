const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BOGUS_EMAIL_PATTERNS = [
  /tbd/i, /needsemail/i, /needemail/i, /noemail/i, /no-email/i, /^n\/?a@/i,
  /unknown/i, /placeholder/i, /^test@/i, /@test\./i, /@example\./i, /^none@/i,
  /@none\./i, /(.)\1{4,}@/i, /^n\.?a\.?@/i, /donotcontact/i, /^n_a@/i, /^na@/i,
  /@n-a\./i, /notprovided/i, /notgiven/i, /pending@/i, /@pending\./i, /dummy/i,
  /fake@/i, /sample@/i, /nomail/i, /emailtbd/i, /getemail/i,
];
function isBogusEmail(email) {
  return !!email && BOGUS_EMAIL_PATTERNS.some((pat) => pat.test(email));
}

// Levenshtein distance for fuzzy duplicate-name detection.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

async function main() {
  const contacts = await prisma.contact.findMany({
    include: { company: true, owner: true },
  });
  const total = contacts.length;

  const noEmail = contacts.filter((c) => !c.email);
  const bogusEmail = contacts.filter((c) => isBogusEmail(c.email));
  const doNotContact = contacts.filter((c) => c.doNotContact);
  const typeOther = contacts.filter((c) => c.type === "OTHER");
  const noCompany = contacts.filter((c) => !c.companyId && !c.org);
  const noOwner = contacts.filter((c) => !c.ownerId);
  const noPhone = contacts.filter((c) => !c.phone);
  const noCity = contacts.filter((c) => !c.city);
  const noState = contacts.filter((c) => !c.state);
  const noRecordContext = contacts.filter((c) => (c.recordContexts ?? []).length === 0);
  const duplicateEmails = new Map();
  for (const c of contacts) {
    if (!c.email) continue;
    const key = c.email.toLowerCase();
    if (!duplicateEmails.has(key)) duplicateEmails.set(key, []);
    duplicateEmails.get(key).push(c);
  }
  const emailDupeGroups = [...duplicateEmails.values()].filter((g) => g.length > 1);

  // Fuzzy near-duplicate names (distance <= 2, excluding identical strings
  // already caught structurally elsewhere) — same heuristic used earlier
  // this project to catch things like "Jon Monkarsh" / "Monkarsh".
  const names = contacts.map((c) => ({ id: c.id, name: c.name, company: c.company?.name ?? c.org ?? "" }));
  const nearDupes = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      if (a.name === b.name) continue;
      if (Math.abs(a.name.length - b.name.length) > 3) continue;
      const dist = levenshtein(a.name.toLowerCase(), b.name.toLowerCase());
      if (dist <= 2 && (a.company === b.company || !a.company || !b.company)) {
        nearDupes.push([a, b, dist]);
      }
    }
  }

  console.log("=== DATA QUALITY METRICS ===");
  console.log("Total contacts:", total);
  console.log("");
  console.log(`Missing email: ${noEmail.length} (${pct(noEmail.length, total)})`);
  console.log(`Bogus/placeholder email: ${bogusEmail.length} (${pct(bogusEmail.length, total)})`);
  console.log(`  -> Do Not Contact flag set: ${doNotContact.length}`);
  console.log(`Type = "Other": ${typeOther.length} (${pct(typeOther.length, total)})`);
  console.log(`No company linked: ${noCompany.length} (${pct(noCompany.length, total)})`);
  console.log(`No owner assigned: ${noOwner.length} (${pct(noOwner.length, total)})`);
  console.log(`No phone: ${noPhone.length} (${pct(noPhone.length, total)})`);
  console.log(`No city: ${noCity.length} (${pct(noCity.length, total)})`);
  console.log(`No state: ${noState.length} (${pct(noState.length, total)})`);
  console.log(`No Prospect Type (record context): ${noRecordContext.length} (${pct(noRecordContext.length, total)})`);
  console.log("");
  console.log(`Exact-duplicate emails shared by 2+ contacts: ${emailDupeGroups.length} group(s)`);
  emailDupeGroups.forEach((g) => console.log("  ", g.map((c) => c.name).join(" / "), "->", g[0].email));
  console.log("");
  console.log(`Likely duplicate names (edit distance <= 2): ${nearDupes.length} pair(s)`);
  nearDupes.forEach(([a, b, d]) => console.log(`   "${a.name}" <-> "${b.name}" (distance ${d}) [${a.company || "no company"} / ${b.company || "no company"}]`));

  console.log("");
  console.log("Bogus email examples (first 10):");
  bogusEmail.slice(0, 10).forEach((c) => console.log("  ", c.name, "-", c.email));
}
function pct(n, total) {
  return total ? ((n / total) * 100).toFixed(1) + "%" : "0%";
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
