import { describe, expect, it } from 'vitest';
import { decodeDatedSnapshot } from '../src/stories/decodeDatedSnapshot';
import { snapshotWorldFacts } from '../src/utils/snapshotWorld';

const dated = {
  schemaVersion: 'orbit-os.planets-snapshot.v1',
  retrievedAtUtc: '2026-11-15T14:00:00.000Z',
  source: 'NASA Exoplanet Archive',
  table: 'pscomppars',
  query: 'SELECT pl_name, hostname, sy_dist FROM pscomppars',
  totalCount: 2,
  planets: [
    {
      planetName: 'TEST-1 b',
      hostname: 'TEST-1',
      discoveryMethod: 'Transit',
      discoveryYear: 2021,
      orbitalPeriodDays: 6,
      radiusEarth: 0.9,
      radiusLimitFlag: 0,
      periodLimitFlag: 0,
      distancePc: 12,
      raDeg: 34.2,
      decDeg: -3.5,
    },
    {
      planetName: 'TEST-2 b',
      hostname: 'TEST-2',
      discoveryMethod: 'Radial Velocity',
      discoveryYear: 2009,
      orbitalPeriodDays: 40,
      radiusEarth: 2,
      radiusLimitFlag: 1,
      periodLimitFlag: -1,
      distancePc: null,
      raDeg: null,
      decDeg: null,
    },
  ],
} as const;

describe('Real dated NASA snapshot format (synthetic fixture)', () => {
  it('decodes the actual generated schema without claiming unflagged values are directly measured', () => {
    const snapshot = decodeDatedSnapshot(dated);
    expect(snapshot.planets).toHaveLength(2);
    expect(snapshot.planets[0].radiusStatus).toBeNull();
    expect(snapshot.planets[0].orbitalPeriodStatus).toBeNull();
    expect(snapshot.planets[0].raDeg).toBe(34.2);
    expect(snapshot.planets[0].distancePc).toBe(12);
    expect(snapshot.sourceName).toBe('NASA Exoplanet Archive');
    expect(snapshot.table).toBe('pscomppars');
    expect(snapshot.planets[0].discoveryBibcode).toBeNull();
  });

  it('preserves scientific caution for both directions of unknown limit flags', () => {
    const planet = decodeDatedSnapshot(dated).planets[1];
    expect(planet.radiusStatus).toBe('l');
    expect(planet.orbitalPeriodStatus).toBe('l');
    const facts = snapshotWorldFacts(planet);
    expect(facts[0].value).toBeNull();
    expect(facts[2].value).toBeNull();
    expect(facts[0].description).toMatch(/direction is unverified/);
    expect(facts[2].description).not.toMatch(/40 Earth days/);
  });

  it('turns reported radius, distance and orbital period into transparent explanations', () => {
    const facts = snapshotWorldFacts(decodeDatedSnapshot(dated).planets[0]);
    expect(facts).toHaveLength(3);
    expect(facts[0].description).toMatch(/0.9 times Earth/);
    expect(facts[1].description).toMatch(/light-years away/);
    expect(facts[2].description).toMatch(/6 Earth days/);
  });

  it('rejects malformed or falsely identified archives', () => {
    expect(() => decodeDatedSnapshot({ ...dated, source: 'demo' })).toThrow();
    expect(() => decodeDatedSnapshot({ ...dated, totalCount: 999 })).toThrow();
    expect(() => decodeDatedSnapshot({ ...dated, planets: [dated.planets[0], dated.planets[0]] })).toThrow();
  });
});
