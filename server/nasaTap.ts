import type {
  DataSourceStatus,
  DiscoveryMethod,
  ExoplanetDetail,
  ExoplanetSearchItem,
  MeasurementStatus,
  ScientificMeasurement,
  SearchTargetsParams,
} from '../src/api/contracts.ts';

export const DEFAULT_TAP_URL = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
let NASA_TAP_URL = DEFAULT_TAP_URL;
const SIMBAD_SESAME_URL =
  'https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-oI?TRAPPIST-1';
const ALADIN_HIPS_PROPS_URL =
  'https://alasky.cds.unistra.fr/DSS/DSS2Color/properties';

const ALLOWED_DISCOVERY_METHODS: ReadonlySet<DiscoveryMethod> = new Set([
  'Transit',
  'Radial Velocity',
  'Imaging',
  'Microlensing',
  'Transit Timing Variations',
  'Astrometry',
  'Other',
]);

// ---------------------------------------------------------------------------
// Runtime options (set once by the server from its config)
// ---------------------------------------------------------------------------

let cacheTtlMs = 10 * 60 * 1000;
let userAgent = 'ORBIT-OS-Space-Explorer/1.0';
const CACHE_MAX_ENTRIES = 500;
const tapCache = new Map<string, { expiresAt: number; rows: unknown[] }>();

/** Configure caching and the User-Agent used for upstream calls. */
export function configureNasaTap(options: {
  cacheTtlSeconds?: number;
  contact?: string;
  tapUrl?: string;
}): void {
  if (options.cacheTtlSeconds !== undefined) cacheTtlMs = options.cacheTtlSeconds * 1000;
  NASA_TAP_URL = options.tapUrl ?? DEFAULT_TAP_URL;
  userAgent = options.contact
    ? `ORBIT-OS-Space-Explorer/1.0 (${options.contact})`
    : 'ORBIT-OS-Space-Explorer/1.0';
  tapCache.clear();
}

/** Test helper: forget cached upstream responses. */
export function clearTapCache(): void {
  tapCache.clear();
}

export class UpstreamTapError extends Error {
  status: number;
  detail: string;

  constructor(message: string, status: number, detail = '') {
    super(message);
    this.name = 'UpstreamTapError';
    this.status = status;
    this.detail = detail;
  }
}

export function escapeAdqlString(input: string): string {
  return input.replace(/'/g, "''");
}

/** Discovery method exactly as published; never collapsed into a coarser category. */
function discoveryMethodText(raw: unknown): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'Not recorded';
}

export type MassProvenanceKind = 'mass' | 'msini' | 'msini_over_sini' | 'other' | 'unknown';

/**
 * Classifies the archive's pl_bmassprov text. The archive documents the values
 * "Mass", "M*sin(i)/sin(i)" and "M*sini"; comparison ignores case and punctuation
 * so "Msini" and "M*sini" are treated alike.
 */
export function classifyMassProvenance(raw: unknown): MassProvenanceKind {
  if (typeof raw !== 'string' || !raw.trim()) return 'unknown';
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (key === 'mass') return 'mass';
  if (key === 'msini') return 'msini';
  if (key === 'msinisini') return 'msini_over_sini';
  return 'other';
}

interface ParsedRefLink {
  label?: string;
  bibcode?: string;
}

function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&aacute;': 'á',
    '&eacute;': 'é',
    '&iacute;': 'í',
    '&oacute;': 'ó',
    '&uacute;': 'ú',
    '&ntilde;': 'ñ',
    '&auml;': 'ä',
    '&euml;': 'ë',
    '&iuml;': 'ï',
    '&ouml;': 'ö',
    '&uuml;': 'ü',
    '&ccedil;': 'ç',
    '&oslash;': 'ø',
    '&aring;': 'å',
    '&Aacute;': 'Á',
    '&Eacute;': 'É',
    '&Ouml;': 'Ö',
    '&Uuml;': 'Ü',
  };
  return text
    .replace(/&[a-zA-Z]+;|&#\d+;/g, (match) => {
      if (named[match]) return named[match];
      const numMatch = match.match(/^&#(\d+);$/);
      if (numMatch) return String.fromCodePoint(Number(numMatch[1]));
      return match;
    })
    .trim();
}

/**
 * Parses NASA Exoplanet Archive HTML reflink strings such as:
 * <a refstr=AGOL_ET_AL__2021 href=https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract target=ref>Agol et al. 2021</a>
 */
