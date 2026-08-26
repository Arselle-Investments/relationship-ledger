// Free-text location (and, as a fallback, the conference name itself) -> US
// state -> Census region, so the conference tracker can be filtered/mapped
// without requiring a controlled address format. Same "start simple, refine
// once we see real matching quality" call as the event-type and travel-city
// heuristics elsewhere in this app.

export type Region = "Northeast" | "Midwest" | "South" | "West" | "Unknown";

export const REGIONS: Region[] = ["Northeast", "Midwest", "South", "West", "Unknown"];

// The US Census Bureau's four-region breakdown — the closest thing to an
// "industry standard" grouping that isn't tied to any one association.
const STATE_TO_REGION: Record<string, Region> = {
  CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast", RI: "Northeast", VT: "Northeast", NJ: "Northeast", NY: "Northeast", PA: "Northeast",
  IL: "Midwest", IN: "Midwest", MI: "Midwest", OH: "Midwest", WI: "Midwest", IA: "Midwest", KS: "Midwest", MN: "Midwest", MO: "Midwest", NE: "Midwest", ND: "Midwest", SD: "Midwest",
  DE: "South", FL: "South", GA: "South", MD: "South", NC: "South", SC: "South", VA: "South", DC: "South", WV: "South", AL: "South", KY: "South", MS: "South", TN: "South", AR: "South", LA: "South", OK: "South", TX: "South",
  AZ: "West", CO: "West", ID: "West", MT: "West", NV: "West", NM: "West", UT: "West", WY: "West", AK: "West", CA: "West", HI: "West", OR: "West", WA: "West",
};

const STATE_NAMES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT",
  Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
  "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
  "Washington DC": "DC", "Washington, DC": "DC", "Washington D.C.": "DC",
};

// Major metros that show up in location text (or a conference's title, e.g.
// "ALTSLA 2026 (Los Angeles)") without a trailing state — a small,
// hand-picked list rather than a full geocoder.
const CITY_TO_STATE: Record<string, string> = {
  "new york city": "NY",
  nyc: "NY",
  "las vegas": "NV",
  "los angeles": "CA",
  "san francisco": "CA",
  "san diego": "CA",
  "newport beach": "CA",
  "silicon valley": "CA",
  chicago: "IL",
  boston: "MA",
  miami: "FL",
  seattle: "WA",
  denver: "CO",
  austin: "TX",
  dallas: "TX",
  houston: "TX",
  phoenix: "AZ",
  scottsdale: "AZ",
  nashville: "TN",
  orlando: "FL",
  philadelphia: "PA",
  atlanta: "GA",
  "washington dc": "DC",
};

// Regional nicknames common in "Private Wealth <Region> Forum"-style titles
// that don't name a single city or state at all. Mapped straight to a
// representative state so the map view still has somewhere to put a dot.
const REGION_NICKNAME_TO_STATE: Record<string, string> = {
  norcal: "CA",
  "nor cal": "CA",
  socal: "CA",
  "so cal": "CA",
  "bay area": "CA",
  "pac northwest": "WA",
  "pacific northwest": "WA",
  "tri-state": "NY",
  "new england": "MA",
  carolinas: "NC",
  "mid-atlantic": "VA",
  "dc metro": "DC",
  "great plains": "KS",
  southeast: "GA",
  midwest: "IL",
};

function matchIn(text: string): string | null {
  // "City, ST" or "City, ST 12345" — the common comma-separated form.
  const abbrevMatch = text.match(/,\s*([A-Z]{2})\b/);
  if (abbrevMatch && abbrevMatch[1] in STATE_TO_REGION) return abbrevMatch[1];
  // "City ST 12345" — same idea without the comma, anchored to a zip code
  // so a stray two-letter word elsewhere in the address isn't mistaken for one.
  const zipMatch = text.match(/\b([A-Z]{2})\s+\d{5}\b/);
  if (zipMatch && zipMatch[1] in STATE_TO_REGION) return zipMatch[1];

  for (const [name, abbr] of Object.entries(STATE_NAMES)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) return abbr;
  }

  const lower = text.toLowerCase();
  for (const [city, abbr] of Object.entries(CITY_TO_STATE)) {
    if (lower.includes(city)) return abbr;
  }
  for (const [nickname, abbr] of Object.entries(REGION_NICKNAME_TO_STATE)) {
    if (lower.includes(nickname)) return abbr;
  }

  return null;
}

/**
 * Infers a US state from an event's location, falling back to its name —
 * conference titles routinely carry the real context clue ("ALTSLA 2026 (Los
 * Angeles)", "10th Annual Private Wealth NorCal Forum") when the location
 * field itself is "TBA" or a venue name with no address.
 */
export function inferState(name: string | null | undefined, location?: string | null): string | null {
  return matchIn(location ?? "") ?? matchIn(name ?? "");
}

export function inferRegion(name: string | null | undefined, location?: string | null): Region {
  const state = inferState(name, location);
  return (state && STATE_TO_REGION[state]) || "Unknown";
}
