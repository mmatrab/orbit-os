import type {
  DataSourceStatus,
  DiscoveryMethod,
  ExoplanetDetail,
  ExoplanetSearchItem,
  MeasurementStatus,
  ScientificMeasurement,
  SearchTargetsParams,
} from '../src/api/contracts.ts';

const NASA_TAP_URL = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
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

const LEGACY_SLUG_TO_PL_NAME: Record<string, string> = {
  'trappist-1-e': 'TRAPPIST-1 e',
  'kepler-186-f': 'Kepler-186 f',
  '51-peg-b': '51 Peg b',
};

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

function escapeAdqlString(input: string): string {
  return input.replace(/'/g, "''");
}

function normalizeDiscoveryMethod(raw: unknown): DiscoveryMethod {
  if (typeof raw === 'string' && ALLOWED_DISCOVERY_METHODS.has(raw as DiscoveryMethod)) {
    return raw as DiscoveryMethod;
  }
  return 'Other';
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
function parseRefLink(raw: unknown): ParsedRefLink {
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

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function buildMeasurement(
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

  const limVal = options?.limCol ? toFiniteNumber(row[options.limCol]) : 0;
  let status: MeasurementStatus = options?.forceStatus ?? 'measured';
  if (!options?.forceStatus) {
    if (limVal === 1) status = 'upper_limit';
    else if (limVal === -1) status = 'lower_limit';
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
    referenceLabel: label,
    referenceBibcode: ref.bibcode,
  };
}

async function runTapQuery<T = Record<string, unknown>>(
  adql: string,
  timeoutMs = 15000
): Promise<T[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${NASA_TAP_URL}?query=${encodeURIComponent(adql)}&format=json`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ORBIT-OS-Space-Explorer/1.0',
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
    return json as T[];
  } catch (err) {
    if (err instanceof UpstreamTapError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UpstreamTapError(
        `NASA Exoplanet Archive TAP request timed out after ${timeoutMs} ms.`,
        504
      );
    }
    throw new UpstreamTapError(
      err instanceof Error ? err.message : 'Network error reaching NASA Exoplanet Archive TAP.',
      502
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
      ra, dec, pl_orbper, pl_rade, pl_bmasse, sy_dist, st_spectype
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
    discoveryMethod: normalizeDiscoveryMethod(r.discoverymethod),
    discoveryYear: toFiniteNumber(r.disc_year) ?? 0,
    raDeg: toFiniteNumber(r.ra) ?? 0,
    decDeg: toFiniteNumber(r.dec) ?? 0,
    orbitalPeriodDays: toFiniteNumber(r.pl_orbper),
    radiusEarth: toFiniteNumber(r.pl_rade),
    massEarth: toFiniteNumber(r.pl_bmasse),
    distancePc: toFiniteNumber(r.sy_dist),
    spectralType: typeof r.st_spectype === 'string' && r.st_spectype.trim() ? r.st_spectype.trim() : null,
    isDefaultParameterSet: true,
  }));

  return {
    totalCount,
    items,
    queryTimestampUtc: new Date().toISOString(),
  };
}

export async function getNasaExoplanetDetail(rawId: string): Promise<ExoplanetDetail | null> {
  const canonicalName = LEGACY_SLUG_TO_PL_NAME[rawId] ?? rawId.trim();
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
  const massIsMsini = bmassProv.toLowerCase() === 'msini';
  const massIsDerived = bmassProv.toLowerCase().includes('relationship');

  const plName = String(row.pl_name ?? canonicalName);
  const upstreamQueryUrl = `${NASA_TAP_URL}?query=${encodeURIComponent(
    `SELECT * FROM pscomppars WHERE pl_name = '${escapeAdqlString(plName)}'`
  )}&format=json`;

  return {
    id: plName,
    planetName: plName,
    archiveRecordTable: 'pscomppars (NASA Exoplanet Archive)',
    retrievedAtUtc: new Date().toISOString(),
    discoveryMethod: normalizeDiscoveryMethod(row.discoverymethod),
    discoveryYear: toFiniteNumber(row.disc_year) ?? 0,
    discoveryFacility:
      typeof row.disc_facility === 'string' && row.disc_facility.trim()
        ? row.disc_facility.trim()
        : 'Not recorded',
    discoveryReference: discRef.label ?? 'Not recorded',
    discoveryDoi: null,
    hostStar: {
      hostname: String(row.hostname ?? ''),
      raDeg: toFiniteNumber(row.ra) ?? 0,
      decDeg: toFiniteNumber(row.dec) ?? 0,
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
        'Live query from NASA Exoplanet Archive Composite Parameters (pscomppars). Null parameters reflect unmeasured or unreported archive columns.',
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
      headers: { 'User-Agent': 'ORBIT-OS-Space-Explorer/1.0' },
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
