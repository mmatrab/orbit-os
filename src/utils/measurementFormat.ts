import type { ScientificMeasurement } from '../api/contracts';

/** Unit labels shown on screen. Exports keep the API's unit codes (R_earth, M_earth, d, …) for analysis. */
const UNIT_LABELS: Record<string, string> = {
  R_earth: 'Earth radii',
  M_earth: 'Earth masses',
  d: 'days',
  h: 'hours',
  pc: 'parsecs',
  K: 'K',
  M_sun: 'solar masses',
  R_sun: 'solar radii',
  S_earth: '× Earth’s sunlight',
  'g/cm^3': 'g/cm³',
  AU: 'AU',
  deg: 'degrees',
  dex: 'dex',
  mag: 'mag',
  dimensionless: '',
};

export function friendlyUnit(unit: string): string {
  return UNIT_LABELS[unit] ?? unit;
}

/**
 * The NASA Exoplanet Archive does not document, for the pscomppars table, which limit-flag value
 * means an upper and which a lower limit (its only definition is a 2012 page for a retired table,
 * contradicted by later third-party sources). Until that is verified, limits are shown without a
 * direction instead of with a possibly reversed "<" or ">". Set to true only once verified.
 */
export const LIMIT_DIRECTION_VERIFIED = false;
export const UNVERIFIED_LIMIT_LABEL = 'Limit — direction unverified';

export function isLimit(m: ScientificMeasurement<number>): boolean {
  return (
    m.status === 'upper_limit' ||
    m.status === 'lower_limit' ||
    m.status === 'limit_direction_unverified'
  );
}

/**
 * Display text for a measurement, without the unit. One rule for every view and export:
 * limits labelled (see LIMIT_DIRECTION_VERIFIED), symmetric errors as "± e", asymmetric as
 * "(+a / -b)", and null when nothing was measured. Published numbers are never rounded.
 */
export function formatMeasurementValue(m: ScientificMeasurement<number>): string | null {
  if (m.value === null || m.status === 'not_measured') return null;
  let err = '';
  if (m.errPlus !== null && m.errPlus !== undefined) {
    err = m.isSymmetricErr ? ` ± ${m.errPlus}` : ` (+${m.errPlus} / -${m.errMinus ?? '?'})`;
  }
  if (m.status === 'limit_direction_unverified' || (isLimit(m) && !LIMIT_DIRECTION_VERIFIED)) {
    return `${UNVERIFIED_LIMIT_LABEL}: ${m.value}${err}`;
  }
  const prefix = m.status === 'upper_limit' ? '< ' : m.status === 'lower_limit' ? '> ' : '';
  return `${prefix}${m.value}${err}`;
}

/** Status text for exports: limit statuses lose their direction until it is verified. */
export function exportStatus(m: ScientificMeasurement<number>): string {
  return isLimit(m) && !LIMIT_DIRECTION_VERIFIED ? 'limit_direction_unverified' : m.status;
}
