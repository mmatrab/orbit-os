/**
 * Pure helpers for the storytelling views (guided path, discovery timeline, radius–period chart).
 * Everything here works on the dated snapshot written by scripts/build-planet-snapshot.ts.
 * Nothing is estimated or filled in: a missing value stays null and is counted as left out.
 */
import type { DiscoveryMethod } from '../api/contracts';

/** IAU 2012 / 2015 definitions: 1 pc = 648000/π au and 1 ly = 63241.077 au, so 1 pc ≈ 3.26156 ly. */
export const LIGHT_YEARS_PER_PARSEC = 3.26156;
/** Julian year in days, the reference "Earth year" used for the comparisons. */
export const EARTH_YEAR_DAYS = 365.25;

/** Converts parsecs to light-years. Returns null for anything that is not a finite, non-negative number. */
export function parsecsToLightYears(pc: number | null | undefined): number | null {
  if (typeof pc !== 'number' || !Number.isFinite(pc) || pc < 0) return null;
  return pc * LIGHT_YEARS_PER_PARSEC;
}

/** Orbital period in days as a fraction (or multiple) of Earth's year. */
export function periodInEarthYears(days: number | null | undefined): number | null {
  if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0) return null;
  return days / EARTH_YEAR_DAYS;
}

/** Display order required by the brief, also the stacking order (bottom to top) of the timeline. */
export const METHOD_ORDER: readonly DiscoveryMethod[] = [
  'Transit',
  'Radial Velocity',
  'Imaging',
  'Microlensing',
  'Transit Timing Variations',
  'Astrometry',
  'Other',
];

/** Plain-language names, with the technical term kept for the tooltip. */
export const METHOD_PLAIN: Record<DiscoveryMethod, { label: string; explain: string }> = {
  Transit: { label: 'Transit', explain: 'The star dims a little each time the planet passes in front of it.' },
  'Radial Velocity': {
    label: 'Star wobble',
    explain: 'Radial velocity: the planet pulls its star back and forth, which shifts the colour of its light.',
  },
  Imaging: { label: 'Direct image', explain: 'Imaging: the planet itself is photographed, next to its blocked-out star.' },
  Microlensing: {
    label: 'Microlensing',
    explain: "The star's gravity briefly magnifies a more distant star; the planet adds a small extra bump.",
  },
  'Transit Timing Variations': {
    label: 'Transit timing',
    explain: "Transit timing variations: a known planet's transits arrive early or late, pulled by another planet.",
  },
  Astrometry: { label: 'Astrometry', explain: "The star's position on the sky moves in a tiny loop." },
  Other: {
    label: 'Other methods',
    explain:
      'Pulsar timing, eclipse timing, orbital brightness changes, pulsation timing and disk motion, grouped because each has few planets.',
  },
};

const NAMED_METHODS: ReadonlySet<string> = new Set(METHOD_ORDER.filter((m) => m !== 'Other'));

/** Maps the archive's discovery-method text to one of the seven chart groups; the raw text is kept elsewhere. */
export function methodGroup(raw: string | null | undefined): DiscoveryMethod {
  return raw && NAMED_METHODS.has(raw) ? (raw as DiscoveryMethod) : 'Other';
}

/** "m" measured · "d" derived by the archive · "l" limit with unverified direction. */
export type ValueStatus = 'm' | 'd' | 'l';

export interface SnapshotPlanet {
  planetName: string;
  hostname: string | null;
  discoveryMethod: string | null;
  discoveryYear: number | null;
  discoveryBibcode: string | null;
  orbitalPeriodDays: number | null;
  orbitalPeriodStatus: ValueStatus | null;
  radiusEarth: number | null;
  radiusStatus: ValueStatus | null;
  distancePc: number | null;
}

export interface SnapshotFile {
  schemaVersion: number;
  retrievedAtUtc: string;
  source: { name: string; table: string; tapUrl: string; query: string; citation: string };
  rowCount: number;
  columns: string[];
  rows: unknown[][];
}

