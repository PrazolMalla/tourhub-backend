import geoip from "geoip-lite";

const COUNTRY_NAMES: Record<string, string> = {
  NP: "Nepal",
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  AU: "Australia",
  CA: "Canada",
  DE: "Germany",
  FR: "France",
  JP: "Japan",
  CN: "China",
  KR: "South Korea",
  SG: "Singapore",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  PK: "Pakistan",
  BD: "Bangladesh",
  LK: "Sri Lanka",
  BT: "Bhutan",
  MM: "Myanmar",
  TH: "Thailand",
  MY: "Malaysia",
  ID: "Indonesia",
  PH: "Philippines",
  VN: "Vietnam",
  NL: "Netherlands",
  IT: "Italy",
  ES: "Spain",
  RU: "Russia",
  BR: "Brazil",
  MX: "Mexico",
  ZA: "South Africa",
  EG: "Egypt",
  NG: "Nigeria",
  KE: "Kenya",
  IR: "Iran",
  TR: "Turkey",
  IL: "Israel",
  HK: "Hong Kong",
  TW: "Taiwan",
  NZ: "New Zealand",
  CH: "Switzerland",
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  DK: "Denmark",
  IE: "Ireland",
  PL: "Poland",
};

let intlNames: Intl.DisplayNames | null = null;
function getIntlNames(): Intl.DisplayNames | null {
  if (intlNames) return intlNames;
  try {
    intlNames = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    intlNames = null;
  }
  return intlNames;
}

export function countryNameFor(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  if (COUNTRY_NAMES[upper]) return COUNTRY_NAMES[upper];
  const intl = getIntlNames();
  try {
    return intl?.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

export interface GeoLookupResult {
  country?: string;
  countryName?: string;
  region?: string;
  regionName?: string;
  city?: string;
  timezone?: string;
}

const PRIVATE_IPV4 = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

function normalizeIp(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let ip = raw.trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice("::ffff:".length);
  if (ip === "::1") return "127.0.0.1";
  return ip;
}

export function lookupGeo(ipRaw: string | undefined): GeoLookupResult {
  const ip = normalizeIp(ipRaw);
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || PRIVATE_IPV4.test(ip)) {
    return {};
  }
  const result = geoip.lookup(ip);
  if (!result) return {};
  const out: GeoLookupResult = {};
  if (result.country) {
    out.country = result.country;
    const name = countryNameFor(result.country);
    if (name) out.countryName = name;
  }
  if (result.region) {
    out.region = result.region;
    out.regionName = result.region;
  }
  if (result.city) out.city = result.city;
  if (result.timezone) out.timezone = result.timezone;
  return out;
}

const BOT_UA_RE =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|whatsapp|telegram|preview|monitor|pingdom|uptime/i;

export function looksLikeBot(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_RE.test(userAgent);
}
