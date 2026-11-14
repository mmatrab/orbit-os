import { describe, expect, it } from 'vitest';
import type { ScientificMeasurement } from '../src/api/contracts.ts';
import { formatMeasurementValue, friendlyUnit } from '../src/utils/measurementFormat.ts';

const m = (over: Partial<ScientificMeasurement<number>>): ScientificMeasurement<number> => ({
  value: 1.5,
  unit: 'R_earth',
  status: 'measured',
  ...over,
});

describe('overview formatting (same rule as the detailed tables)', () => {
  it('shows symmetric and asymmetric uncertainties without rounding', () => {
    expect(formatMeasurementValue(m({ value: 4.230785, errPlus: 3.6e-5, errMinus: 3.6e-5, isSymmetricErr: true }))).toBe(
      '4.230785 ± 0.000036'
    );
    expect(formatMeasurementValue(m({ errPlus: 0.13, errMinus: 0.09, isSymmetricErr: false }))).toBe('1.5 (+0.13 / -0.09)');
  });

  it('never shows a limit as a plain value', () => {
    expect(formatMeasurementValue(m({ value: 0.05, status: 'upper_limit' }))).toMatch(/0\.05/);
    expect(formatMeasurementValue(m({ value: 0.05, status: 'upper_limit' }))).not.toBe('0.05');
  });

  it('returns null when nothing was measured', () => {
    expect(formatMeasurementValue(m({ value: null, status: 'not_measured' }))).toBeNull();
  });

  it('uses plain-language units in the overview only for known archive units', () => {
    expect(friendlyUnit('R_earth')).toBe('Earth radii');
    expect(friendlyUnit('M_earth')).toBe('Earth masses');
    expect(friendlyUnit('d')).toBe('days');
    expect(friendlyUnit('K')).toBe('K');
  });
});
