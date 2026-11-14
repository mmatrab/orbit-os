import type { ScientificMeasurement } from '../api/contracts';

/** Friendly unit labels for the overview; the full tables keep the archive's own unit strings. */
const UNIT_LABELS: Record<string, string> = {
  R_earth: 'Earth radii',
  M_earth: 'Earth masses',
  d: 'days',
};

export function friendlyUnit(unit: string): string {
  return UNIT_LABELS[unit] ?? unit;
}

/**
 * Display text for a measurement, without the unit. One rule for every view:
 * limits as "< x" / "> x", symmetric errors as "± e", asymmetric as "(+a / -b)",
 * and null when nothing was measured. Published numbers are never rounded.
 */
export function formatMeasurementValue(m: ScientificMeasurement<number>): string | null {
  if (m.value === null || m.status === 'not_measured') return null;
  const prefix = m.status === 'upper_limit' ? '< ' : m.status === 'lower_limit' ? '> ' : '';
  let err = '';
  if (m.errPlus !== null && m.errPlus !== undefined) {
    err = m.isSymmetricErr ? ` ± ${m.errPlus}` : ` (+${m.errPlus} / -${m.errMinus ?? '?'})`;
  }
  return `${prefix}${m.value}${err}`;
}