export function parseRefLink(raw: unknown): ParsedRefLink {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  const labelMatch = raw.match(/>([^<]+)<\/a>/i);
  const rawLabel = labelMatch ? labelMatch[1] : raw.replace(/<[^>]+>/g, '');
  const label = decodeHtmlEntities(rawLabel);
  const absMatch = raw.match(/\/abs\/([^/\s>]+)/i);
  const bibcode = absMatch ? decodeURIComponent(absMatch[1]) : undefined;
  return {
    label: label || undefined,
    bibcode,
  };
}

export function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** True when an archive reference label marks a value the archive calculated rather than took from a paper. */
export function isArchiveCalculated(label: string | undefined): boolean {
  return !!label && /calculated value/i.test(label);
}

export function buildMeasurement(
  row: Record<string, unknown>,
  valueCol: string,
  unit: string,
  options?: {
    err1Col?: string;
    err2Col?: string;
    limCol?: string;
    refCol?: string;
    unavailableReason?: string;
    forceStatus?: MeasurementStatus;
    noteSuffix?: string;
  }
): ScientificMeasurement<number> {
  const value = toFiniteNumber(row[valueCol]);
  const ref = options?.refCol ? parseRefLink(row[options.refCol]) : {};

  if (value === null) {
    return {
      value: null,
      unit,
      status: 'not_measured',
      unavailableReason:
        options?.unavailableReason ??
        `Not reported in NASA Exoplanet Archive pscomppars (${valueCol} is null).`,
      referenceLabel: ref.label,
      referenceBibcode: ref.bibcode,
    };
  }

  // The sign convention of the archive's limit flags is not reliably documented for pscomppars,
  // so a flagged value is reported as a limit of unverified direction, with the raw flag kept.
  const rawLimitFlag = options?.limCol ? toFiniteNumber(row[options.limCol]) : null;
  let status: MeasurementStatus = options?.forceStatus ?? 'measured';
  if (!options?.forceStatus && (rawLimitFlag === 1 || rawLimitFlag === -1)) {
    status = 'limit_direction_unverified';
  }
  // The archive fills some gaps itself (e.g. a radius from a mass via Chen & Kipping 2017, density
  // from mass and radius) and labels the reference "Calculated Value" (docs/pscp_calc.html).
  // Such values are not measurements.
  if (!options?.forceStatus && status === 'measured' && isArchiveCalculated(ref.label)) {
    status = 'derived';
  }

  const err1Raw = options?.err1Col ? toFiniteNumber(row[options.err1Col]) : null;
  const err2Raw = options?.err2Col ? toFiniteNumber(row[options.err2Col]) : null;
  const errPlus = err1Raw !== null ? Math.abs(err1Raw) : null;
  const errMinus = err2Raw !== null ? Math.abs(err2Raw) : null;
  const isSymmetricErr =
    errPlus !== null && errMinus !== null && Math.abs(errPlus - errMinus) < 1e-12;

  const label = options?.noteSuffix && ref.label
    ? `${ref.label} (${options.noteSuffix})`
    : ref.label ?? options?.noteSuffix;

  return {
    value,
    unit,
    errPlus,
    errMinus,
    isSymmetricErr,
    status,
    ...(options?.limCol ? { rawLimitFlag, rawLimitFlagColumn: options.limCol } : {}),
    referenceLabel: label,
    referenceBibcode: ref.bibcode,
  };
}

/** Counters that let operators and the smoke test tell fresh NASA requests from cache hits. */
const tapStats = { upstreamRequests: 0, cacheHits: 0, sharedInFlight: 0 };
const inFlight = new Map<string, Promise<unknown[]>>();

export function getTapStats(): { upstreamRequests: number; cacheHits: number; sharedInFlight: number; cachedQueries: number } {
  return { ...tapStats, cachedQueries: tapCache.size };
}

async function runTapQuery<T = Record<string, unknown>>(
  adql: string,
  timeoutMs = 22000
): Promise<T[]> {
  const cached = tapCache.get(adql);
  if (cached && cached.expiresAt > Date.now()) {
    tapStats.cacheHits += 1;
    return cached.rows as T[];
  }
  // Identical queries already on their way to NASA share one upstream request.
  const pending = inFlight.get(adql);
  if (pending) {
    tapStats.sharedInFlight += 1;
    return (await pending) as T[];
  }
  const request = fetchTapRows(adql, timeoutMs);
  inFlight.set(adql, request);
  try {
    return (await request) as T[];
  } finally {
    inFlight.delete(adql);
  }
}

