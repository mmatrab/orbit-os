import { describe, expect, it } from 'vitest';
import { loadConfig, normalizeBasePath } from '../server/config.ts';
import { parseOrigin } from '../src/embed/bridge.ts';
import { escapeCsvCell } from '../src/utils/exportBundle.ts';
import { formatDecDms, formatRaHms } from '../src/utils/coordinates.ts';

describe('config', () => {
  it('normalizes base paths', () => {
    expect(normalizeBasePath(undefined)).toBe('/');
    expect(normalizeBasePath('space-explorer/')).toBe('/space-explorer');
    expect(() => normalizeBasePath('/bad path')).toThrow();
  });

  it('rejects wildcard or malformed CORS origins', () => {
    expect(() => loadConfig({ ORBIT_CORS_ORIGINS: '*' })).toThrow();
    expect(() => loadConfig({ ORBIT_CORS_ORIGINS: 'https://a.example/path' })).toThrow();
    expect(loadConfig({ ORBIT_CORS_ORIGINS: 'https://a.example, http://localhost:5173' }).corsOrigins).toEqual([
      'https://a.example',
      'http://localhost:5173',
    ]);
  });

  it('defaults to same-origin framing only', () => {
    expect(loadConfig({}).frameAncestors).toEqual(["'self'"]);
  });
});

describe('embedding bridge', () => {
  it('accepts only plain http(s) origins', () => {
    expect(parseOrigin('https://host.example')).toBe('https://host.example');
    expect(parseOrigin('https://host.example/path')).toBeNull();
    expect(parseOrigin('javascript:alert(1)')).toBeNull();
    expect(parseOrigin(null)).toBeNull();
  });
});

describe('exports and formatting', () => {
  it('neutralizes spreadsheet formulas but keeps negative numbers', () => {
    expect(escapeCsvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCsvCell('-0.13')).toBe('-0.13');
    expect(escapeCsvCell('@cmd')).toBe("'@cmd");
  });

  it('formats missing coordinates as not reported', () => {
    expect(formatRaHms(null)).toBe('RA not reported');
    expect(formatDecDms(null)).toBe('Dec not reported');
    expect(formatRaHms(0)).toBe('00h 00m 00.00s');
  });
});
