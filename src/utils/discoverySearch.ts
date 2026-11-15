import type { DiscoveryMethod, ExoplanetSearchItem } from '../api/contracts';
import { methodGroup, type SnapshotPlanet } from '../stories/planetSnapshot';

export type SearchObjectType = 'planet' | 'system';
export type PlanetSizeFilter = 'all' | 'small' | 'medium' | 'large';

export interface DiscoveryFilters {
  query: string;
  objectType: SearchObjectType;
  planetSize: PlanetSizeFilter;
  discoveryMethod: DiscoveryMethod | 'ALL';
}

export interface DiscoverySuggestion {
  id: string;
  label: string;
  detail: string;
  planetName: string;
  hostname: string;
  distancePc: number | null;
  count: number;
  objectType: SearchObjectType;
}

export const PLANET_SIZE_LABELS: Record<PlanetSizeFilter, string> = {
  all: 'Any size',
  small: 'Small (< 1.5 Earth radii)',
  medium: 'Medium (1.5–4 Earth radii)',
  large: 'Large (4+ Earth radii)',
};

function radiusMatches(p: Pick<SnapshotPlanet, 'radiusEarth' | 'radiusStatus'>, size: PlanetSizeFilter): boolean {
  if (size === 'all') return true;
  const radius = p.radiusEarth;
  // NASA's raw limit flag has an unresolved direction. Never classify a limit as an exact size.
  if (radius === null || !Number.isFinite(radius) || radius <= 0 || p.radiusStatus === 'l') return false;
  if (size === 'small') return radius < 1.5;
  if (size === 'medium') return radius >= 1.5 && radius < 4;
  return radius >= 4;
}

function scoreMatch(p: { planetName: string; hostname: string }, query: string): number {
  if (!query) return 0;
  const name = p.planetName.toLowerCase();
  const star = p.hostname.toLowerCase();
  if (name === query || star === query) return 0;
  if (name.startsWith(query) || star.startsWith(query)) return 1;
  return 2;
}

/** Instant, local suggestions from the real dated NASA snapshot (not fictional examples). */
export function discoverySuggestions(
  planets: readonly SnapshotPlanet[],
  filters: DiscoveryFilters,
  limit = 7
): { suggestions: DiscoverySuggestion[]; matchedPlanets: number; matchedSystems: number } {
  const query = filters.query.trim().toLowerCase();
  const matched = planets.filter((p) =>
    p.planetName &&
    p.hostname &&
    (!query || p.planetName.toLowerCase().includes(query) || p.hostname.toLowerCase().includes(query)) &&
    (filters.discoveryMethod === 'ALL' || methodGroup(p.discoveryMethod) === filters.discoveryMethod) &&
    radiusMatches(p, filters.planetSize)
  );
  const systems = new Set(matched.map((p) => p.hostname!.toLowerCase()));
  const sorted = [...matched].sort((a, b) =>
    scoreMatch({ planetName: a.planetName, hostname: a.hostname! }, query) -
    scoreMatch({ planetName: b.planetName, hostname: b.hostname! }, query) ||
    (a.distancePc ?? Infinity) - (b.distancePc ?? Infinity) ||
    a.planetName.localeCompare(b.planetName)
  );
  if (filters.objectType === 'planet') {
    return {
      matchedPlanets: matched.length,
      matchedSystems: systems.size,
      suggestions: sorted.slice(0, limit).map((p) => ({
        id: p.planetName,
        label: p.planetName,
        detail: `${p.hostname} · ${p.discoveryMethod || 'Method not reported'}`,
        planetName: p.planetName,
        hostname: p.hostname!,
        distancePc: p.distancePc,
        count: 1,
        objectType: 'planet' as const,
      })),
    };
  }

  const groups = new Map<string, SnapshotPlanet[]>();
  for (const p of sorted) {
    const key = p.hostname!.toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(p);
    groups.set(key, group);
  }
  return {
    matchedPlanets: matched.length,
    matchedSystems: groups.size,
    suggestions: [...groups.values()].slice(0, limit).map((group) => ({
      id: group[0].hostname!,
      label: group[0].hostname!,
      detail: `${group.length} matching confirmed planet${group.length === 1 ? '' : 's'} · open the system`,
      planetName: group[0].planetName,
      hostname: group[0].hostname!,
      distancePc: group[0].distancePc,
      count: group.length,
      objectType: 'system' as const,
    })),
  };
}

export function liveResultSuggestions(
  items: readonly ExoplanetSearchItem[],
  filters: DiscoveryFilters,
  limit = 7
): DiscoverySuggestion[] {
  const planets: SnapshotPlanet[] = items.map((p) => ({
    planetName: p.planetName,
    hostname: p.hostname,
    discoveryMethod: p.discoveryMethod,
    discoveryYear: p.discoveryYear,
    discoveryBibcode: null,
    orbitalPeriodDays: p.orbitalPeriodDays,
    orbitalPeriodStatus: null,
    radiusEarth: p.radiusEarth,
    radiusStatus: null,
    distancePc: p.distancePc,
  }));
  return discoverySuggestions(planets, filters, limit).suggestions;
}
