// Common English first-name nicknames, grouped so any two names in the same
// group are treated as the same person's first name — e.g. an email signed
// "Ron Weathers" should still match an existing contact "Ronald Weathers".
// Kept to well-established, unambiguous pairs; deliberately not exhaustive.
const NICKNAME_GROUPS: string[][] = [
  ["robert", "rob", "bob", "bobby", "robbie"],
  ["ronald", "ron", "ronnie"],
  ["nicholas", "nick", "nicky", "nico"],
  ["richard", "rick", "ricky", "rich", "dick"],
  ["william", "will", "bill", "billy", "liam"],
  ["james", "jim", "jimmy", "jamie"],
  ["john", "jack", "johnny", "jon", "jonathan", "jonny"],
  ["michael", "mike", "mickey", "mick"],
  ["christopher", "chris"],
  ["matthew", "matt"],
  ["joseph", "joe", "joey"],
  ["daniel", "dan", "danny"],
  ["david", "dave", "davey"],
  ["thomas", "tom", "tommy"],
  ["charles", "charlie", "chuck"],
  ["edward", "ed", "eddie", "ted", "teddy"],
  ["anthony", "tony"],
  ["benjamin", "ben", "benny", "benji"],
  ["alexander", "alex", "xander"],
  ["samuel", "sam", "sammy"],
  ["timothy", "tim", "timmy"],
  ["andrew", "andy", "drew"],
  ["kenneth", "ken", "kenny"],
  ["patrick", "pat", "paddy"],
  ["gregory", "greg"],
  ["steven", "stephen", "steve", "stevie"],
  ["douglas", "doug"],
  ["nathaniel", "nathan", "nate"],
  ["peter", "pete"],
  ["raymond", "ray"],
  ["frederick", "fred", "freddy"],
  ["harold", "harry"],
  ["lawrence", "larry"],
  ["jeffrey", "jeff", "geoff"],
  ["kevin", "kev"],
  ["vincent", "vince"],
  ["walter", "walt"],
  ["russell", "russ"],
  ["philip", "phil"],
  ["donald", "don", "donnie"],
  ["albert", "al"],
  ["arthur", "art"],
  ["elizabeth", "liz", "beth", "betty", "eliza", "lizzie", "libby"],
  ["katherine", "catherine", "kathryn", "kate", "katie", "cathy", "kathy", "kay"],
  ["margaret", "maggie", "meg", "peggy", "margie", "marge"],
  ["jennifer", "jen", "jenny"],
  ["patricia", "pat", "patty", "trish", "tricia"],
  ["susan", "sue", "susie", "suzy"],
  ["deborah", "debra", "deb", "debbie"],
  ["barbara", "barb", "barbie"],
  ["rebecca", "becky", "becca"],
  ["victoria", "vicky", "tori"],
  ["jessica", "jess", "jessie"],
  ["samantha", "sam", "sammy"],
  ["cynthia", "cindy"],
  ["christina", "christine", "chris", "tina", "christy"],
  ["amanda", "mandy"],
  ["alexandra", "alex", "lexi", "sandra"],
  ["diana", "di", "diane"],
  ["theresa", "teresa", "terry", "tess"],
  ["stephanie", "steph"],
  ["gabriel", "gabe"],
  ["isabella", "bella", "izzy"],
  ["sophia", "sophie"],
  ["olivia", "liv", "livvy"],
];

const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]);

const nicknameLookup = new Map<string, number>();
NICKNAME_GROUPS.forEach((group, i) => group.forEach((n) => nicknameLookup.set(n, i)));

function firstNamesEquivalent(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const groupA = nicknameLookup.get(a);
  const groupB = nicknameLookup.get(b);
  return groupA !== undefined && groupA === groupB;
}

function splitName(fullName: string): { first: string; last: string } | null {
  const tokens = fullName
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .split(/\s+/)
    .filter((t) => t && !NAME_SUFFIXES.has(t));
  if (tokens.length < 2) return null;
  return { first: tokens[0], last: tokens[tokens.length - 1] };
}

/**
 * Whether a candidate name (e.g. extracted from an email's From header or by
 * the AI extractor) plausibly refers to the same person as an existing
 * contact's name — same last name, and a first name that's either identical
 * or a known nickname of the other ("Ron" / "Ronald", "Nick" / "Nicholas").
 * Requires an exact last-name match, since a first-name-only or nickname
 * coincidence across different last names is far more likely to be a
 * different person than the same one going by a shorthand.
 */
export function contactMatchesName(contact: { name: string }, candidateName: string): boolean {
  const a = splitName(contact.name);
  const b = splitName(candidateName);
  if (!a || !b) return false;
  return a.last === b.last && firstNamesEquivalent(a.first, b.first);
}
