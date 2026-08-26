// Free-text location -> US state -> Census region, so the conference tracker
// can be filtered/mapped without requiring a controlled address format.
// Same "start simple, refine once we see real matching quality" call as the
// event-type and travel-city heuristics elsewhere in this app.

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

// Major metros that show up in location text without a trailing state — a
// small, hand-picked list rather than a full geocoder.
const CITY_TO_STATE: Record<string, string> = {
  "new york city": "NY",
  "las vegas": "NV",
  "los angeles": "CA",
  "san francisco": "CA",
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

export function inferState(location: string | null | undefined): string | null {
  if (!location) return null;
  const abbrevMatch = location.match(/,\s*([A-Z]{2})\b/);
  if (abbrevMatch && abbrevMatch[1] in STATE_TO_REGION) return abbrevMatch[1];

  for (const [name, abbr] of Object.entries(STATE_NAMES)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(location)) return abbr;
  }

  const lower = location.toLowerCase();
  for (const [city, abbr] of Object.entries(CITY_TO_STATE)) {
    if (lower.includes(city)) return abbr;
  }

  return null;
}

export function inferRegion(location: string | null | undefined): Region {
  const state = inferState(location);
  return (state && STATE_TO_REGION[state]) || "Unknown";
}
