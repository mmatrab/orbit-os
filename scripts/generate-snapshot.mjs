/**
 * Generate a dated, independently verifiable snapshot directly from the NASA
 * Exoplanet Archive TAP endpoint (one bulk query, no browser pagination).
 *
 * Run: npm run snapshot
 * Requires network access to exoplanetarchive.ipac.caltech.edu.
 * On failure this script exits non-zero and never writes fake/partial data.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const SOURCE = 'NASA Exoplanet Archive';
const TABLE = 'pscomppars';
const QUERY = [
  'SELECT pl_name, hostname, discoverymethod, disc_year,',
  'pl_orbper, pl_orbperlim, pl_rade, pl_radelim, sy_dist, ra, dec',
  'FROM pscomppars ORDER BY pl_name',
].join(' ');

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 120000);
try {
  const url = new URL(TAP);
  url.searchParams.set('query', QUERY);
  url.searchParams.set('format', 'json');
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ORBIT-Space-Explorer/snapshot (research)' },
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`NASA TAP HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length < 1000) {
    throw new Error(`Unexpected NASA response: ${Array.isArray(rows) ? rows.length : typeof rows} rows. No snapshot written.`);
  }
  const planets = rows.map((row) => ({
    planetName: String(row.pl_name ?? ''),
    hostname: String(row.hostname ?? ''),
    discoveryMethod: String(row.discoverymethod ?? 'Other'),
    discoveryYear: numberOrNull(row.disc_year),
    orbitalPeriodDays: numberOrNull(row.pl_orbper),
    radiusEarth: numberOrNull(row.pl_rade),
    radiusLimitFlag: numberOrNull(row.pl_radelim),
    periodLimitFlag: numberOrNull(row.pl_orbperlim),
    distancePc: numberOrNull(row.sy_dist),
    raDeg: numberOrNull(row.ra),
    decDeg: numberOrNull(row.dec),
  }));
  if (planets.some((planet) => !planet.planetName)) throw new Error('NASA returned unnamed planets. No snapshot written.');
  const names = new Set(planets.map((p) => p.planetName));
  if (names.size !== planets.length) throw new Error('Duplicate planet names in NASA response. No snapshot written.');

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const snapshot = {
    schemaVersion: 'orbit-os.planets-snapshot.v1',
    retrievedAtUtc: now.toISOString(),
    source: SOURCE,
    table: TABLE,
    query: QUERY,
    totalCount: planets.length,
    planets,
  };
  const json = JSON.stringify(snapshot);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes >= 2_000_000) {
    throw new Error(`Snapshot is ${bytes} bytes (> 2 MB). Move generation to a server-side build job; no file written.`);
  }
  const dir = join(process.cwd(), 'data', 'snapshots');
  const publicDir = join(process.cwd(), 'public', 'data', 'snapshots');
  await Promise.all([mkdir(dir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
  const name = `planets-${date}.json`;
  await writeFile(join(dir, name), json, 'utf8');
  // Vite copies /public into production builds, so the browser only fetches one dated file.
  await writeFile(join(publicDir, name), json, 'utf8');
  await writeFile(join(publicDir, 'latest.json'), json, 'utf8');
  console.log(`NASA snapshot: ${name}; ${planets.length} planets; ${bytes} bytes; ${snapshot.retrievedAtUtc}`);
} catch (error) {
  console.error('Snapshot generation failed, no substitute dataset created:', error);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
}
