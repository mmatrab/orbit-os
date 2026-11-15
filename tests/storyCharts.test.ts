import { describe, expect, it } from 'vitest';
import {
  binDiscoveryYears,
  discoveryCategory,
  filterLoggable,
  verifySnapshot,
  type SnapshotPlanet,
} from '../src/utils/storyCharts';

function planet(name: string, year: number | null, method: string, period: number | null, radius: number | null): SnapshotPlanet {
  return { planetName: name, hostname: 'TEST STAR', discoveryYear: year, discoveryMethod: method, orbitalPeriodDays: period, radiusEarth: radius, distancePc: null, raDeg: null, decDeg: null };
}

const SYNTHETIC: SnapshotPlanet[] = [
  planet('TEST A', 1995, 'Radial Velocity', 4, 1),
  planet('TEST B', 1995, 'Transit', 12, 2),
  planet('TEST C', 2018, 'Unknown Method', 0, 1.2),
  planet('TEST D', null, 'Imaging', 60, null),
];

describe('NASA snapshot discovery statistics (synthetic input)', () => {
  it('uses the seven documented categories and groups unknown methods into Other', () => {
    expect(discoveryCategory('Transit')).toBe('Transit');
    expect(discoveryCategory('Pulsar Timing')).toBe('Other');
    const result = binDiscoveryYears(SYNTHETIC);
    expect(result.excluded).toBe(1);
    expect(result.bins.map((bin) => [bin.year, bin.total])).toEqual([[1995, 2], [2018, 1]]);
    expect(result.bins[0].counts.Transit).toBe(1);
    expect(result.bins[0].counts['Radial Velocity']).toBe(1);
    expect(result.bins[1].counts.Other).toBe(1);
    expect(result.bins.reduce((sum, bin) => sum + bin.total, 0) + result.excluded).toBe(SYNTHETIC.length);
  });

  it('strictly excludes zero, null and non-positive axes on the logarithmic plot', () => {
    const result = filterLoggable(SYNTHETIC);
    expect(result.plotted.map((p) => p.planetName)).toEqual(['TEST A', 'TEST B']);
    expect(result.excluded).toBe(2);
    expect(filterLoggable([planet('TEST E', 2010, 'Transit', -5, 1)]).plotted).toEqual([]);
  });

  it('rejects records without an actual dated NASA snapshot and exact counts', () => {
    expect(verifySnapshot({})).toBe(false);
    expect(verifySnapshot({
      schemaVersion: 'orbit-os.planets-snapshot.v1',
      retrievedAtUtc: '2026-11-15T10:00:00.000Z',
      source: 'NASA Exoplanet Archive',
      table: 'pscomppars',
      query: 'SELECT...',
      totalCount: 2,
      planets: SYNTHETIC,
    })).toBe(false);
  });
});
