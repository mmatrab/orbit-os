import { describe, expect, it } from 'vitest';
import {
  buildSystemGeometry,
  keplerSemiMajorAxisAu,
  planetColour,
  starColour,
} from '../src/viewer3d/systemGeometry';

const TRAPPIST_1_E = {
  periodDays: 6.101013,
  semiMajorAxisAu: 0.02925,
  starMassSolar: 0.089,
  starRadiusSolar: 0.121,
  planetRadiusEarth: 0.92,
  inclinationDeg: 89.8,
};

describe('buildSystemGeometry', () => {
  it('places TRAPPIST-1 e at about 52 star radii on the published scale', () => {
    const g = buildSystemGeometry(TRAPPIST_1_E);
    expect(g.orbitToScale).toBeGreaterThan(50);
    expect(g.orbitToScale).toBeLessThan(54);
  });

  it('keeps the planet small relative to its star on the published scale', () => {
    const g = buildSystemGeometry(TRAPPIST_1_E);
    expect(g.planetToScale).toBeGreaterThan(0.06);
    expect(g.planetToScale).toBeLessThan(0.08);
  });

  it('enlarges small planets in the clear view but keeps the clamp', () => {
    const g = buildSystemGeometry(TRAPPIST_1_E);
    expect(g.planetClear).toBeGreaterThanOrEqual(0.25);
    expect(g.planetClear).toBeLessThanOrEqual(0.5);
    const giant = buildSystemGeometry({ ...TRAPPIST_1_E, planetRadiusEarth: 11 });
    expect(giant.planetClear).toBe(0.5);
  });

  it('compresses wide orbits in the clear view', () => {
    const near = buildSystemGeometry({ ...TRAPPIST_1_E, semiMajorAxisAu: 0.05 });
    const far = buildSystemGeometry({ ...TRAPPIST_1_E, semiMajorAxisAu: 5 });
    expect(far.orbitClear).toBeGreaterThan(near.orbitClear);
    expect(far.orbitClear).toBeLessThan(far.orbitToScale);
  });

  it('derives the orbit from the period and star mass when the semi-major axis is missing', () => {
    const g = buildSystemGeometry({ ...TRAPPIST_1_E, semiMajorAxisAu: null });
    const expected = keplerSemiMajorAxisAu(6.101013, 0.089);
    expect(expected).toBeGreaterThan(0.027);
    expect(expected).toBeLessThan(0.031);
    expect(g.orbitToScale).toBeGreaterThan(50);
    expect(g.notes.some((n) => n.includes('Kepler'))).toBe(true);
  });

  it('says what is assumed when values are missing', () => {
    const g = buildSystemGeometry({
      periodDays: null,
      semiMajorAxisAu: null,
      starMassSolar: null,
      starRadiusSolar: null,
      planetRadiusEarth: null,
      inclinationDeg: null,
    });
    expect(Number.isFinite(g.orbitToScale)).toBe(true);
    expect(g.notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Star radius not published'),
        expect.stringContaining('Orbit size not published'),
        expect.stringContaining('Planet radius not published'),
        expect.stringContaining('Inclination not published'),
      ])
    );
  });
});

describe('keplerSemiMajorAxisAu', () => {
  it('returns 1 AU for one Earth year around a Sun-mass star', () => {
    expect(keplerSemiMajorAxisAu(365.25, 1)).toBeCloseTo(1, 6);
  });
});

describe('colours', () => {
  it('returns a valid hex colour for every star temperature', () => {
    for (const t of [null, 2000, 3500, 5778, 9000, 30000]) {
      expect(starColour(t)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('gives cooler stars more red and hotter stars more blue', () => {
    const channel = (hex: string, from: number) => parseInt(hex.slice(from, from + 2), 16);
    const cool = starColour(3000);
    const hot = starColour(10000);
    expect(channel(cool, 1)).toBeGreaterThan(channel(hot, 1));
    expect(channel(hot, 5)).toBeGreaterThan(channel(cool, 5));
  });

  it('returns a valid hex colour for every planet temperature', () => {
    for (const t of [null, 150, 290, 700, 1600, 3000]) {
      expect(planetColour(t)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