async function fetchTapRows(adql: string, timeoutMs: number): Promise<unknown[]> {
  tapStats.upstreamRequests += 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${NASA_TAP_URL}?query=${encodeURIComponent(adql)}&format=json`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new UpstreamTapError(
        `NASA Exoplanet Archive TAP returned HTTP ${res.status}`,
        res.status >= 500 ? 502 : 400,
        body.slice(0, 300)
      );
    }

    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) {
      throw new UpstreamTapError(
        'Unexpected non-array JSON response from NASA TAP service.',
        502
      );
    }
    if (cacheTtlMs > 0) {
      if (tapCache.size >= CACHE_MAX_ENTRIES) {
        const oldestKey = tapCache.keys().next().value;
        if (oldestKey !== undefined) tapCache.delete(oldestKey);
      }
      tapCache.set(adql, { expiresAt: Date.now() + cacheTtlMs, rows: json });
    }
    return json;
  } catch (err) {
    if (err instanceof UpstreamTapError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UpstreamTapError(
        `NASA Exoplanet Archive TAP request timed out after ${timeoutMs} ms.`,
        504
      );
    }
    throw new UpstreamTapError(
      'Could not reach the NASA Exoplanet Archive TAP service.',
      502,
      err instanceof Error ? err.message : ''
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function searchNasaExoplanets(
  params: SearchTargetsParams
): Promise<{
  totalCount: number;
  items: ExoplanetSearchItem[];
  queryTimestampUtc: string;
}> {
  const clauses: string[] = [];

  const q = (params.q ?? '').trim();
  if (q.length > 0) {
    const safeQ = escapeAdqlString(q.slice(0, 80).toLowerCase());
    clauses.push(`(LOWER(pl_name) LIKE '%${safeQ}%' OR LOWER(hostname) LIKE '%${safeQ}%')`);
  }

  if (params.discoveryMethod && params.discoveryMethod !== 'ALL') {
    if (!ALLOWED_DISCOVERY_METHODS.has(params.discoveryMethod)) {
      throw new UpstreamTapError(
        `Invalid discoveryMethod filter: ${params.discoveryMethod}`,
        400
      );
    }
    clauses.push(`discoverymethod = '${escapeAdqlString(params.discoveryMethod)}'`);
  }

  if (params.requireRadius) {
    clauses.push('pl_rade > 0');
  }
  if (params.requireMass) {
    clauses.push('pl_bmasse > 0');
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 100);
  const offset = Math.min(Math.max(Number(params.offset) || 0, 0), 400);
  const fetchTop = limit + offset;

  const countSql = `SELECT COUNT(*) AS total FROM pscomppars ${whereSql}`;
  const dataSql = `
    SELECT TOP ${fetchTop}
      pl_name, hostname, discoverymethod, disc_year,
      ra, dec, pl_orbper, pl_rade, pl_bmasse, pl_bmassprov, sy_dist, st_spectype
    FROM pscomppars
    ${whereSql}
    ORDER BY sy_dist ASC NULLS LAST, pl_name ASC
  `.trim();

  const [countRows, rawRows] = await Promise.all([
    runTapQuery<{ total: number }>(countSql),
    runTapQuery<Record<string, unknown>>(dataSql),
  ]);

  const totalCount = toFiniteNumber(countRows[0]?.total) ?? rawRows.length;
  const sliced = rawRows.slice(offset, offset + limit);

  const items: ExoplanetSearchItem[] = sliced.map((r) => ({
    id: String(r.pl_name ?? ''),
    planetName: String(r.pl_name ?? ''),
    hostname: String(r.hostname ?? ''),
    discoveryMethod: discoveryMethodText(r.discoverymethod),
    discoveryYear: toFiniteNumber(r.disc_year),
    raDeg: toFiniteNumber(r.ra),
    decDeg: toFiniteNumber(r.dec),
    orbitalPeriodDays: toFiniteNumber(r.pl_orbper),
    radiusEarth: toFiniteNumber(r.pl_rade),
    massEarth: toFiniteNumber(r.pl_bmasse),
    massIsMsini: classifyMassProvenance(r.pl_bmassprov) === 'msini',
    distancePc: toFiniteNumber(r.sy_dist),
    spectralType: typeof r.st_spectype === 'string' && r.st_spectype.trim() ? r.st_spectype.trim() : null,
  }));

  return {
    totalCount,
    items,
    queryTimestampUtc: new Date().toISOString(),
  };
}

export async function getNasaExoplanetDetail(rawId: string): Promise<ExoplanetDetail | null> {
  const canonicalName = rawId.trim();
  if (!canonicalName || canonicalName.length > 120) {
    throw new UpstreamTapError('Invalid exoplanet identifier.', 400);
  }

  const adql = `
    SELECT TOP 1
      pl_name, hostname, discoverymethod, disc_year, disc_facility, disc_refname,
      ra, dec, gaia_dr3_id, st_spectype,
      sy_dist, sy_disterr1, sy_disterr2, sy_dist_reflink,
      st_teff, st_tefferr1, st_tefferr2, st_tefflim, st_teff_reflink,
      st_mass, st_masserr1, st_masserr2, st_masslim, st_mass_reflink,
      st_rad, st_raderr1, st_raderr2, st_radlim, st_rad_reflink,
      st_met, st_meterr1, st_meterr2, st_metlim, st_met_reflink,
      sy_vmag, sy_vmagerr1, sy_vmagerr2, sy_vmag_reflink,
      pl_rade, pl_radeerr1, pl_radeerr2, pl_radelim, pl_rade_reflink,
      pl_bmasse, pl_bmasseerr1, pl_bmasseerr2, pl_bmasselim, pl_bmassprov, pl_bmasse_reflink,
      pl_eqt, pl_eqterr1, pl_eqterr2, pl_eqtlim, pl_eqt_reflink,
      pl_insol, pl_insolerr1, pl_insolerr2, pl_insollim, pl_insol_reflink,
      pl_dens, pl_denserr1, pl_denserr2, pl_denslim, pl_dens_reflink,
      pl_orbper, pl_orbpererr1, pl_orbpererr2, pl_orbperlim, pl_orbper_reflink,
      pl_orbsmax, pl_orbsmaxerr1, pl_orbsmaxerr2, pl_orbsmaxlim, pl_orbsmax_reflink,
      pl_orbeccen, pl_orbeccenerr1, pl_orbeccenerr2, pl_orbeccenlim, pl_orbeccen_reflink,
      pl_orbincl, pl_orbinclerr1, pl_orbinclerr2, pl_orbincllim, pl_orbincl_reflink,
      pl_trandur, pl_trandurerr1, pl_trandurerr2, pl_trandurlim, pl_trandur_reflink
    FROM pscomppars
    WHERE pl_name = '${escapeAdqlString(canonicalName)}'
  `.trim();

  const rows = await runTapQuery<Record<string, unknown>>(adql);
  if (rows.length === 0) return null;

  const row = rows[0];
  const discRef = parseRefLink(row.disc_refname);
  const bmassProv = typeof row.pl_bmassprov === 'string' ? row.pl_bmassprov.trim() : '';
  const massKind = classifyMassProvenance(bmassProv);
  const massIsMsini = massKind === 'msini';
  // Anything other than a direct mass or M*sin(i) (e.g. a mass-radius relationship estimate) is flagged as derived.
  const massIsDerived = massKind === 'other';

  const plName = String(row.pl_name ?? canonicalName);
  const upstreamQueryUrl = `${NASA_TAP_URL}?query=${encodeURIComponent(
    `SELECT * FROM pscomppars WHERE pl_name = '${escapeAdqlString(plName)}'`
  )}&format=json`;

  return {
    id: plName,
    planetName: plName,
    archiveRecordTable: 'pscomppars (NASA Exoplanet Archive)',
    retrievedAtUtc: new Date().toISOString(),
    discoveryMethod: discoveryMethodText(row.discoverymethod),
    discoveryYear: toFiniteNumber(row.disc_year),
    discoveryFacility:
      typeof row.disc_facility === 'string' && row.disc_facility.trim()
        ? row.disc_facility.trim()
        : 'Not recorded',
    discoveryReference: discRef.label ?? 'Not recorded',
    discoveryDoi: null,
    hostStar: {
      hostname: String(row.hostname ?? ''),
      raDeg: toFiniteNumber(row.ra),
      decDeg: toFiniteNumber(row.dec),
      spectralType:
        typeof row.st_spectype === 'string' && row.st_spectype.trim()
          ? row.st_spectype.trim()
          : null,
      distancePc: buildMeasurement(row, 'sy_dist', 'pc', {
        err1Col: 'sy_disterr1',
        err2Col: 'sy_disterr2',
        refCol: 'sy_dist_reflink',
      }),
      teffK: buildMeasurement(row, 'st_teff', 'K', {
        err1Col: 'st_tefferr1',
        err2Col: 'st_tefferr2',
        limCol: 'st_tefflim',
        refCol: 'st_teff_reflink',
      }),
      massSolar: buildMeasurement(row, 'st_mass', 'M_sun', {
        err1Col: 'st_masserr1',
        err2Col: 'st_masserr2',
        limCol: 'st_masslim',
        refCol: 'st_mass_reflink',
      }),
      radiusSolar: buildMeasurement(row, 'st_rad', 'R_sun', {
        err1Col: 'st_raderr1',
        err2Col: 'st_raderr2',
        limCol: 'st_radlim',
        refCol: 'st_rad_reflink',
      }),
      metallicityFeH: buildMeasurement(row, 'st_met', 'dex', {
        err1Col: 'st_meterr1',
        err2Col: 'st_meterr2',
        limCol: 'st_metlim',
        refCol: 'st_met_reflink',
      }),
      vMag: buildMeasurement(row, 'sy_vmag', 'mag', {
        err1Col: 'sy_vmagerr1',
        err2Col: 'sy_vmagerr2',
        refCol: 'sy_vmag_reflink',
      }),
      gaiaDr3Id:
        typeof row.gaia_dr3_id === 'string' && row.gaia_dr3_id.trim()
          ? row.gaia_dr3_id.trim()
          : null,
    },
    planetaryParameters: {
      radiusEarth: buildMeasurement(row, 'pl_rade', 'R_earth', {
        err1Col: 'pl_radeerr1',
        err2Col: 'pl_radeerr2',
        limCol: 'pl_radelim',
        refCol: 'pl_rade_reflink',
        unavailableReason:
          row.discoverymethod === 'Radial Velocity'
            ? 'No planetary radius reported in pscomppars (often non-transiting RV detection).'
            : undefined,
      }),
      massEarth: buildMeasurement(row, 'pl_bmasse', 'M_earth', {
        err1Col: 'pl_bmasseerr1',
        err2Col: 'pl_bmasseerr2',
        limCol: 'pl_bmasselim',
        refCol: 'pl_bmasse_reflink',
        forceStatus: massIsDerived ? 'derived' : undefined,
        noteSuffix: bmassProv || undefined,
      }),
      massIsMsini,
      massProvenance: bmassProv || null,
      equilibriumTempK: buildMeasurement(row, 'pl_eqt', 'K', {
        err1Col: 'pl_eqterr1',
        err2Col: 'pl_eqterr2',
        limCol: 'pl_eqtlim',
        refCol: 'pl_eqt_reflink',
      }),
      insolationFluxEarth: buildMeasurement(row, 'pl_insol', 'S_earth', {
        err1Col: 'pl_insolerr1',
        err2Col: 'pl_insolerr2',
        limCol: 'pl_insollim',
        refCol: 'pl_insol_reflink',
      }),
      bulkDensityGcm3: buildMeasurement(row, 'pl_dens', 'g/cm^3', {
        err1Col: 'pl_denserr1',
        err2Col: 'pl_denserr2',
        limCol: 'pl_denslim',
        refCol: 'pl_dens_reflink',
      }),
    },
    orbitalParameters: {
      periodDays: buildMeasurement(row, 'pl_orbper', 'd', {
        err1Col: 'pl_orbpererr1',
        err2Col: 'pl_orbpererr2',
        limCol: 'pl_orbperlim',
        refCol: 'pl_orbper_reflink',
      }),
      semiMajorAxisAu: buildMeasurement(row, 'pl_orbsmax', 'AU', {
        err1Col: 'pl_orbsmaxerr1',
        err2Col: 'pl_orbsmaxerr2',
        limCol: 'pl_orbsmaxlim',
        refCol: 'pl_orbsmax_reflink',
      }),
      eccentricity: buildMeasurement(row, 'pl_orbeccen', 'dimensionless', {
        err1Col: 'pl_orbeccenerr1',
        err2Col: 'pl_orbeccenerr2',
        limCol: 'pl_orbeccenlim',
        refCol: 'pl_orbeccen_reflink',
      }),
      inclinationDeg: buildMeasurement(row, 'pl_orbincl', 'deg', {
        err1Col: 'pl_orbinclerr1',
        err2Col: 'pl_orbinclerr2',
        limCol: 'pl_orbincllim',
        refCol: 'pl_orbincl_reflink',
      }),
      transitDurationHours: buildMeasurement(row, 'pl_trandur', 'h', {
        err1Col: 'pl_trandurerr1',
        err2Col: 'pl_trandurerr2',
        limCol: 'pl_trandurlim',
        refCol: 'pl_trandur_reflink',
      }),
    },
    provenance: {
      primarySourceId: 'nasa-exoplanet-archive',
      upstreamQueryUrl,
      notes:
        'Live query of the NASA Exoplanet Archive Planetary Systems Composite Parameters table (pscomppars). ' +
        'Composite values can come from different publications, so each value carries its own reference; ' +
        'do not combine them as if they were one self-consistent solution. Null parameters were not reported in the archive.',
    },
  };
}

async function probeEndpoint(
  url: string,
  timeoutMs = 4500
): Promise<{ status: DataSourceStatus['status']; latencyMs: number | null; checkedUtc: string }> {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const checkedUtc = new Date().toISOString();

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent },
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - start);
    if (res.ok) {
      return { status: latencyMs > 3000 ? 'degraded' : 'operational', latencyMs, checkedUtc };
    }
    return { status: res.status >= 500 ? 'offline' : 'degraded', latencyMs, checkedUtc };
  } catch {
    return { status: 'offline', latencyMs: null, checkedUtc };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeDataSources(): Promise<DataSourceStatus[]> {
  const tapProbeUrl = `${NASA_TAP_URL}?query=${encodeURIComponent(
    'SELECT TOP 1 pl_name FROM pscomppars'
  )}&format=json`;

  const [tapProbe, hipsProbe, simbadProbe] = await Promise.all([
    probeEndpoint(tapProbeUrl, 6000),
    probeEndpoint(ALADIN_HIPS_PROPS_URL, 4000),
    probeEndpoint(SIMBAD_SESAME_URL, 4000),
  ]);

  return [
    {
      id: 'nasa-exoplanet-archive',
      name: 'NASA Exoplanet Archive (TAP Service)',
      provider: 'Caltech / IPAC / NExScI',
      endpointUrl: NASA_TAP_URL,
      schemaOrVersion: 'Planetary Systems Composite Parameters (pscomppars)',
      status: tapProbe.status,
      latencyMs: tapProbe.latencyMs,
      lastCheckedUtc: tapProbe.checkedUtc,
      citationText:
        'This research has made use of the NASA Exoplanet Archive, operated by the California Institute of Technology, under contract with NASA under the Exoplanet Exploration Program.',
      licenseOrTermsUrl: 'https://exoplanetarchive.ipac.caltech.edu/docs/acknowledge.html',
    },
    {
      id: 'cds-aladin-hips',
      name: 'Aladin Lite v3 & HiPS Sky Surveys',
      provider: 'CDS Strasbourg & IVOA HiPS Network',
      endpointUrl: 'https://alasky.cds.unistra.fr',
      schemaOrVersion: 'IVOA HiPS 1.0 / Aladin Lite v3 (WebGL2/WASM)',
      status: hipsProbe.status,
      latencyMs: hipsProbe.latencyMs,
      lastCheckedUtc: hipsProbe.checkedUtc,
      citationText:
        'Aladin Sky Atlas (Bonnarel et al. 2000; Boch & Fernique 2014; Baumann et al. 2022), CDS Strasbourg.',
      licenseOrTermsUrl: 'https://aladin.cds.unistra.fr/AladinLite/',
    },
    {
      id: 'cds-simbad-sesame',
      name: 'SIMBAD / Sesame Name Resolver',
      provider: 'CDS Strasbourg (Mirrors: CfA Harvard, IDIA)',
      endpointUrl: 'https://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame',
      schemaOrVersion: 'IVOA Sesame XML / TAP',
      status: simbadProbe.status,
      latencyMs: simbadProbe.latencyMs,
      lastCheckedUtc: simbadProbe.checkedUtc,
      citationText:
        'Wenger et al. 2000, A&AS 143, 9 — The SIMBAD astronomical database.',
      licenseOrTermsUrl: 'https://simbad.cds.unistra.fr/simbad/',
    },
  ];
}
