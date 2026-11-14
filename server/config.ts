import path from 'node:path';

/**
 * Runtime configuration for the Space Explorer module.
 * Every setting comes from an environment variable so the host platform never has to
 * touch the module's code. See INTEGRATION.md for the full list.
 */
export interface SpaceExplorerConfig {
  /** TCP port of the standalone server. */
  port: number;
  /** Interface to bind. */
  host: string;
  /** URL prefix the module is served under, e.g. "/" or "/space-explorer". Always starts with "/", never ends with "/" (except "/"). */
  basePath: string;
  /** Directory for the notebook and export-audit JSON files. */
  dataDir: string;
  /** Origins allowed to call the REST API cross-origin (exact match). Empty = same-origin only. */
  corsOrigins: string[];
  /** CSP frame-ancestors sources allowed to embed the UI in an iframe. */
  frameAncestors: string[];
  /** Seconds a NASA TAP response is reused before re-querying. 0 disables caching. */
  tapCacheTtlSeconds: number;
  /** Contact appended to the User-Agent sent to NASA and CDS (recommended by good API etiquette). */
  contact: string;
  /** NASA Exoplanet Archive TAP sync endpoint (override only for a mirror or for tests). */
  tapUrl: string;
  /**
   * Where research notes live. 'browser' (default): each visitor's notes stay in their own browser and
   * the server notebook/export-audit endpoints are disabled. 'server': one shared JSON notebook on the
   * server, for deployments behind the host platform's authentication only.
   */
  notebookMode: 'browser' | 'server';
  /** Directory of the built frontend (production only). */
  staticDir: string;
  isProduction: boolean;
}

function splitList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeBasePath(raw: string | undefined): string {
  const trimmed = (raw ?? '/').trim();
  if (!trimmed || trimmed === '/') return '/';
  if (!/^\/?[A-Za-z0-9._~\-/]+$/.test(trimmed)) {
    throw new Error(`ORBIT_BASE_PATH contains unsupported characters: "${trimmed}"`);
  }
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.replace(/\/+$/, '');
}

function toNonNegativeInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer, got "${raw}"`);
  }
  return n;
}

function parseNotebookMode(raw: string | undefined): 'browser' | 'server' {
  const value = (raw ?? 'browser').trim().toLowerCase() || 'browser';
  if (value !== 'browser' && value !== 'server') {
    throw new Error(`ORBIT_NOTEBOOK_MODE must be "browser" or "server", got "${raw}"`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SpaceExplorerConfig {
  const corsOrigins = splitList(env.ORBIT_CORS_ORIGINS);
  for (const origin of corsOrigins) {
    if (origin === '*' || !/^https?:\/\/[^/\s]+$/.test(origin)) {
      throw new Error(
        `ORBIT_CORS_ORIGINS must list exact origins such as https://app.example.org (no "*", no path); got "${origin}"`
      );
    }
  }
  const frameAncestors = splitList(env.ORBIT_FRAME_ANCESTORS);

  return {
    port: toNonNegativeInt(env.PORT, 3000, 'PORT'),
    host: env.HOST?.trim() || '0.0.0.0',
    basePath: normalizeBasePath(env.ORBIT_BASE_PATH),
    dataDir: path.resolve(env.ORBIT_DATA_DIR?.trim() || path.join(process.cwd(), 'data')),
    corsOrigins,
    frameAncestors: frameAncestors.length > 0 ? frameAncestors : ["'self'"],
    tapCacheTtlSeconds: toNonNegativeInt(env.ORBIT_TAP_CACHE_TTL_SECONDS, 600, 'ORBIT_TAP_CACHE_TTL_SECONDS'),
    contact: env.ORBIT_CONTACT?.trim() || '',
    tapUrl: env.ORBIT_TAP_URL?.trim() || 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync',
    notebookMode: parseNotebookMode(env.ORBIT_NOTEBOOK_MODE),
    staticDir: path.resolve(env.ORBIT_STATIC_DIR?.trim() || path.join(process.cwd(), 'dist')),
    isProduction: env.NODE_ENV === 'production',
  };
}
