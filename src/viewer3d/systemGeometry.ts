// Pure geometry and colour helpers for the 3D system view.
// No DOM and no three.js here, so these rules are unit-tested directly.
//
// Scene units: the host star has radius 1. Everything else is expressed in
// star radii. "To scale" uses published values. "Clear view" keeps the same
// order of magnitude but compresses distances and enlarges small planets so
// they can be seen. The UI labels both modes.

export const AU_KM = 149_597_870.7;
export const R_SUN_KM = 695_700;
export const R_EARTH_KM = 6_371;

export type ScaleMode = 'to-scale' | 'clear';

export interface SystemInput {
  periodDays: number | null;
  semiMajorAxisAu: number | null;
  starMassSolar: number | null;
  starRadiusSolar: number | null;
  planetRadiusEarth: number | null;
  inclinationDeg: number | null;
}

export interface SystemGeometry {
  /** Orbit radius in star radii, using the published scale. */
  orbitToScale: number;
  /** Planet radius in star radii, using the published scale. */
  planetToScale: number;
  /** Orbit radius for the clear view. */
  orbitClear: number;
  /** Planet radius for the clear view. */
  planetClear: number;
  inclinationDeg: number;
  /** Plain-language notes shown under the view: assumptions and missing values. */
  notes: string[];
}

export function keplerSemiMajorAxisAu(periodDays: number, starMassSolar: number): number {
  const years = periodDays / 365.25;
  return Math.cbrt(starMassSolar * years * years);
}

function finitePositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function buildSystemGeometry(input: SystemInput): SystemGeometry {
  const notes: string[] = [];

  let starRadius = 1;
  if (finitePositive(input.starRadiusSolar)) {
    starRadius = input.starRadiusSolar;
  } else {
    notes.push('Star radius not published: drawn as a Sun-sized star.');
  }

  let semiMajorAxisAu: number;
  if (finitePositive(input.semiMajorAxisAu)) {
    semiMajorAxisAu = input.semiMajorAxisAu;
  } else if (finitePositive(input.periodDays)) {
    const mass = finitePositive(input.starMassSolar) ? input.starMassSolar : 1;
    semiMajorAxisAu = keplerSemiMajorAxisAu(input.periodDays, mass);
    notes.push(
      finitePositive(input.starMassSolar)
        ? 'Orbit size worked out from the orbital period and the star mass (Kepler).'
        : 'Orbit size worked out from the orbital period, assuming a Sun-mass star.'
    );
  } else {
    semiMajorAxisAu = 1;
    notes.push('Orbit size not published: drawn at 1 AU as a placeholder.');
  }

  let planetRadiusEarth: number;
  if (finitePositive(input.planetRadiusEarth)) {
    planetRadiusEarth = input.planetRadiusEarth;
  } else {
    planetRadiusEarth = 1;
    notes.push('Planet radius not published: drawn at Earth size.');
  }

  let inclinationDeg = 0;
  if (typeof input.inclinationDeg === 'number' && Number.isFinite(input.inclinationDeg)) {
    inclinationDeg = input.inclinationDeg;
  } else {
    notes.push('Inclination not published: orbit drawn flat, seen from above.');
  }

  const orbitToScale = (semiMajorAxisAu * AU_KM) / (starRadius * R_SUN_KM);
  const planetToScale = (planetRadiusEarth * R_EARTH_KM) / (starRadius * R_SUN_KM);

  return {
    orbitToScale,
    planetToScale,
    orbitClear: 3 + 4 * Math.log10(orbitToScale + 1),
    planetClear: Math.min(0.5, Math.max(0.25, planetToScale * 3)),
    inclinationDeg,
    notes,
  };
}

// Approximate blackbody colours for stellar effective temperature.
const STAR_STOPS: Array<[number, string]> = [
  [2500, '#ff9a5a'],
  [3500, '#ffb878'],
  [4500, '#ffd6a5'],
  [5800, '#fff3e0'],
  [7000, '#f5f8ff'],
  [9000, '#dbe7ff'],
  [12000, '#bcd2ff'],
];

// Artistic colours for a planet, from its equilibrium temperature.
// Not a measured surface colour.
const PLANET_STOPS: Array<[number, string]> = [
  [200, '#8fb8d8'],
  [300, '#6fb08f'],
  [450, '#b9a46a'],
  [800, '#c77a4a'],
  [1400, '#b84a3a'],
  [2200, '#7a3a3a'],
];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function interpolateStops(stops: Array<[number, string]>, x: number): string {
  if (x <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i += 1) {
    const [x1, c1] = stops[i];
    if (x <= x1) {
      const [x0, c0] = stops[i - 1];
      const t = (x - x0) / (x1 - x0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return stops[stops.length - 1][1];
}

export function starColour(teffK: number | null): string {
  if (teffK === null || !Number.isFinite(teffK)) return '#ffe6b0';
  return interpolateStops(STAR_STOPS, teffK);
}

export function planetColour(equilibriumTempK: number | null): string {
  if (equilibriumTempK === null || !Number.isFinite(equilibriumTempK)) return '#9a9a9a';
  return interpolateStops(PLANET_STOPS, equilibriumTempK);
}

/** Motion is sped up on purpose: one orbit every 12 seconds, whatever the real period. */
export const SECONDS_PER_ORBIT = 12;
