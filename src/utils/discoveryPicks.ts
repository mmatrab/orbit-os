import type { SnapshotPlanet } from '../stories/planetSnapshot';

export type DiscoveryTheme = 'nearby' | 'earth-size' | 'families';

export interface DiscoveryPick {
  /** Exact existing NASA planet identifier for opening the live scientific detail. */
  planetName: string;
  title: string;
  description: string;
  distancePc: number | null;
}

const hasDistance = (p: SnapshotPlanet) =>
  p.distancePc !== null && Number.isFinite(p.distancePc) && p.distancePc > 0;

const byDistance = (a: SnapshotPlanet, b: SnapshotPlanet) =>
  (a.distancePc ?? Infinity) - (b.distancePc ?? Infinity) ||
  a.planetName.localeCompare(b.planetName);

/** One planet per host so nearby suggestions don't all show the same planetary system. */
function uniqueHosts(planets: SnapshotPlanet[], limit: number): SnapshotPlanet[] {
  const seen = new Set<string>();
  const result: SnapshotPlanet[] = [];
  for (const planet of planets) {
    if (!planet.hostname || !planet.planetName) continue;
    const hostKey = planet.hostname.toLocaleLowerCase('en-US');
    if (seen.has(hostKey)) continue;
    seen.add(hostKey);
    result.push(planet);
    if (result.length === limit) break;
  }
  return result;
}

/**
 * Transparent, data-driven starting points selected from a dated NASA snapshot.
 * Never infers composition, habitability, or the likelihood of life.
 */
export function buildDiscoveryPicks(
  planets: readonly SnapshotPlanet[],
  theme: DiscoveryTheme,
  limit = 3
): DiscoveryPick[] {
  if (!Number.isInteger(limit) || limit <= 0) return [];
  const eligible = planets.filter((p) => p.planetName && p.hostname);
  if (theme === 'nearby') {
    return uniqueHosts(eligible.filter(hasDistance).sort(byDistance), limit).map((p) => ({
      planetName: p.planetName,
      title: p.planetName,
      description: `Near us · orbits ${p.hostname}`,
      distancePc: p.distancePc,
    }));
  }

  if (theme === 'earth-size') {
    // Radius range is a human-readable browsing filter, not a claim of Earth similarity.
    // A limit flagged by the NASA archive cannot be treated as an exact radius.
    const sizes = eligible.filter((p) =>
      p.radiusStatus === 'm' &&
      p.radiusEarth !== null &&
      Number.isFinite(p.radiusEarth) &&
      p.radiusEarth >= 0.8 &&
      p.radiusEarth <= 1.25
    );
    sizes.sort((a, b) => Number(hasDistance(b)) - Number(hasDistance(a)) || byDistance(a, b));
    return uniqueHosts(sizes, limit).map((p) => ({
      planetName: p.planetName,
      title: p.planetName,
      description: `${p.radiusEarth} Earth radii · measured radius`,
      distancePc: p.distancePc,
    }));
  }

  const groups = new Map<string, SnapshotPlanet[]>();
  for (const p of eligible) {
    const key = p.hostname!.toLocaleLowerCase('en-US');
    const group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((members) => members.length >= 3)
    .sort((a, b) =>
      b.length - a.length ||
      (a[0].hostname ?? '').localeCompare(b[0].hostname ?? '')
    )
    .slice(0, limit)
    .map((members) => {
      const representative = [...members].sort((a, b) => a.planetName.localeCompare(b.planetName))[0];
      return {
        planetName: representative.planetName,
        title: representative.hostname!,
        description: `${members.length} confirmed planets · open ${representative.planetName}`,
        distancePc: representative.distancePc,
      };
    });
}
