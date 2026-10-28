export const US_STATE_OPTIONS: { value: string; label: string }[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([value, label]) => ({ value, label }));

export const STATE_CANADA = "Canada";
export const STATE_INTERNATIONAL = "International / Other";

const BY_NAME = new Map(US_STATE_OPTIONS.map((o) => [o.label.toLowerCase(), o.value]));
const CODES = new Set(US_STATE_OPTIONS.map((o) => o.value));
const CANADIAN_PROVINCES = new Set([
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
  "alberta", "british columbia", "manitoba", "new brunswick", "newfoundland and labrador", "nova scotia",
  "northwest territories", "nunavut", "ontario", "prince edward island", "quebec", "saskatchewan", "yukon",
]);

/** Maps what a signature parse produced ("California", "ca", "Ontario") onto a dropdown value; anything unrecognised is returned as-is so nothing is silently dropped. */
export function normalizeStateValue(raw: string): string {
  const v = raw.trim().replace(/\.$/, "");
  if (!v) return "";
  const upper = v.toUpperCase();
  if (CODES.has(upper)) return upper;
  const byName = BY_NAME.get(v.toLowerCase());
  if (byName) return byName;
  if (v.toLowerCase() === "washington dc" || v.toLowerCase() === "washington, dc" || upper === "D.C.") return "DC";
  if (v.toLowerCase() === "canada" || CANADIAN_PROVINCES.has(upper) || CANADIAN_PROVINCES.has(v.toLowerCase())) {
    return STATE_CANADA;
  }
  return v;
}
