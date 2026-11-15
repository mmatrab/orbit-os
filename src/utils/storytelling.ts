import type { ScientificMeasurement } from '../api/contracts';

export const LIGHT_YEARS_PER_PARSEC = 3.26156;
export const EARTH_YEAR_DAYS = 365.25;

/** Exact conversion factor agreed in the product brief; a derived display value, not a new observation. */
export function parsecsToLightYears(parsecs: number | null): number | null {
  return typeof parsecs === 'number' && Number.isFinite(parsecs) && parsecs > 0
    ? parsecs * LIGHT_YEARS_PER_PARSEC
    : null;
}

/** A limit with unknown direction cannot be used as if it were a measured size or period. */
export function usableScientificValue(measurement: ScientificMeasurement<number>): number | null {
  const value = measurement.value;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (
    measurement.status === 'not_measured' ||
    measurement.status === 'upper_limit' ||
    measurement.status === 'lower_limit' ||
    measurement.status === 'limit_direction_unverified'
  ) return null;
  return value;
}

export function describeEarthYear(periodDays: number | null): string | null {
  if (periodDays === null || !Number.isFinite(periodDays) || periodDays <= 0) return null;
  const multiple = periodDays / EARTH_YEAR_DAYS;
  if (Math.abs(multiple - 1) < 0.01) return 'Its year is about as long as ours.';
  const factor = multiple < 1 ? 1 / multiple : multiple;
  return `Its year is about ${Number(factor.toPrecision(2))} times ${multiple < 1 ? 'shorter' : 'longer'} than Earth’s.`;
}

export function displayQuantity(value: number): string {
  return Number(value.toPrecision(4)).toLocaleString('en-US', { maximumFractionDigits: 3 });
}
