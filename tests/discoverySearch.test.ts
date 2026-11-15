import { describe, expect, it } from 'vitest';
import { discoverySuggestions, liveResultSuggestions, type DiscoveryFilters } from '../src/utils/discoverySearch';
import type { SnapshotPlanet } from '../src/stories/planetSnapshot';

const planet = (
  planetName: string,
  hostname: string,
  radiusEarth: number | null,
  radiusStatus: SnapshotPlanet['radiusStatus'] = 'm',
  method = 'Transit',
  distancePc: number | null = 12
): SnapshotPlanet => ({
  planetName,
  hostname,
  discoveryMethod: method,
  discoveryYear: 2020,
  discoveryBibcode: null,
  orbitalPeriodDays: 3,
  orbitalPeriodStatus: 'm',
  radiusEarth,
  radiusStatus,
  distancePc,
});

const rows = [
  planet('TEST-1 b', 'TEST-1', 1),
  planet('TEST-1 c', 'TEST-1', 2),
  planet('TEST-2 b', 'TEST-2', 8, 'm', 'Radial Velocity'),
  planet('TEST-3 b', 'TEST-3', 1.2, 'l'),
] satisfies SnapshotPlanet[];

const filters: DiscoveryFilters = { query: '', objectType: 'planet', planetSize: 'all', discoveryMethod: 'ALL' };

describe('Search discovery suggestions (synthetic fixture, never shown to users)', () => {
  it('offers nearby real-catalogue entries even with an empty query', () => {
    const result = discoverySuggestions(rows, filters);
    expect(result.matchedPlanets).toBe(4);
    expect(result.suggestions.map((s) => s.planetName)).toHaveLength(4);
  });
  it('matches case-insensitive substrings of planet or host star names', () => {
    expect(discoverySuggestions(rows, { ...filters, query: 'test-1' }).matchedPlanets).toBe(2);
    expect(discoverySuggestions(rows, { ...filters, query: 'TEST-2' }).suggestions[0].planetName).toBe('TEST-2 b');
  });
  it('groups distinct host systems and reports the number of matching planets', () => {
    const result = discoverySuggestions(rows, { ...filters, objectType: 'system' });
    expect(result.matchedSystems).toBe(3);
    expect(result.suggestions.find((s) => s.hostname === 'TEST-1')?.count).toBe(2);
  });
  it('does not treat unresolved NASA radius limits as measured size classes', () => {
    const small = discoverySuggestions(rows, { ...filters, planetSize: 'small' });
    expect(small.suggestions.map((s) => s.planetName)).toEqual(['TEST-1 b']);
    const large = discoverySuggestions(rows, { ...filters, planetSize: 'large' });
    expect(large.suggestions.map((s) => s.planetName)).toEqual(['TEST-2 b']);
  });
  it('filters by discovery method and groups uncommon methods under Other', () => {
    expect(discoverySuggestions(rows, { ...filters, discoveryMethod: 'Radial Velocity' }).matchedPlanets).toBe(1);
    expect(discoverySuggestions([planet('TEST-4 b', 'TEST-4', 2, 'm', 'Pulsar Timing')], { ...filters, discoveryMethod: 'Other' }).matchedPlanets).toBe(1);
  });
  it('can use current live NASA API results if the snapshot is unavailable', () => {
    const result = liveResultSuggestions([{
      id:'TEST-1 b',planetName:'TEST-1 b',hostname:'TEST-1',discoveryMethod:'Transit',
      discoveryYear:2020,raDeg:10,decDeg:5,orbitalPeriodDays:3,radiusEarth:1,
      massEarth:null,massIsMsini:false,distancePc:12,spectralType:null
    }], filters);
    expect(result[0].planetName).toBe('TEST-1 b');
  });
});
