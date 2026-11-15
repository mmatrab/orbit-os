import { describe, expect, it } from 'vitest';
import { filterForLogPlot, logPosition, logTicks, type SnapshotPlanet, type ValueStatus } from '../src/stories/planetSnapshot.ts';

const p = (
  name: string,
  period: number | null,
  radius: number | null,
  radiusStatus: ValueStatus | null = radius === null ? null : 'm',
  periodStatus: ValueStatus | null = period === null ? null : 'm'
): SnapshotPlanet => ({
  planetName: name,
  hostname: 'TEST STAR',
  discoveryMethod: 'Transit',
  discoveryYear: 2020,
  discoveryBibcode: null,
  orbitalPeriodDays: period,
  orbitalPeriodStatus: periodStatus,
  radiusEarth: radius,
  radiusStatus,
  distancePc: null,
});

const planets = [
  p('measured', 4, 1),
  p('derived radius', 12, 2, 'd'),
  p('no period', null, 1.2),
  p('no radius', 60, null),
  p('radius limit', 5, 1, 'l'),
  p('period limit', 5, 1, 'm', 'l'),
  p('zero period', 0, 1),
  p('negative radius', 3, -1),
];

describe('logarithmic radius–period filter', () => {
  it('keeps only planets with both values finite and above zero, and measured radii by default', () => {
    const r = filterForLogPlot(planets);
    expect(r.plotted.map((x) => x.planet.planetName)).toEqual(['measured']);
    expect(r.excluded).toEqual({ missing_period: 1, missing_radius: 1, limit: 2, derived_radius: 1, not_positive: 2 });
    expect(r.plotted.length + r.excludedTotal).toBe(planets.length);
  });

  it('adds archive-derived radii only on request, and flags them', () => {
    const r = filterForLogPlot(planets, { includeDerivedRadius: true });
    expect(r.plotted.map((x) => [x.planet.planetName, x.radiusDerived])).toEqual([
      ['measured', false],
      ['derived radius', true],
    ]);
    expect(r.excluded.derived_radius).toBe(0);
  });

  it('never plots a limit, even when asked for derived values', () => {
    const r = filterForLogPlot(planets, { includeDerivedRadius: true });
    expect(r.plotted.some((x) => x.planet.planetName.includes('limit'))).toBe(false);
  });

  it('places values on a log scale and ticks at powers of ten', () => {
    expect(logPosition(10, 1, 100)).toBeCloseTo(0.5, 12);
    expect(logPosition(1, 1, 100)).toBe(0);
    expect(logPosition(100, 1, 100)).toBe(1);
    expect(logTicks(0.1, 1000)).toEqual([0.1, 1, 10, 100, 1000]);
  });
});
