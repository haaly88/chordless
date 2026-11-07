/**
 * Region detection for localized charts/home.
 * Priority: explicit user override (Settings) > browser language > timezone > defaults.
 * Returns { gl (2-letter country, uppercase), hl (2-letter lang, lowercase), label, auto }.
 */

const TIMEZONE_TO_GL = {
  'Asia/Jakarta': 'ID', 'Asia/Makassar': 'ID', 'Asia/Jayapura': 'ID', 'Asia/Pontianak': 'ID',
  'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Bangkok': 'TH',
  'Asia/Ho_Chi_Minh': 'VN', 'Asia/Manila': 'PH', 'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW', 'Asia/Kolkata': 'IN', 'Asia/Dubai': 'AE',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ',
  'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Toronto': 'CA', 'America/Mexico_City': 'MX',
  'America/Sao_Paulo': 'BR', 'America/Argentina/Buenos_Aires': 'AR',
  'Africa/Cairo': 'EG', 'Africa/Lagos': 'NG', 'Africa/Johannesburg': 'ZA',
};

const GL_TO_LABEL = {
  ID: 'Indonesia', MY: 'Malaysia', SG: 'Singapore', TH: 'Thailand', VN: 'Vietnam',
  PH: 'Philippines', JP: 'Japan', KR: 'South Korea', CN: 'China', HK: 'Hong Kong',
  TW: 'Taiwan', IN: 'India', AE: 'UAE', AU: 'Australia', NZ: 'New Zealand',
  GB: 'United Kingdom', US: 'United States', CA: 'Canada', FR: 'France',
  DE: 'Germany', ES: 'Spain', IT: 'Italy', NL: 'Netherlands', BR: 'Brazil',
  MX: 'Mexico', AR: 'Argentina', EG: 'Egypt', NG: 'Nigeria', ZA: 'South Africa',
};

/** Full region list for the Settings selector (GL + label). */
export const REGION_OPTIONS = [
  { gl: 'auto', label: 'Auto (follow my location)' },
  ...Object.entries(GL_TO_LABEL).map(([gl, label]) => ({ gl, label })),
];

/** Detect user's region from browser language, falling back to timezone. */
export function detectRegion() {
  const lang = String(navigator.language || navigator.userLanguage || 'en-US');
  const parts = lang.split('-');
  const hl = (parts[0] || 'en').toLowerCase();
  const glFromLang = (parts[1] || '').toUpperCase();
  if (glFromLang.length === 2) {
    return normalizeRegion(glFromLang, hl, true);
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const glFromTz = TIMEZONE_TO_GL[tz];
    if (glFromTz) return normalizeRegion(glFromTz, hl, true);
  } catch { /* timezone unavailable */ }
  return normalizeRegion('ID', hl, true);
}

/** Resolve effective region from a settings override ('auto' or GL code). */
export function resolveRegion(override) {
  if (override && override !== 'auto' && /^[A-Z]{2}$/.test(String(override).toUpperCase())) {
    const gl = String(override).toUpperCase();
    // Derive a sensible HL from GL for the override.
    const HL_BY_GL = { ID: 'id', MY: 'ms', SG: 'en', TH: 'th', VN: 'vi', PH: 'fil', JP: 'ja', KR: 'ko', CN: 'zh', HK: 'zh', TW: 'zh', IN: 'en', AE: 'ar', AU: 'en', NZ: 'en', GB: 'en', US: 'en', CA: 'en', FR: 'fr', DE: 'de', ES: 'es', IT: 'it', NL: 'nl', BR: 'pt', MX: 'es', AR: 'es', EG: 'ar', NG: 'en', ZA: 'en' };
    return normalizeRegion(gl, HL_BY_GL[gl] || 'en', false);
  }
  return detectRegion();
}

function normalizeRegion(gl, hl, auto) {
  const cleanGl = String(gl || 'ID').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'ID';
  const cleanHl = String(hl || 'en').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2) || 'en';
  return {
    gl: cleanGl,
    hl: cleanHl,
    label: GL_TO_LABEL[cleanGl] || cleanGl,
    auto: Boolean(auto),
  };
}
