/**
 * Writes a dated snapshot of every confirmed planet in the NASA Exoplanet Archive
 * (table pscomppars) for the storytelling charts:
 *
 *   npm run snapshot                 # writes data/snapshots/planets-YYYY-MM-DD.json
 *
 * Why a snapshot: the app's live search endpoint returns at most 100 rows per page, and the charts
 * need all ~6,500 planets. One TAP query here replaces thousands of browser requests, and the
 * file records exactly what was asked and when.
 *
 * Behind an HTTPS proxy, run with NODE_USE_ENV_PROXY=1 so Node's fetch uses it.
 *
 * Status codes per value (same rules as the detail panel, see server/nasaTap.ts buildMeasurement):
 *   "m" measured · "d" derived (archive reference says "Calculated Value") · "l" limit, direction unverified.
 * No value is filled in or estimated: missing stays null.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_TAP_URL, isArchiveCalculated, parseRefLink, toFiniteNumber } from '../server/nasaTap.ts';

const TABLE = 'pscomppars';
const QUERY = [
  'SELECT pl_name, hostname, discoverymethod, disc_year, disc_refname,',
  'pl_orbper, pl_orbperlim, pl_orbper_reflink,',
  'pl_rade, pl_radelim, pl_rade_reflink,',
  'sy_dist',
  `FROM ${TABLE}`,
  'ORDER BY pl_name',
].join(' ');

const MAX_BYTES = 2 * 1024 * 1024;

type Status = 'm' | 'd' | 'l';

function statusOf(value: number | null, limitFlag: unknown, reflink: unknown): Status | null {
  if (value === null) return null;
  const flag = toFiniteNumber(limitFlag);
  if (flag === 1 || flag === -1) return 'l';
  return isArchiveCalculated(parseRefLink(reflink).label) ? 'd' : 'm';
}

async function main() {
  const tapUrl = process.env.ORBIT_NASA_TAP_URL || DEFAULT_TAP_URL;
  const url = `${tapUrl}?format=json&query=${encodeURIComponent(QUERY)}`;
  const retrievedAtUtc = new Date().toISOString();
  console.log(`Querying ${tapUrl} (${TABLE})…`);

  const res = await fetch(url, { headers: { 'User-Agent': 'ORBIT-OS-Space-Explorer/1.0 (snapshot script)' } });
  if (!res.ok) throw new Error(`NASA TAP answered HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const raw = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('NASA TAP returned no rows; refusing to write an empty snapshot.');

  const columns = [
    'planetName',
    'hostname',
    'discoveryMethod',
    'discoveryYear',
    'discoveryBibcode',
    'orbitalPeriodDays',
    'orbitalPeriodStatus',
    'radiusEarth',
    'radiusStatus',
    'distancePc',
  ] as const;

  const rows = raw.map((r) => {
    const period = toFiniteNumber(r.pl_orbper);
    const radius = toFiniteNumber(r.pl_rade);
    const year = toFiniteNumber(r.disc_year);
    return [
      String(r.pl_name),
      typeof r.hostname === 'string' ? r.hostname : null,
      typeof r.discoverymethod === 'string' && r.discoverymethod.trim() ? r.discoverymethod.trim() : null,
      year === null ? null : Math.round(year),
      parseRefLink(r.disc_refname).bibcode ?? null,
      period,
      statusOf(period, r.pl_orbperlim, r.pl_orbper_reflink),
      radius,
      statusOf(radius, r.pl_radelim, r.pl_rade_reflink),
      toFiniteNumber(r.sy_dist),
    ];
  });

  const date = retrievedAtUtc.slice(0, 10);
  const snapshot = {
    schemaVersion: 1,
    retrievedAtUtc,
    source: {
      name: 'NASA Exoplanet Archive',
      table: TABLE,
      tableDescription: 'Planetary Systems Composite Parameters (one row per confirmed planet)',
      tapUrl,
      query: QUERY,
      citation:
        'This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of ' +
        'Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet ' +
        'Exploration Program.',
      statusCodes: {
        m: 'measured (published value)',
        d: 'derived (the archive calculated it from other values: reference "Calculated Value")',
        l: 'limit (archive limit flag set; direction not verified)',
      },
    },
    rowCount: rows.length,
    columns,
    rows,
  };

  const json = JSON.stringify(snapshot);
  if (Buffer.byteLength(json) > MAX_BYTES) {
    throw new Error(
      `Snapshot is ${(Buffer.byteLength(json) / 1e6).toFixed(2)} MB, over the 2 MB limit for a committed file. ` +
        'Generate it at build time instead (see docs/product/storytelling-enthusiast-path.md).'
    );
  }

  const outDir = path.resolve(import.meta.dirname, '..', 'data', 'snapshots');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `planets-${date}.json`);
  await writeFile(outFile, json + '\n');
  console.log(`Wrote ${outFile}: ${rows.length} planets, ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB, retrieved ${retrievedAtUtc}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
