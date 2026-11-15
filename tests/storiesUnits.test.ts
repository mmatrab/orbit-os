import { describe, expect, it } from 'vitest';
import {
  EARTH_YEAR_DAYS,
  LIGHT_YEARS_PER_PARSEC,
  parsecsToLightYears,
  periodInEarthYears,
} from '../src/stories/planetSnapshot.ts';
import { plainNumber } from '../src/components/FindAWorld.tsx';

describe('unit conversion for the guided path', () => {
  it('uses 1 parsec = 3.26156 light-years', () => {
    expect(LIGHT_YEARS_PER_PARSEC).toBe(3.26156);
    expect(parsecsToLightYears(1)).toBeCloseTo(3.26156, 10);
    // TRAPPIST-1 in the archive: 12.42988881 pc → about 40.54 light-years.
    expect(parsecsToLightYears(12.42988881)).toBeCloseTo(40.541, 3);
    expect(parsecsToLightYears(0)).toBe(0);
    expect(parsecsToLightYears(10)).toBeCloseTo(32.6156, 8);
  });

  it('refuses to convert a missing or impossible distance instead of guessing', () => {
    expect(parsecsToLightYears(null)).toBeNull();
    expect(parsecsToLightYears(undefined)).toBeNull();
    expect(parsecsToLightYears(-1)).toBeNull();
    expect(parsecsToLightYears(Number.NaN)).toBeNull();
    expect(parsecsToLightYears(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('compares an orbital period with an Earth year of 365.25 days', () => {
    expect(EARTH_YEAR_DAYS).toBe(365.25);
    expect(periodInEarthYears(365.25)).toBe(1);
    expect(periodInEarthYears(730.5)).toBe(2);
    expect(periodInEarthYears(6.101013)! * EARTH_YEAR_DAYS).toBeCloseTo(6.101013, 9);
    expect(periodInEarthYears(0)).toBeNull();
    expect(periodInEarthYears(null)).toBeNull();
  });

  it('rounds only the plain-language sentence, keeping sensible precision', () => {
    expect(plainNumber(40.541)).toBe('41');
    expect(plainNumber(6.101013)).toBe('6.1');
    expect(plainNumber(1.0)).toBe('1');
    expect(plainNumber(0.92)).toBe('0.92');
    expect(plainNumber(1234.5)).toBe('1,235');
  });
});