export interface PlanetSnapshot {
  retrievedAtUtc: string;
  sourceName: string;
  table: string;
  query: string;
  citation: string;
  planets: SnapshotPlanet[];
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const status = (v: unknown): ValueStatus | null => (v === 'm' || v === 'd' || v === 'l' ? v : null);

/** Turns the compact column/row file into objects, by column name, so column order can change safely. */
export function decodeSnapshot(file: SnapshotFile): PlanetSnapshot {
  const at = (name: string) => {
    const i = file.columns.indexOf(name);
    if (i < 0) throw new Error(`Snapshot is missing column "${name}"`);
    return i;
  };
  const c = {
    planetName: at('planetName'),
    hostname: at('hostname'),
    discoveryMethod: at('discoveryMethod'),
    discoveryYear: at('discoveryYear'),
    discoveryBibcode: at('discoveryBibcode'),
    orbitalPeriodDays: at('orbitalPeriodDays'),
    orbitalPeriodStatus: at('orbitalPeriodStatus'),
    radiusEarth: at('radiusEarth'),
    radiusStatus: at('radiusStatus'),
    distancePc: at('distancePc'),
  };
  const planets = file.rows.map((r) => ({
    planetName: String(r[c.planetName]),
    hostname: str(r[c.hostname]),
    discoveryMethod: str(r[c.discoveryMethod]),
    discoveryYear: num(r[c.discoveryYear]),
    discoveryBibcode: str(r[c.discoveryBibcode]),
    orbitalPeriodDays: num(r[c.orbitalPeriodDays]),
    orbitalPeriodStatus: status(r[c.orbitalPeriodStatus]),
    radiusEarth: num(r[c.radiusEarth]),
    radiusStatus: status(r[c.radiusStatus]),
    distancePc: num(r[c.distancePc]),
  }));
  if (planets.length !== file.rowCount) {
    throw new Error(`Snapshot says ${file.rowCount} planets but holds ${planets.length}`);
  }
  return {
    retrievedAtUtc: file.retrievedAtUtc,
    sourceName: file.source.name,
    table: file.source.table,
    query: file.source.query,
    citation: file.source.citation,
    planets,
  };
}

// ---------------------------------------------------------------------------
// Part 2: discoveries per year, stacked by method
// ---------------------------------------------------------------------------

export interface YearBin {
  year: number;
  total: number;
  byMethod: Record<DiscoveryMethod, number>;
}

export interface DiscoveryBins {
  bins: YearBin[];
  /** Planets counted in the bins (equals the snapshot size when every planet has a year). */
  counted: number;
  /** Planets without a discovery year, left out of the chart and reported. */
  withoutYear: number;
  /** Totals per method across all years. */
  methodTotals: Record<DiscoveryMethod, number>;
}

function emptyCounts(): Record<DiscoveryMethod, number> {
  return Object.fromEntries(METHOD_ORDER.map((m) => [m, 0])) as Record<DiscoveryMethod, number>;
}

/**
 * One bin per calendar year from the first to the last discovery year, including years with no
 * discovery (shown as an empty bar rather than skipped, so the time axis stays honest).
 */
export function binDiscoveriesByYear(planets: readonly Pick<SnapshotPlanet, 'discoveryYear' | 'discoveryMethod'>[]): DiscoveryBins {
  const byYear = new Map<number, Record<DiscoveryMethod, number>>();
  const methodTotals = emptyCounts();
  let withoutYear = 0;
  for (const p of planets) {
    const y = p.discoveryYear;
    if (y === null || !Number.isInteger(y)) {
      withoutYear += 1;
      continue;
    }
    const g = methodGroup(p.discoveryMethod);
    const counts = byYear.get(y) ?? emptyCounts();
    counts[g] += 1;
    byYear.set(y, counts);
    methodTotals[g] += 1;
  }
  const years = [...byYear.keys()];
  const bins: YearBin[] = [];
  if (years.length) {
    const first = Math.min(...years);
    const last = Math.max(...years);
    for (let year = first; year <= last; year++) {
      const byMethod = byYear.get(year) ?? emptyCounts();
      const total = METHOD_ORDER.reduce((s, m) => s + byMethod[m], 0);
      bins.push({ year, total, byMethod });
    }
  }
  return { bins, counted: planets.length - withoutYear, withoutYear, methodTotals };
}

/** Year totals restricted to the methods currently shown (legend toggles). */
export function visibleTotal(bin: YearBin, hidden: ReadonlySet<DiscoveryMethod>): number {
  return METHOD_ORDER.reduce((s, m) => s + (hidden.has(m) ? 0 : bin.byMethod[m]), 0);
}

// ---------------------------------------------------------------------------
// Milestones: each one is backed by a published paper AND re-checked against the snapshot
// ---------------------------------------------------------------------------

export interface MilestoneSpec {
  id: string;
  year: number;
  /** ADS bibcode of the discovery paper, as recorded by the archive (disc_refname). */
  bibcode: string;
  sourceLabel: string;
  /** Builds the sentence from what the snapshot actually holds; never a hard-coded count. */
  text: (planets: SnapshotPlanet[]) => string;
  /** The claim the snapshot must support before the annotation is shown. */
  check: (planets: SnapshotPlanet[]) => boolean;
}

export interface Milestone {
  id: string;
  year: number;
  text: string;
  sourceLabel: string;
  sourceUrl: string;
  planetCount: number;
}

const fromPaper = (planets: SnapshotPlanet[], bibcode: string) => planets.filter((p) => p.discoveryBibcode === bibcode);

/**
 * Checked on 15 November 2026 against the NASA Exoplanet Archive pscomppars records (disc_refname,
 * disc_year, disc_facility, st_spectype). The journal, volume and page come from each ADS bibcode.
 * Wording is limited to facts those records support.
 */
export const MILESTONE_SPECS: MilestoneSpec[] = [
  {
    id: 'pulsar-1992',
    year: 1992,
    bibcode: '1992Natur.355..145W',
    sourceLabel: 'Wolszczan et al. 1992, Nature 355, 145',
    text: (ps) =>
      `The earliest discoveries in this archive: ${fromPaper(ps, '1992Natur.355..145W').length} planets around PSR B1257+12, a pulsar (the collapsed core of a dead star).`,
    check: (ps) => {
      const found = fromPaper(ps, '1992Natur.355..145W');
      const earliest = Math.min(...ps.map((p) => p.discoveryYear ?? Infinity));
      return found.length > 0 && found.every((p) => p.discoveryYear === 1992 && p.hostname === 'PSR B1257+12') && earliest === 1992;
    },
  },
  {
    id: '51peg-1995',
    year: 1995,
    bibcode: '1995Natur.378..355M',
    sourceLabel: 'Mayor & Queloz 1995, Nature 378, 355',
    text: () => '51 Pegasi b: a planet found by the wobble of a Sun-type star (spectral type G), with a year of 4.2 days.',
    check: (ps) => {
      const p = ps.find((x) => x.planetName === '51 Peg b');
      return (
        !!p &&
        p.discoveryBibcode === '1995Natur.378..355M' &&
        p.discoveryYear === 1995 &&
        p.discoveryMethod === 'Radial Velocity' &&
        p.orbitalPeriodDays !== null &&
        Math.abs(p.orbitalPeriodDays - 4.23) < 0.01
      );
    },
  },
  {
    id: 'kepler-2016',
    year: 2016,
    bibcode: '2016ApJ...822...86M',
    sourceLabel: 'Morton et al. 2016, ApJ 822, 86',
    text: (ps) =>
      `${fromPaper(ps, '2016ApJ...822...86M').length.toLocaleString('en-US')} Kepler planets confirmed in a single paper, the tallest bar on the chart.`,
    check: (ps) => {
      const found = fromPaper(ps, '2016ApJ...822...86M');
      const { bins } = binDiscoveriesByYear(ps);
      const tallest = bins.reduce((a, b) => (b.total > a.total ? b : a), bins[0]);
      return (
        found.length > 0 &&
        found.every((p) => p.discoveryYear === 2016 && p.discoveryMethod === 'Transit') &&
        tallest?.year === 2016
      );
    },
  },
];

export function adsUrl(bibcode: string): string {
  return `https://ui.adsabs.harvard.edu/abs/${encodeURIComponent(bibcode)}/abstract`;
}

/** Only milestones whose claim the snapshot supports are returned. */
export function checkedMilestones(planets: SnapshotPlanet[], specs: MilestoneSpec[] = MILESTONE_SPECS): Milestone[] {
  return specs
    .filter((s) => s.check(planets))
    .map((s) => ({
      id: s.id,
      year: s.year,
      text: s.text(planets),
      sourceLabel: s.sourceLabel,
      sourceUrl: adsUrl(s.bibcode),
      planetCount: fromPaper(planets, s.bibcode).length,
    }));
}

// ---------------------------------------------------------------------------
// Part 3: logarithmic radius–period plot
// ---------------------------------------------------------------------------

export type ExclusionReason = 'missing_period' | 'missing_radius' | 'limit' | 'derived_radius' | 'not_positive';

export interface LogPoint {
  planet: SnapshotPlanet;
  periodDays: number;
  radiusEarth: number;
  radiusDerived: boolean;
}

export interface LogFilterResult {
  plotted: LogPoint[];
  excluded: Record<ExclusionReason, number>;
  excludedTotal: number;
}

/**
 * Keeps planets that can sit on two logarithmic axes: both values present, strictly positive and
 * finite, and not a limit. Archive-derived radii are left out unless asked for, and then flagged.
 * Each left-out planet is counted under its first failing reason.
 */
export function filterForLogPlot(
  planets: readonly SnapshotPlanet[],
  options: { includeDerivedRadius?: boolean } = {}
): LogFilterResult {
  const excluded: Record<ExclusionReason, number> = {
    missing_period: 0,
    missing_radius: 0,
    limit: 0,
    derived_radius: 0,
    not_positive: 0,
  };
  const plotted: LogPoint[] = [];
  for (const p of planets) {
    const per = p.orbitalPeriodDays;
    const rad = p.radiusEarth;
    let reason: ExclusionReason | null = null;
    if (per === null) reason = 'missing_period';
    else if (rad === null) reason = 'missing_radius';
    else if (p.orbitalPeriodStatus === 'l' || p.radiusStatus === 'l') reason = 'limit';
    else if (!(per > 0 && rad > 0 && Number.isFinite(per) && Number.isFinite(rad))) reason = 'not_positive';
    else if (p.radiusStatus === 'd' && !options.includeDerivedRadius) reason = 'derived_radius';
    if (reason) {
      excluded[reason] += 1;
      continue;
    }
    plotted.push({ planet: p, periodDays: per!, radiusEarth: rad!, radiusDerived: p.radiusStatus === 'd' });
  }
  const excludedTotal = Object.values(excluded).reduce((s, n) => s + n, 0);
  return { plotted, excluded, excludedTotal };
}

/** Maps a positive value onto [0, 1] between lo and hi on a log10 scale. */
export function logPosition(value: number, lo: number, hi: number): number {
  return (Math.log10(value) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
}

/** Powers of ten from lo to hi inclusive, for log-axis ticks. */
export function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = Math.ceil(Math.log10(lo) - 1e-9); e <= Math.floor(Math.log10(hi) + 1e-9); e++) out.push(10 ** e);
  return out;
}

/** Formats an ISO timestamp as "15 November 2026" for chart captions (UTC date). */
export function snapshotDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
