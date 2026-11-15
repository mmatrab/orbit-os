import { describe, expect, it } from 'vitest';
import {
  describeEarthYear,
  displayQuantity,
  parsecsToLightYears,
  usableScientificValue,
  EARTH_YEAR_DAYS,
} from '../src/utils/storytelling';
import type { ScientificMeasurement } from '../src/api/contracts';

const measurement = (value: number | null, status: ScientificMeasurement<number>['status'] = 'measured'):
  ScientificMeasurement<number> => ({ value, status, unit: 'R_earth' });

describe('Find a world: scientific conversion and safeguards', () => {
  it('converts parsecs to light years with the stated factor', () => {
    expect(parsecsToLightYears(1)).toBe(3.26156);
    expect(parsecsToLightYears(10)).toBeCloseTo(32.6156, 8);
    expect(parsecsToLightYears(null)).toBeNull();
    expect(parsecsToLightYears(-1)).toBeNull();
  });
  it('does not treat an upper, lower or unverified limit as a measurement', () => {
    expect(usableScientificValue(measurement(0.05, 'limit_direction_unverified'))).toBeNull();
    expect(usableScientificValue(measurement(2, 'upper_limit'))).toBeNull();
    expect(usableScientificValue(measurement(2, 'lower_limit'))).toBeNull();
    expect(usableScientificValue(measurement(null))).toBeNull();
    expect(usableScientificValue(measurement(0))).toBeNull();
    expect(usableScientificValue(measurement(1.2, 'derived'))).toBe(1.2);
  });
  it('describes orbital periods against Earth without confusing days and years', () => {
    expect(describeEarthYear(EARTH_YEAR_DAYS)).toContain('about as long');
    expect(describeEarthYear(EARTH_YEAR_DAYS / 2)).toContain('2 times shorter');
    expect(describeEarthYear(EARTH_YEAR_DAYS * 2)).toContain('2 times longer');
    expect(describeEarthYear(null)).toBeNull();
  });
  it('formats tiny non-zero quantities without adding invented precision', () => {
    expect(displayQuantity(1.234567)).toBe('1.235');
  });
});
