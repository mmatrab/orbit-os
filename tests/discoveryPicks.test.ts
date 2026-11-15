import { describe, expect, it } from 'vitest';
import { buildDiscoveryPicks } from '../src/utils/discoveryPicks';
import type { SnapshotPlanet } from '../src/stories/planetSnapshot';

const planet = (
  name: string,
  host: string,
  distance: number | null,
  radius: number | null,
  status: SnapshotPlanet['radiusStatus'] = 'm'
): SnapshotPlanet => ({
  planetName: name,
  hostname: host,
  distancePc: distance,
  radiusEarth: radius,
  radiusStatus: status,
  discoveryMethod: 'Transit',
  discoveryYear: 2021,
  discoveryBibcode: null,
  orbitalPeriodDays: 5,
  orbitalPeriodStatus: 'm',
});

const rows: SnapshotPlanet[] = [
  planet('TEST A b', 'TEST A', 5, 1.0),
  planet('TEST A c', 'TEST A', 5, 2.4),
  planet('TEST A d', 'TEST A', 5, 1.2),
  planet('TEST B b', 'TEST B', 12, 0.9),
  planet('TEST C b', 'TEST C', 30, 1.0, 'l'),
  planet('TEST D b', 'TEST D', null, 1.1),
];

describe('Data-powered NASA discovery categories (synthetic fixtures)', () => {
  it('recommends nearby known systems without repeating the same star', () => {
    const picks = buildDiscoveryPicks(rows, 'nearby', 3);
    expect(picks.map((p) => p.planetName)).toEqual(['TEST A b', 'TEST B b', 'TEST C b']);
  });
  it('selects only measured radii in the documented Earth-sized range', () => {
    const picks = buildDiscoveryPicks(rows, 'earth-size', 8);
    expect(picks.map((p) => p.planetName)).toEqual(['TEST A b', 'TEST B b', 'TEST D b']);
    expect(picks.some((p) => p.planetName === 'TEST C b')).toBe(false);
  });
  it('shows a multi-planet host based on exact catalogue counts', () => {
    const picks = buildDiscoveryPicks(rows, 'families');
    expect(picks).toHaveLength(1);
    expect(picks[0].title).toBe('TEST A');
    expect(picks[0].description).toContain('3 confirmed planets');
  });
  it('never creates a suggestion when no genuine input qualifies', () => {
    expect(buildDiscoveryPicks([], 'nearby')).toEqual([]);
    expect(buildDiscoveryPicks(rows, 'nearby', 0)).toEqual([]);
  });
});
