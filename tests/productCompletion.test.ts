/**
 * Regression tests for the final product-completion work: private-by-default notebook,
 * mirror-aware sky survey loading, sky-view export metadata and analysis-ready exports.
 * All archive rows used here are SYNTHETIC (see fixtures.ts).
 */
import fs from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSpaceExplorerApp } from '../server/app.ts';
import { loadConfig } from '../server/config.ts';
import { buildMeasurement, clearTapCache, configureNasaTap, getNasaExoplanetDetail, getTapStats, isArchiveCalculated } from '../server/nasaTap.ts';
import {
  HIPS_SURVEYS,
  HipsUnavailableError,
  findSurvey,
  isHipsTileUrl,
  parseHipsProperties,
  resolveHipsMirror,
} from '../src/sky/hips.ts';
import { aladinPermalink, buildSkyViewMetadata, skyFileStem, skyFooterLines } from '../src/sky/skySnapshot.ts';
import {
  CSV_HEADER,
  STATUS_LEGEND,
  buildEvidenceBundle,
  serializeBundleToCsv,
  serializeBundleToMarkdown,
} from '../src/utils/exportBundle.ts';
import { makeTapFetch, SYNTHETIC_TAP_URL, syntheticDetailRow } from './fixtures.ts';

const realFetch = globalThis.fetch;

