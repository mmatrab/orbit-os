/**
 * Regression: the limit-flag sign for NASA pscomppars is not documented reliably, so no view or
 * export may show a "<" or ">" for a limit until it is verified (LIMIT_DIRECTION_VERIFIED).
 */
import { describe, expect, it } from 'vitest';
import type { ExoplanetDetail, ScientificMeasurement } from '../src/api/contracts.ts';
import { buildEvidenceBundle, serializeBundleToCsv, serializeBundleToMarkdown } from '../src/utils/exportBundle.ts';
import {
  exportStatus,
  formatMeasurementValue,
  LIMIT_DIRECTION_VERIFIED,
  UNVERIFIED_LIMIT_LABEL,
} from '../src/utils/measurementFormat.ts';

const meas = (over: Partial<ScientificMeasurement<number>> = {}): ScientificMeasurement<number> => ({
  value: null,
  unit: 'dimensionless',
  status: 'not_measured',
  ...over,
});

/** Synthetic detail for a fictional planet; only the eccentricity carries a limit flag. */
function syntheticDetail(): ExoplanetDetail {
  return {
    id: 'TEST-1 b',
    planetName: 'TEST-1 b',
    archiveRecordTable: 'pscomppars (NASA Exoplanet Archive)',
    retrievedAtUtc: '2026-11-14T00:00:00Z',
    discoveryMethod: 'Radial Velocity',
    discoveryYear: 2001,
    discoveryFacility: 'Test Observatory',
    discoveryReference: 'Author et al. 2001',
    hostStar: {
      hostname: 'TEST-1', raDeg: 10.5, decDeg: -20.25, spectralType: null,
      distancePc: meas(), teffK: meas(), massSolar: meas(), radiusSolar: meas(), metallicityFeH: meas(), vMag: meas(),
    },
    planetaryParameters: {
      radiusEarth: meas(), massEarth: meas(), massIsMsini: false, massProvenance: null,
      equilibriumTempK: meas(), insolationFluxEarth: meas(), bulkDensityGcm3: meas(),
    },
    orbitalParameters: {
      periodDays: meas({ value: 3.5, unit: 'd', status: 'measured' }),
      semiMajorAxisAu: meas(),
      eccentricity: meas({ value: 0.05, status: 'limit_direction_unverified', rawLimitFlag: 1, rawLimitFlagColumn: 'pl_orbeccenlim' }),
      inclinationDeg: meas(),
      transitDurationHours: meas(),
    },
    provenance: { primarySourceId: 'nasa-exoplanet-archive' },
  };
}

describe('limit direction is not asserted while unverified', () => {
  it('is configured as unverified', () => {
    expect(LIMIT_DIRECTION_VERIFIED).toBe(false);
  });

  it.each(['limit_direction_unverified', 'upper_limit', 'lower_limit'] as const)('UI text for %s carries the label and no direction symbol', (status) => {
    const text = formatMeasurementValue(meas({ value: 0.05, status }));
    expect(text).toBe(`${UNVERIFIED_LIMIT_LABEL}: 0.05`);
    expect(text).not.toMatch(/[<>]/);
  });

  it('keeps uncertainties next to the labelled limit', () => {
    expect(
      formatMeasurementValue(meas({ value: 2, status: 'upper_limit', errPlus: 0.1, errMinus: 0.1, isSymmetricErr: true }))
    ).toBe(`${UNVERIFIED_LIMIT_LABEL}: 2 ± 0.1`);
  });

  it('leaves measured values unchanged', () => {
    expect(formatMeasurementValue(meas({ value: 3.5, status: 'measured' }))).toBe('3.5');
    expect(exportStatus(meas({ value: 3.5, status: 'measured' }))).toBe('measured');
  });

  it('Markdown export labels the limit instead of printing a bare value or a symbol', () => {
    const md = serializeBundleToMarkdown(buildEvidenceBundle(syntheticDetail(), 'live', [], []));
    const line = md.split('\n').find((l) => l.startsWith('- **Eccentricity:**'));
    expect(line).toBe(`- **Eccentricity:** ${UNVERIFIED_LIMIT_LABEL}: 0.05 dimensionless`);
  });

  it('CSV export does not claim a direction in its status column', () => {
    const csv = serializeBundleToCsv(buildEvidenceBundle(syntheticDetail(), 'live', [], []));
    const row = csv.split('\r\n').find((r) => r.startsWith('orbit,eccentricity,'));
    expect(row).toContain(',limit_direction_unverified,');
    expect(csv).not.toMatch(/upper_limit|lower_limit/);
  });
});
