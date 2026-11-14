import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type {
  CreateNotebookEntryRequest,
  DiscoveryMethod,
  ExportSubmissionRequest,
  HealthResponse,
  NotebookCategory,
  SearchTargetsResponse,
  SourcesResponse,
  UpdateNotebookEntryRequest,
} from '../src/api/contracts.ts';
import type { SpaceExplorerConfig } from './config.ts';
import {
  configureNasaTap,
  getNasaExoplanetDetail,
  probeDataSources,
  searchNasaExoplanets,
  UpstreamTapError,
} from './nasaTap.ts';
import {
  configureNotebookStore,
  createNotebookEntry,
  deleteNotebookEntry,
  listNotebookEntries,
  recordExportAudit,
  updateNotebookEntry,
} from './notebookStore.ts';

export const MODULE_VERSION = '1.1.0';

const NOTEBOOK_CATEGORIES: ReadonlySet<NotebookCategory> = new Set([
  'Target Screening',
  'Sky Inspection',
  'Data Anomaly',
  'Follow-up Candidate',
  'Literature Cross-Check',
]);

// ---------------------------------------------------------------------------
// Request validation (plain functions: no framework, easy to test)
// ---------------------------------------------------------------------------

function isBoundedString(v: unknown, min: number, max: number): v is string {
  return typeof v === 'string' && v.trim().length >= min && v.length <= max;
}

function isTagList(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.length <= 20 &&
    v.every((t) => typeof t === 'string' && t.length <= 40)
  );
}

export function validateCreateEntry(body: unknown): string | null {
  const b = body as Partial<CreateNotebookEntryRequest> | null;
  if (!b || typeof b !== 'object') return 'Body must be a JSON object.';
  if (!isBoundedString(b.targetId, 1, 128)) return 'targetId is required (1-128 characters).';
  if (!isBoundedString(b.targetName, 1, 128)) return 'targetName is required (1-128 characters).';
  if (typeof b.category !== 'string' || !NOTEBOOK_CATEGORIES.has(b.category as NotebookCategory)) {
    return `category must be one of: ${[...NOTEBOOK_CATEGORIES].join(', ')}.`;
  }
  if (!isBoundedString(b.title, 1, 200)) return 'title is required (1-200 characters).';
  if (!isBoundedString(b.body, 1, 20000)) return 'body is required (1-20000 characters).';
  if (b.tags !== undefined && !isTagList(b.tags)) return 'tags must be an array of at most 20 strings (40 characters each).';
  if (b.parameterSnapshot !== undefined && (typeof b.parameterSnapshot !== 'object' || b.parameterSnapshot === null)) {
    return 'parameterSnapshot must be an object when provided.';
  }
  return null;
}

export function validateUpdateEntry(body: unknown): string | null {
  const b = body as Partial<UpdateNotebookEntryRequest> | null;
  if (!b || typeof b !== 'object') return 'Body must be a JSON object.';
  if (b.category !== undefined && !NOTEBOOK_CATEGORIES.has(b.category)) return 'Invalid category.';
  if (b.title !== undefined && !isBoundedString(b.title, 1, 200)) return 'title must be 1-200 characters.';
  if (b.body !== undefined && !isBoundedString(b.body, 1, 20000)) return 'body must be 1-20000 characters.';
  if (b.tags !== undefined && !isTagList(b.tags)) return 'tags must be an array of at most 20 strings.';
  return null;
}

function sendUpstreamError(res: Response, err: unknown, fallback: string): void {
  if (err instanceof UpstreamTapError) {
    res.status(err.status).json({ error: err.message, detail: err.detail || undefined });
    return;
  }
  res.status(502).json({ error: err instanceof Error ? err.message : fallback });
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

function securityHeaders(config: SpaceExplorerConfig) {
  const frameAncestors = config.frameAncestors.join(' ');
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  };
}

function apiCors(config: SpaceExplorerConfig) {
  const allowed = new Set(config.corsOrigins);
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.status(origin && allowed.has(origin) ? 204 : 403).end();
      return;
    }
    next();
  };
}