describe('notebook storage mode', () => {
  let server: Server;
  let base: string;
  let tmp: string;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'orbit-nb-'));
    await fs.writeFile(path.join(tmp, 'index.html'), '<!doctype html><title>UI</title>');
    const config = loadConfig({ ORBIT_DATA_DIR: path.join(tmp, 'data'), ORBIT_TAP_URL: SYNTHETIC_TAP_URL, NODE_ENV: 'test' });
    const app = await createSpaceExplorerApp({ ...config, isProduction: true, staticDir: tmp });
    await new Promise<void>((r) => {
      server = app.listen(0, '127.0.0.1', () => r());
    });
    const a = server.address();
    if (!a || typeof a === 'string') throw new Error('no port');
    base = `http://127.0.0.1:${a.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('defaults to browser-local notes', () => {
    expect(loadConfig({}).notebookMode).toBe('browser');
    expect(loadConfig({ ORBIT_NOTEBOOK_MODE: 'SERVER' }).notebookMode).toBe('server');
    expect(() => loadConfig({ ORBIT_NOTEBOOK_MODE: 'public' })).toThrow(/ORBIT_NOTEBOOK_MODE/);
  });

  it('reports the storage mode in health', async () => {
    const health = await (await realFetch(`${base}/api/v1/health`)).json();
    expect(health.notebookStorage).toBe('browser');
  });

  it('does not expose a publicly writable shared notebook by default', async () => {
    const list = await realFetch(`${base}/api/v1/notebook/entries`);
    expect(list.status).toBe(403);
    const write = await realFetch(`${base}/api/v1/notebook/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: 'x', targetName: 'x', category: 'Target Screening', title: 't', body: 'b' }),
    });
    expect(write.status).toBe(403);
    expect((await realFetch(`${base}/api/v1/exports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403);
    await expect(fs.access(path.join(tmp, 'data', 'notebook.json'))).rejects.toThrow();
  });
});

describe('HiPS mirror resolution', () => {
  const props = 'obs_title = DSS colored\nobs_copyright = Credit text\nhips_tile_format = jpeg\nhips_order = 9\n';
  const reply = (status: number, text: string) => Promise.resolve({ ok: status < 400, status, text: () => Promise.resolve(text) });

  it('parses properties files', () => {
    expect(parseHipsProperties('# c\nhips_order = 9\nobs_title=X Y\n')).toEqual({ hips_order: '9', obs_title: 'X Y' });
  });

  it('skips unreachable or non-HiPS mirrors and uses a working one', async () => {
    const survey = findSurvey('P/DSS2/color');
    const calls: string[] = [];
    const fetchImpl = (url: string) => {
      calls.push(url);
      if (url.includes('alasky.cds')) return reply(404, 'Not found');
      if (url.includes('alaskybis')) return Promise.reject(new TypeError('Failed to fetch'));
      return reply(200, props);
    };
    const resolved = await resolveHipsMirror(survey, fetchImpl, 1000);
    expect(resolved.baseUrl).toBe('https://skies.esac.esa.int/DSSColor');
    expect(resolved.credit).toBe('Credit text');
    expect(calls).toHaveLength(3);
  });

  it('does not wait for a hanging mirror when another one works', async () => {
    const survey = { ...HIPS_SURVEYS[0], mirrors: ['https://hang.invalid/x', 'https://ok.invalid/x'] };
    const fetchImpl = (url: string, init?: { signal?: AbortSignal }) =>
      url.startsWith('https://hang')
        ? new Promise<never>((_, reject) =>
            init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
          )
        : reply(200, props);
    const t0 = Date.now();
    const resolved = await resolveHipsMirror(survey, fetchImpl, 5000);
    expect(resolved.baseUrl).toBe('https://ok.invalid/x');
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('times out mirrors that never answer', async () => {
    const survey = { ...HIPS_SURVEYS[0], mirrors: ['https://hang.invalid/x'] };
    const fetchImpl = (_u: string, init?: { signal?: AbortSignal }) =>
      new Promise<never>((_, reject) =>
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      );
    const err = await resolveHipsMirror(survey, fetchImpl, 30).catch((e) => e);
    expect(err).toBeInstanceOf(HipsUnavailableError);
    expect(err.attempts[0]).toMatch(/no response within/);
  });

  it('raises a clear error listing every attempt when nothing answers', async () => {
    const err = await resolveHipsMirror(HIPS_SURVEYS[0], () => reply(200, '<html>captive portal</html>'), 50).catch((e) => e);
    expect(err).toBeInstanceOf(HipsUnavailableError);
    expect(err.attempts).toHaveLength(HIPS_SURVEYS[0].mirrors.length);
    expect(err.message).toMatch(/Could not reach/);
  });

  it('recognises HiPS tile URLs on any mirror', () => {
    expect(isHipsTileUrl('https://skies.esac.esa.int/DSSColor/Norder7/Dir110000/Npix115490.jpg')).toBe(true);
    expect(isHipsTileUrl('https://alasky.cds.unistra.fr/DSS/DSSColor/Norder3/Allsky.jpg')).toBe(true);
    expect(isHipsTileUrl('https://alasky.cds.unistra.fr/DSS/DSSColor/properties')).toBe(false);
    expect(isHipsTileUrl('https://skies.esac.esa.int/DSSColor/Norder7/Dir0/Npix1.jpg', 'https://alasky.cds.unistra.fr/DSS/DSSColor')).toBe(false);
  });

  it('offers a fallback mirror for every whole-sky survey', () => {
    for (const s of HIPS_SURVEYS) expect(s.mirrors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('sky view export metadata', () => {
  const meta = buildSkyViewMetadata({
    planetName: 'TEST-1 b',
    hostName: 'TEST-1',
    raDeg: 10.5,
    decDeg: -20.25,
    fieldOfViewDeg: 0.25,
    surveyId: 'P/DSS2/color',
    surveyTitle: 'DSS colored',
    tileBaseUrl: 'https://skies.esac.esa.int/DSSColor',
    credit: 'Credit text',
    imageryConfirmed: true,
    now: new Date('2026-01-02T03:04:05Z'),
  });

  it('identifies target, coordinates, survey, credit and capture time', () => {
    const footer = skyFooterLines(meta).join('\n');
    for (const needle of ['TEST-1 b', 'TEST-1', '10.50000', '-20.25000', 'P/DSS2/color', 'Credit text', '2026-01-02T03:04:05.000Z', 'not visible']) {
      expect(footer).toContain(needle);
    }
    expect(meta.notes.join(' ')).toMatch(/not a photograph of the planet/);
  });

  it('builds a shareable Aladin Lite link and never invents coordinates', () => {
    const link = new URL(meta.aladinLitePermalink!);
    expect(link.hostname).toBe('aladin.cds.unistra.fr');
    expect(link.searchParams.get('target')).toBe('10.500000 -20.250000');
    expect(link.searchParams.get('survey')).toBe('P/DSS2/color');
    expect(aladinPermalink(null, 5, 1, 'P/DSS2/color')).toBeNull();
    expect(skyFooterLines({ ...meta, raDeg: null }).join(' ')).toContain('Coordinates not reported');
    expect(skyFileStem('TRAPPIST-1 e')).toBe('orbit-os_TRAPPIST-1-e_sky');
  });
});

describe('evidence exports', () => {
  beforeAll(() => {
    configureNasaTap({ tapUrl: SYNTHETIC_TAP_URL });
    clearTapCache();
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  async function syntheticDetail() {
    vi.stubGlobal('fetch', makeTapFetch(realFetch, syntheticDetailRow()));
    const detail = await getNasaExoplanetDetail('TEST-1 b');
    if (!detail) throw new Error('fixture missing');
    return detail;
  }

  const parseCsv = (text: string) =>
    text
      .trim()
      .split('\r\n')
      .map((line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/));

  it('CSV carries status, raw limit flag and reference columns on every row', async () => {
    const csv = serializeBundleToCsv(buildEvidenceBundle(await syntheticDetail(), 'live', [], []));
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...CSV_HEADER]);
    for (const r of rows) expect(r).toHaveLength(CSV_HEADER.length);
    const col = (name: string) => CSV_HEADER.indexOf(name as (typeof CSV_HEADER)[number]);

    const ecc = rows.find((r) => r[1] === 'eccentricity')!;
    expect(ecc[col('status')]).toBe('limit_direction_unverified');
    expect(ecc[col('raw_limit_flag')]).toBe('1');
    expect(ecc[col('raw_limit_flag_column')]).toBe('pl_orbeccenlim');

    const mass = rows.find((r) => r[1] === 'minimum_mass_msini')!;
    expect(mass[col('value')]).toBe('150');
    expect(mass[col('reference_bibcode')]).toBe('2001TEST....1....1A');
    expect(mass[col('note')]).toContain('M*sini');

    const radius = rows.find((r) => r[1] === 'radius')!;
    expect(radius[col('value')]).toBe('');
    expect(radius[col('status')]).toBe('not_measured');

    // Identifiers are not presented as measurements.
    expect(rows.find((r) => r[1] === 'planet_name')![col('status')]).toBe('identifier');
  });

  it('JSON and Markdown explain every status and keep derived values marked', async () => {
    const detail = await syntheticDetail();
    const bundle = buildEvidenceBundle(detail, 'live', [], []);
    const parsed = JSON.parse(JSON.stringify(bundle));
    expect(Object.keys(parsed.statusLegend)).toEqual(Object.keys(STATUS_LEGEND));
    expect(parsed.target.orbitalParameters.eccentricity.rawLimitFlagColumn).toBe('pl_orbeccenlim');

    const derivedDetail = {
      ...detail,
      planetaryParameters: {
        ...detail.planetaryParameters,
        bulkDensityGcm3: { ...detail.planetaryParameters.bulkDensityGcm3, value: 5.1, unit: 'g/cm³', status: 'derived' as const },
      },
    };
    const md = serializeBundleToMarkdown(buildEvidenceBundle(derivedDetail, 'live', [], []));
    expect(md).toMatch(/Bulk Density:\*\* 5\.1 g\/cm³ \*\*\(derived\)\*\*/);
    expect(md).toContain('Limit — direction unverified');
    expect(md).toContain('## How to read these values');
  });
});

describe('NASA request accounting', () => {
  afterAll(() => vi.unstubAllGlobals());

  it('counts fresh requests vs cache hits and shares identical in-flight queries', async () => {
    configureNasaTap({ tapUrl: SYNTHETIC_TAP_URL, cacheTtlSeconds: 600 });
    clearTapCache();
    const log: string[] = [];
    vi.stubGlobal('fetch', makeTapFetch(realFetch, syntheticDetailRow(), log));
    const before = getTapStats();
    const [a, b] = await Promise.all([getNasaExoplanetDetail('TEST-1 b'), getNasaExoplanetDetail('TEST-1 b')]);
    expect(a?.planetName).toBe('TEST-1 b');
    expect(b?.planetName).toBe('TEST-1 b');
    const mid = getTapStats();
    expect(log.length).toBe(1);
    expect(mid.upstreamRequests - before.upstreamRequests).toBe(1);
    expect(mid.sharedInFlight - before.sharedInFlight).toBe(1);
    await getNasaExoplanetDetail('TEST-1 b');
    const after = getTapStats();
    expect(after.upstreamRequests).toBe(mid.upstreamRequests);
    expect(after.cacheHits - mid.cacheHits).toBe(1);
  });
});

describe('archive-calculated values', () => {
  const calc = '<a refstr=CALCULATED_VALUE href=/docs/pscp_calc.html target=_blank>Calculated Value</a>';

  it('marks values whose reference is "Calculated Value" as derived, never measured', () => {
    expect(isArchiveCalculated('Calculated Value')).toBe(true);
    expect(isArchiveCalculated('Author et al. 2001')).toBe(false);
    const row = syntheticDetailRow({ pl_rade: 13.2, pl_rade_reflink: calc, pl_radelim: 0 });
    const m = buildMeasurement(row, 'pl_rade', 'R_earth', { limCol: 'pl_radelim', refCol: 'pl_rade_reflink' });
    expect(m.status).toBe('derived');
    expect(m.referenceLabel).toBe('Calculated Value');
  });

  it('keeps published values measured and limits unverified', () => {
    const row = syntheticDetailRow({ pl_rade: 13.2, pl_rade_reflink: calc, pl_radelim: 1 });
    expect(buildMeasurement(row, 'pl_rade', 'R_earth', { limCol: 'pl_radelim', refCol: 'pl_rade_reflink' }).status).toBe('limit_direction_unverified');
    const ok = buildMeasurement(syntheticDetailRow(), 'pl_orbper', 'd', { limCol: 'pl_orbperlim', refCol: 'pl_orbper_reflink' });
    expect(ok.status).toBe('measured');
  });
});
