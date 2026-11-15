/** Pure scientific chart helpers. All input must originate in a dated NASA snapshot. */

export const DISCOVERY_METHODS = [
  'Transit',
  'Radial Velocity',
  'Imaging',
  'Microlensing',
  'Transit Timing Variations',
  'Astrometry',
  'Other',
] as const;

export type DiscoveryCategory = (typeof DISCOVERY_METHODS)[number];

export interface SnapshotPlanet {
  planetName: string;
  hostname: string;
  discoveryMethod: string;
  discoveryYear: number | null;
  orbitalPeriodDays: number | null;
  radiusEarth: number | null;
  distancePc: number | null;
  raDeg: number | null;
  decDeg: number | null;
}

export interface PlanetSnapshot {
  schemaVersion: 'orbit-os.planets-snapshot.v1';
  retrievedAtUtc: string;
  source: string;
  table: string;
  query: string;
  totalCount: number;
  planets: SnapshotPlanet[];
}

export interface DiscoveryBin {
  year: number;
  counts: Record<DiscoveryCategory, number>;
  total: number;
}

export function discoveryCategory(method: string): DiscoveryCategory {
  return (DISCOVERY_METHODS as readonly string[]).includes(method)
    ? method as DiscoveryCategory
    : 'Other';
}

export function binDiscoveryYears(planets: readonly SnapshotPlanet[]): {
  bins: DiscoveryBin[];
  excluded: number;
} {
  const map = new Map<number, DiscoveryBin>();
  let excluded = 0;
  for (const planet of planets) {
    const year = planet.discoveryYear;
    if (year === null || !Number.isInteger(year) || year < 1900 || year > 2200) {
      excluded += 1;
      continue;
    }
    let bin = map.get(year);
    if (!bin) {
      bin = {
        year,
        counts: Object.fromEntries(DISCOVERY_METHODS.map((method) => [method, 0])) as Record<DiscoveryCategory, number>,
        total: 0,
      };
      map.set(year, bin);
    }
    bin.counts[discoveryCategory(planet.discoveryMethod)] += 1;
    bin.total += 1;
  }
  return { bins: [...map.values()].sort((a, b) => a.year - b.year), excluded };
}

/** Log charts accept finite strictly positive values only, not null or zeros. */
export function filterLoggable(planets: readonly SnapshotPlanet[]): {
  plotted: SnapshotPlanet[];
  excluded: number;
} {
  const plotted = planets.filter(({ orbitalPeriodDays, radiusEarth }) =>
    typeof orbitalPeriodDays === 'number' && Number.isFinite(orbitalPeriodDays) && orbitalPeriodDays > 0 &&
    typeof radiusEarth === 'number' && Number.isFinite(radiusEarth) && radiusEarth > 0
  );
  return { plotted, excluded: planets.length - plotted.length };
}

export function verifySnapshot(value: unknown): value is PlanetSnapshot {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<PlanetSnapshot>;
  return v.schemaVersion === 'orbit-os.planets-snapshot.v1' &&
    v.source === 'NASA Exoplanet Archive' &&
    v.table === 'pscomppars' &&
    typeof v.retrievedAtUtc === 'string' &&
    !Number.isNaN(Date.parse(v.retrievedAtUtc)) &&
    Array.isArray(v.planets) &&
    v.planets.length > 0 &&
    v.totalCount === v.planets.length;
}