/** Writes must be JSON. This also blocks cross-site HTML form posts. */
function requireJsonBody(req: Request, res: Response, next: NextFunction) {
  if ((req.method === 'POST' || req.method === 'PATCH') && !req.is('application/json')) {
    res.status(415).json({ error: 'Content-Type must be application/json.' });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// API router (mountable on its own by Node/Express hosts)
// ---------------------------------------------------------------------------

export function createApiRouter(config: SpaceExplorerConfig): Router {
  configureNasaTap({
    cacheTtlSeconds: config.tapCacheTtlSeconds,
    contact: config.contact,
    tapUrl: config.tapUrl,
  });
  configureNotebookStore(config.dataDir);

  const api = express.Router();
  api.use(apiCors(config));
  api.use(requireJsonBody);
  api.use(express.json({ limit: '1mb' }));

  api.get('/v1/health', (_req, res) => {
    const payload: HealthResponse = {
      status: 'ok',
      service: 'orbit-space-explorer',
      version: MODULE_VERSION,
      timestampUtc: new Date().toISOString(),
    };
    res.json(payload);
  });

  api.get('/v1/targets/search', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const discoveryMethod =
        typeof req.query.discoveryMethod === 'string'
          ? (req.query.discoveryMethod as DiscoveryMethod | 'ALL')
          : 'ALL';
      const result = await searchNasaExoplanets({
        q,
        discoveryMethod,
        requireRadius: req.query.requireRadius === 'true',
        requireMass: req.query.requireMass === 'true',
        limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
        offset: typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined,
      });
      const payload: SearchTargetsResponse = {
        mode: 'live',
        totalCount: result.totalCount,
        returnedCount: result.items.length,
        queryTimestampUtc: result.queryTimestampUtc,
        items: result.items,
      };
      res.json(payload);
    } catch (err) {
      sendUpstreamError(res, err, 'Failed to query NASA Exoplanet Archive.');
    }
  });

  api.get('/v1/exoplanets/:id', async (req, res) => {
    try {
      const detail = await getNasaExoplanetDetail(req.params.id);
      if (!detail) {
        res.status(404).json({
          error: `Exoplanet "${req.params.id}" was not found in NASA Exoplanet Archive pscomppars.`,
        });
        return;
      }
      res.json(detail);
    } catch (err) {
      sendUpstreamError(res, err, 'Failed to retrieve exoplanet record.');
    }
  });

  api.get('/v1/sources', async (_req, res) => {
    try {
      const payload: SourcesResponse = { mode: 'live', sources: await probeDataSources() };
      res.json(payload);
    } catch (err) {
      sendUpstreamError(res, err, 'Failed to probe astronomical data sources.');
    }
  });

  api.get('/v1/notebook/entries', async (req, res, next) => {
    try {
      const targetId = typeof req.query.targetId === 'string' ? req.query.targetId : undefined;
      res.json(await listNotebookEntries(targetId));
    } catch (err) {
      next(err);
    }
  });

  api.post('/v1/notebook/entries', async (req, res, next) => {
    try {
      const problem = validateCreateEntry(req.body);
      if (problem) {
        res.status(400).json({ error: problem });
        return;
      }
      const body = req.body as CreateNotebookEntryRequest;
      res.status(201).json(await createNotebookEntry({ ...body, tags: body.tags ?? [] }));
    } catch (err) {
      next(err);
    }
  });

  api.patch('/v1/notebook/entries/:id', async (req, res, next) => {
    try {
      const problem = validateUpdateEntry(req.body);
      if (problem) {
        res.status(400).json({ error: problem });
        return;
      }
      const updated = await updateNotebookEntry(req.params.id, req.body as UpdateNotebookEntryRequest);
      if (!updated) {
        res.status(404).json({ error: `Notebook entry "${req.params.id}" not found.` });
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  api.delete('/v1/notebook/entries/:id', async (req, res, next) => {
    try {
      if (!(await deleteNotebookEntry(req.params.id))) {
        res.status(404).json({ error: `Notebook entry "${req.params.id}" not found.` });
        return;
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  api.post('/v1/exports', async (req, res, next) => {
    try {
      const body = req.body as Partial<ExportSubmissionRequest> | null;
      if (
        !body ||
        !isBoundedString(body.targetId, 1, 128) ||
        (body.format !== 'json' && body.format !== 'csv' && body.format !== 'markdown') ||
        (body.includedNotebookEntryIds !== undefined &&
          (!Array.isArray(body.includedNotebookEntryIds) ||
            !body.includedNotebookEntryIds.every((id) => typeof id === 'string')))
      ) {
        res.status(400).json({ error: 'Invalid export submission payload.' });
        return;
      }
      const receipt = await recordExportAudit({
        targetId: body.targetId,
        format: body.format,
        generatedAtUtc: typeof body.generatedAtUtc === 'string' ? body.generatedAtUtc : new Date().toISOString(),
        includedNotebookEntryIds: body.includedNotebookEntryIds ?? [],
      });
      res.status(201).json(receipt);
    } catch (err) {
      next(err);
    }
  });

  api.use((_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // JSON errors only (malformed JSON bodies arrive here as 400s from express.json).
  api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
        ? err.status
        : 500;
    const message =
      status === 500
        ? 'Internal error in Space Explorer.'
        : status === 413
        ? 'Request body too large (limit 1 MB).'
        : 'Malformed request body.';
    res.status(status).json({ error: message });
    if (status === 500) console.error('[space-explorer]', err);
  });

  return api;
}

// ---------------------------------------------------------------------------
// Full module (API + UI)
// ---------------------------------------------------------------------------

/**
 * Builds the complete Space Explorer app (API under `<basePath>/api`, UI under `<basePath>/`).
 * In production the built UI is served from `config.staticDir`; in development Vite serves it.
 */
export async function createSpaceExplorerApp(config: SpaceExplorerConfig): Promise<express.Express> {
  const app = express();
  app.disable('x-powered-by');

  const prefix = config.basePath === '/' ? '' : config.basePath;
  // Headers apply only to the module's own URLs, so mounting it inside a host app never alters host routes.
  app.use(prefix || '/', securityHeaders(config));

  if (prefix) {
    // "/space-explorer" -> "/space-explorer/" so relative asset and API URLs resolve correctly.
    app.use((req, res, next) => {
      const [pathname, query] = req.originalUrl.split('?');
      if (pathname === prefix) {
        res.redirect(301, `${prefix}/${query ? `?${query}` : ''}`);
        return;
      }
      next();
    });
  }

  app.use(`${prefix}/api`, createApiRouter(config));

  if (config.isProduction) {
    const indexFile = path.join(config.staticDir, 'index.html');
    if (!fs.existsSync(indexFile)) {
      throw new Error(`Built UI not found at ${indexFile}. Run "npm run build" first or set ORBIT_STATIC_DIR.`);
    }
    const ui = express.Router();
    ui.use(express.static(config.staticDir, { index: false }));
    ui.get('*', (_req, res) => {
      res.sendFile(indexFile);
    });
    app.use(prefix || '/', ui);
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      base: `${prefix}/`,
    });
    app.use(vite.middlewares);
  }

  return app;
}
