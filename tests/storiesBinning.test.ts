import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  METHOD_ORDER,
  binDiscoveriesByYear,
  checkedMilestones,
  decodeSnapshot,
  methodGroup,
  visibleTotal,
  type SnapshotFile,
  type SnapshotPlanet,
} from '../src/stories/planetSnapshot.ts';
import { niceMax } from '../src/components/DiscoveryTimeline.tsx';

const p = (name: string, year: number | null, method: string | null): SnapshotPlanet => ({
  planetName: name,
  hostname: 'TEST STAR',
  discoveryMethod: method,
  discoveryYear: year,
  discoveryBibcode: null,
  orbitalPeriodDays: null,
  orbitalPeriodStatus: null,
  radiusEarth: null,
  radiusStatus: null,
  distancePc: null,
});

describe('discovery-year binning (synthetic input)', () => {
  const planets = [
    p('A', 1995, 'Radial Velocity'),
    p('B', 1995, 'Transit'),
    p('C', 1998, 'Pulsar Timing'),
    p('D', null, 'Imaging'),
    p('E', 1998, null),
  ];
  const result = binDiscoveriesByYear(planets);

  it('keeps every year between the first and the last, empty years included', () => {
    expect(result.bins.map((b) => [b.year, b.total])).toEqual([
      [1995, 2],
      [1996, 0],
      [1997, 0],
      [1998, 2],
    ]);
  });

  it('groups methods outside the seven named ones into Other, never dropping a planet', () => {
    expect(methodGroup('Transit')).toBe('Transit');
    expect(methodGroup('Eclipse Timing Variations')).toBe('Other');
    expect(methodGroup(null)).toBe('Other');
    expect(result.bins[3].byMethod.Other).toBe(2);
    expect(result.methodTotals.Transit).toBe(1);
  });

  it('counts planets without a year separately so totals still add up', () => {
    expect(result.withoutYear).toBe(1);
    expect(result.counted).toBe(4);
    expect(result.bins.reduce((s, b) => s + b.total, 0) + result.withoutYear).toBe(planets.length);
  });

  it('recomputes year totals when legend items are hidden', () => {
    expect(visibleTotal(result.bins[0], new Set(['Transit']))).toBe(1);
    expect(visibleTotal(result.bins[0], new Set())).toBe(2);
  });

  it('rounds the axis maximum up to 1, 2 or 5 times a power of ten', () => {
    expect(niceMax(1504)).toBe(2000);
    expect(niceMax(380)).toBe(500);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(0)).toBe(1);
  });
});

describe('the committed NASA snapshot', () => {
  const dir = path.resolve(import.meta.dirname, '..', 'data', 'snapshots');
  const file = readdirSync(dir).filter((f) => /^planets-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop()!;
  const raw = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as SnapshotFile;
  const snap = decodeSnapshot(raw);

  it('records its source, query and retrieval time, and stays under 2 MB', () => {
    expect(raw.source.table).toBe('pscomppars');
    expect(raw.source.query).toMatch(/FROM pscomppars/);
    expect(Date.parse(raw.retrievedAtUtc)).not.toBeNaN();
    expect(file).toBe(`planets-${raw.retrievedAtUtc.slice(0, 10)}.json`);
    expect(readFileSync(path.join(dir, file)).byteLength).toBeLessThan(2 * 1024 * 1024);
  });

  it('timeline totals match the snapshot count', () => {
    const { bins, withoutYear } = binDiscoveriesByYear(snap.planets);
    const methodSum = bins.reduce((s, b) => s + METHOD_ORDER.reduce((t, m) => t + b.byMethod[m], 0), 0);
    expect(methodSum + withoutYear).toBe(raw.rowCount);
  });

  it('supports all three milestones, with counts taken from the data', () => {
    const ms = checkedMilestones(snap.planets);
    expect(ms.map((m) => m.year)).toEqual([1992, 1995, 2016]);
    expect(ms.every((m) => m.sourceUrl.startsWith('https://ui.adsabs.harvard.edu/abs/'))).toBe(true);
    expect(ms[0].planetCount).toBeGreaterThan(0);
    expect(ms[2].text).toContain(ms[2].planetCount.toLocaleString('en-US'));
  });

  it('drops a milestone the data no longer supports instead of showing it', () => {
    const without51Peg = snap.planets.filter((x) => x.planetName !== '51 Peg b');
    expect(checkedMilestones(without51Peg).map((m) => m.year)).toEqual([1992, 2016]);
  });
});
