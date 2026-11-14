import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMeasurement,
  classifyMassProvenance,
  clearTapCache,
  configureNasaTap,
  escapeAdqlString,
  getNasaExoplanetDetail,
  parseRefLink,
  searchNasaExoplanets,
} from '../server/nasaTap.ts';
import { makeTapFetch, SYNTHETIC_TAP_URL, syntheticDetailRow } from './fixtures.ts';

const realFetch = globalThis.fetch;

describe('reference parsing', () => {
  it('extracts label and ADS bibcode from archive reference HTML', () => {
    const parsed = parseRefLink(
      '<a refstr=AGOL_ET_AL__2021 href=https://ui.adsabs.harvard.edu/abs/2021PSJ.....2....1A/abstract target=ref>Agol et al. 2021</a>'
    );
    expect(parsed).toEqual({ label: 'Agol et al. 2021', bibcode: '2021PSJ.....2....1A' });
  });

  it('reduces hostile markup to plain text', () => {
    const parsed = parseRefLink('<img src=x onerror=alert(1)>Evil<script>alert(1)</script>');
    expect(parsed.label).not.toMatch(/[<>]/);
    expect(parsed.bibcode).toBeUndefined();
  });
});

describe('measurements', () => {
  it('keeps asymmetric uncertainties as positive magnitudes', () => {
    const m = buildMeasurement(syntheticDetailRow(), 'st_teff', 'K', {
      err1Col: 'st_tefferr1',
      err2Col: 'st_tefferr2',
      limCol: 'st_tefflim',
    });
    expect(m).toMatchObject({ value: 5000, errPlus: 50, errMinus: 70, isSymmetricErr: false, status: 'measured' });
  });

  it('marks limit flags instead of presenting a measurement', () => {
    const m = buildMeasurement(syntheticDetailRow(), 'pl_orbeccen', '', { limCol: 'pl_orbeccenlim' });
    expect(m.status).toBe('upper_limit');
  });

  it('reports a missing value as not measured, never as zero', () => {
    const m = buildMeasurement(syntheticDetailRow({ pl_rade: null }), 'pl_rade', 'R_earth');
    expect(m.value).toBeNull();
    expect(m.status).toBe('not_measured');
  });
});

describe('mass provenance', () => {
  it.each([
    ['M*sini', 'msini'],
    ['Msini', 'msini'],
    ['Mass', 'mass'],
    ['M*sin(i)/sin(i)', 'msini_over_sini'],
    ['Mass-Radius relationship', 'other'],
    ['', 'unknown'],
  ])('%s -> %s', (raw, kind) => {
    expect(classifyMassProvenance(raw)).toBe(kind);
  });
});

describe('ADQL safety', () => {
  it('doubles single quotes', () => {
    expect(escapeAdqlString("x' OR '1'='1")).toBe("x'' OR ''1''=''1");
  });
});

describe('archive adapter with a stubbed TAP service', () => {
  const log: string[] = [];

  beforeEach(() => {
    log.length = 0;
    configureNasaTap({ tapUrl: SYNTHETIC_TAP_URL, cacheTtlSeconds: 600 });
    clearTapCache();
    vi.stubGlobal('fetch', makeTapFetch(realFetch, syntheticDetailRow(), log));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('labels a minimum mass as M sin i (archive writes "M*sini")', async () => {
    const detail = await getNasaExoplanetDetail('TEST-1 b');
    expect(detail?.planetaryParameters.massIsMsini).toBe(true);
    expect(detail?.planetaryParameters.massProvenance).toBe('M*sini');
  });

  it('never invents coordinates or discovery years', async () => {
    vi.stubGlobal('fetch', makeTapFetch(realFetch, syntheticDetailRow({ ra: null, dec: null, disc_year: null })));
    const detail = await getNasaExoplanetDetail('TEST-1 b');
    expect(detail?.hostStar.raDeg).toBeNull();
    expect(detail?.hostStar.decDeg).toBeNull();
    expect(detail?.discoveryYear).toBeNull();
  });

  it('keeps the published discovery method text', async () => {
    const result = await searchNasaExoplanets({ q: 'test' });
    expect(result.items[0].discoveryMethod).toBe('Pulsar Timing');
    expect(result.items[0].massIsMsini).toBe(true);
  });

  it('escapes user input inside the search query', async () => {
    await searchNasaExoplanets({ q: "o'brien" });
    expect(log.some((q) => q.includes("o''brien"))).toBe(true);
  });

  it('reuses cached upstream answers', async () => {
    await searchNasaExoplanets({ q: 'cache' });
    const callsAfterFirst = log.length;
    await searchNasaExoplanets({ q: 'cache' });
    expect(log.length).toBe(callsAfterFirst);
  });

  it('returns null for an unknown planet', async () => {
    expect(await getNasaExoplanetDetail('NOPE-9 z')).toBeNull();
  });
});
