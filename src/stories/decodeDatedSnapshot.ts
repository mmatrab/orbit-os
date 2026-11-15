import type { PlanetSnapshot, SnapshotPlanet } from './planetSnapshot';

/**
 * The committed file written by scripts/generate-snapshot.mjs uses named planet
 * objects. Older builds used compact column/row records; that remains supported
 * by decodeSnapshot in planetSnapshot.ts.
 */
export interface DatedSnapshotFile {
  schemaVersion: 'orbit-os.planets-snapshot.v1';
  retrievedAtUtc: string;
  source: 'NASA Exoplanet Archive';
  table: 'pscomppars';
  query: string;
  totalCount: number;
  planets: Array<{
    planetName: string;
    hostname: string;
    discoveryMethod: string;
    discoveryYear: number | null;
    orbitalPeriodDays: number | null;
    radiusEarth: number | null;
    radiusLimitFlag: number | null;
    periodLimitFlag: number | null;
    distancePc?: number | null;
    raDeg?: number | null;
    decDeg?: number | null;
  }>;
}

const finiteOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Only accept genuine NASA-sourced snapshots, complete enough for discovery.
 * The snapshot does not contain per-value paper references or measured-vs-derived
 * provenance, so an unflagged value has unknown measurement status (null), not 'm'.
 */
export function decodeDatedSnapshot(value: unknown): PlanetSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid NASA snapshot.');
  const file = value as Partial<DatedSnapshotFile>;
  if (file.schemaVersion !== 'orbit-os.planets-snapshot.v1' ||
      file.source !== 'NASA Exoplanet Archive' || file.table !== 'pscomppars' ||
      typeof file.retrievedAtUtc !== 'string' ||
      !Number.isFinite(Date.parse(file.retrievedAtUtc)) ||
      typeof file.query !== 'string' || !file.query.includes('pscomppars') ||
      !Array.isArray(file.planets) ||
      !Number.isInteger(file.totalCount) ||
      file.totalCount !== file.planets.length || file.planets.length === 0) {
    throw new Error('NASA snapshot has an unsupported or incomplete structure.');
  }
  const names = new Set<string>();
  const planets: SnapshotPlanet[] = file.planets.map((row) => {
    if (!row || typeof row.planetName !== 'string' || !row.planetName.trim() ||
        typeof row.hostname !== 'string' || !row.hostname.trim()) {
      throw new Error('NASA snapshot includes an unnamed planet or host.');
    }
    if (names.has(row.planetName)) throw new Error('NASA snapshot includes duplicate planet names.');
    names.add(row.planetName);
    return {
      planetName: row.planetName,
      hostname: row.hostname,
      discoveryMethod: typeof row.discoveryMethod === 'string' ? row.discoveryMethod : null,
      discoveryYear: finiteOrNull(row.discoveryYear),
      discoveryBibcode: null, // Not provided by this snapshot; never fabricate a paper reference.
      orbitalPeriodDays: finiteOrNull(row.orbitalPeriodDays),
      orbitalPeriodStatus: typeof row.periodLimitFlag === 'number' && row.periodLimitFlag !== 0 ? 'l' : null,
      radiusEarth: finiteOrNull(row.radiusEarth),
      radiusStatus: typeof row.radiusLimitFlag === 'number' && row.radiusLimitFlag !== 0 ? 'l' : null,
      distancePc: finiteOrNull(row.distancePc),
      raDeg: finiteOrNull(row.raDeg),
      decDeg: finiteOrNull(row.decDeg),
    };
  });

  return {
    retrievedAtUtc: file.retrievedAtUtc,
    sourceName: file.source,
    table: file.table,
    query: file.query,
    citation: 'NASA Exoplanet Archive, Planetary Systems Composite Parameters (pscomppars)',
    planets,
  };
}
