// Approximate state centroids (lat, lon) for the events map — precise enough
// to cluster dots in recognizable, roughly-correct positions; not meant for
// cartographic accuracy. Alaska and Hawaii are plotted separately as inset
// boxes (standard US-map convention) rather than by true lat/lon.
export const STATE_CENTROIDS: Record<string, { lat: number; lon: number }> = {
  AL: { lat: 32.8, lon: -86.8 },
  AZ: { lat: 34.2, lon: -111.9 },
  AR: { lat: 34.9, lon: -92.4 },
  CA: { lat: 37.2, lon: -119.7 },
  CO: { lat: 39.0, lon: -105.5 },
  CT: { lat: 41.6, lon: -72.7 },
  DE: { lat: 39.0, lon: -75.5 },
  FL: { lat: 28.6, lon: -81.5 },
  GA: { lat: 32.6, lon: -83.4 },
  ID: { lat: 44.4, lon: -114.6 },
  IL: { lat: 40.0, lon: -89.2 },
  IN: { lat: 39.9, lon: -86.3 },
  IA: { lat: 42.0, lon: -93.5 },
  KS: { lat: 38.5, lon: -98.4 },
  KY: { lat: 37.5, lon: -85.3 },
  LA: { lat: 31.0, lon: -92.0 },
  ME: { lat: 45.4, lon: -69.2 },
  MD: { lat: 39.0, lon: -76.7 },
  MA: { lat: 42.3, lon: -71.8 },
  MI: { lat: 44.3, lon: -85.4 },
  MN: { lat: 46.3, lon: -94.3 },
  MS: { lat: 32.7, lon: -89.7 },
  MO: { lat: 38.5, lon: -92.5 },
  MT: { lat: 47.0, lon: -109.6 },
  NE: { lat: 41.5, lon: -99.8 },
  NV: { lat: 39.3, lon: -116.6 },
  NH: { lat: 43.7, lon: -71.6 },
  NJ: { lat: 40.1, lon: -74.7 },
  NM: { lat: 34.5, lon: -106.1 },
  NY: { lat: 42.9, lon: -75.5 },
  NC: { lat: 35.6, lon: -79.4 },
  ND: { lat: 47.5, lon: -100.5 },
  OH: { lat: 40.3, lon: -82.8 },
  OK: { lat: 35.5, lon: -97.5 },
  OR: { lat: 44.0, lon: -120.6 },
  PA: { lat: 40.9, lon: -77.7 },
  RI: { lat: 41.7, lon: -71.5 },
  SC: { lat: 33.9, lon: -80.9 },
  SD: { lat: 44.4, lon: -100.2 },
  TN: { lat: 35.9, lon: -86.4 },
  TX: { lat: 31.5, lon: -99.3 },
  UT: { lat: 39.3, lon: -111.6 },
  VT: { lat: 44.0, lon: -72.7 },
  VA: { lat: 37.5, lon: -78.8 },
  WA: { lat: 47.4, lon: -120.5 },
  WV: { lat: 38.9, lon: -80.7 },
  WI: { lat: 44.6, lon: -89.9 },
  WY: { lat: 43.0, lon: -107.5 },
  DC: { lat: 38.9, lon: -77.0 },
};

// Fixed pixel positions (in the 0-960 x 0-560 map viewBox) for the two
// non-continental states, drawn as labeled inset boxes rather than projected
// by lat/lon.
export const INSET_STATES: Record<string, { x: number; y: number }> = {
  AK: { x: 110, y: 500 },
  HI: { x: 230, y: 500 },
};

const MAP_WIDTH = 960;
const MAP_HEIGHT = 460;
const MIN_LON = -125;
const MAX_LON = -66;
const MIN_LAT = 24.5;
const MAX_LAT = 49.5;

export function projectState(abbr: string): { x: number; y: number } | null {
  if (abbr in INSET_STATES) return INSET_STATES[abbr];
  const c = STATE_CENTROIDS[abbr];
  if (!c) return null;
  const x = ((c.lon - MIN_LON) / (MAX_LON - MIN_LON)) * MAP_WIDTH;
  const y = ((MAX_LAT - c.lat) / (MAX_LAT - MIN_LAT)) * MAP_HEIGHT;
  return { x, y };
}
