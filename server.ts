import express from 'express';
import path from 'node:path';
import type {
  CreateNotebookEntryRequest,
  DiscoveryMethod,
  ExportSubmissionRequest,
  HealthResponse,
  SearchTargetsResponse,
  SourcesResponse,
  UpdateNotebookEntryRequest,
} from './src/api/contracts.ts';
import {
  getNasaExoplanetDetail,
  probeDataSources,
  searchNasaExoplanets,
  UpstreamTapError,
} from './server/nasaTap.ts';
import {
  createNotebookEntry,
  deleteNotebookEntry,
  listNotebookEntries,
  recordExportAudit,
  updateNotebookEntry,
} from './server/notebookStore.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // 1. Health endpoint
  app.get('/api/v1/health', (_req, res) => {
    const payload: HealthResponse = {
      status: 'ok',
      service: 'orbit-os-node-backend',
      version: '1.0.0',
      timestampUtc: new Date().toISOString(),
    };
    res.json(payload);
  });

  // 2. Exoplanet & host star search via NASA Exoplanet Archive TAP (pscomppars)
  app.get('/api/v1/targets/search', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const discoveryMethod =
        typeof req.query.discoveryMethod === 'string'
          ? (req.query.discoveryMethod as DiscoveryMethod | 'ALL')
          : 'ALL';
      const requireRadius = req.query.requireRadius === 'true';
      const requireMass = req.query.requireMass === 'true';
      const limit =
        typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
      const offset =
        typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined;

      const result = await searchNasaExoplanets({
        q,
        discoveryMethod,
        requireRadius,
        requireMass,
        limit,
        offset,
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
      if (err instanceof UpstreamTapError) {
        res.status(err.status).json({
          error: err.message,
          detail: err.detail || undefined,
        });
        return;
      }
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to query NASA Exoplanet Archive.',
      });
    }
  });

  // 3. Exoplanet detail record via NASA Exoplanet Archive TAP (pscomppars)
  app.get('/api/v1/exoplanets/:id', async (req, res) => {
    try {
      const rawId = req.params.id;
      const detail = await getNasaExoplanetDetail(rawId);
      if (!detail) {
        res.status(404).json({
          error: `Exoplanet "${rawId}" was not found in NASA Exoplanet Archive pscomppars.`,
        });
        return;
      }
      res.json(detail);
    } catch (err) {
      if (err instanceof UpstreamTapError) {
        res.status(err.status).json({
          error: err.message,
          detail: err.detail || undefined,
        });
        return;
      }
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to retrieve exoplanet record.',
      });
    }
  });

  // 4. Live upstream source health & provenance
  app.get('/api/v1/sources', async (_req, res) => {
    try {
      const sources = await probeDataSources();
      const payload: SourcesResponse = {
        mode: 'live',
        sources,
      };
      res.json(payload);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to probe astronomical data sources.',
      });
    }
  });

  // 5. Persistent Research Notebook CRUD
  app.get('/api/v1/notebook/entries', async (req, res) => {
    try {
      const targetId = typeof req.query.targetId === 'string' ? req.query.targetId : undefined;
      const entries = await listNotebookEntries(targetId);
      res.json(entries);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to read notebook entries.',
      });
    }
  });

  app.post('/api/v1/notebook/entries', async (req, res) => {
    try {
      const body = req.body as Partial<CreateNotebookEntryRequest>;
      if (
        !body ||
        typeof body.title !== 'string' ||
        !body.title.trim() ||
        typeof body.body !== 'string' ||
        !body.body.trim() ||
        typeof body.targetId !== 'string' ||
        typeof body.targetName !== 'string' ||
        typeof body.category !== 'string'
      ) {
        res.status(400).json({
          error: 'Missing required notebook entry fields (targetId, targetName, category, title, body).',
        });
        return;
      }

      const created = await createNotebookEntry(body as CreateNotebookEntryRequest);
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to save notebook entry.',
      });
    }
  });

  app.patch('/api/v1/notebook/entries/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const body = req.body as UpdateNotebookEntryRequest;
      const updated = await updateNotebookEntry(id, body ?? {});
      if (!updated) {
        res.status(404).json({ error: `Notebook entry "${id}" not found.` });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to update notebook entry.',
      });
    }
  });

  app.delete('/api/v1/notebook/entries/:id', async (req, res) => {
    try {
      const deleted = await deleteNotebookEntry(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: `Notebook entry "${req.params.id}" not found.` });
        return;
      }
      res.status(204).end();
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to delete notebook entry.',
      });
    }
  });

  // 6. Export audit trail
  app.post('/api/v1/exports', async (req, res) => {
    try {
      const body = req.body as Partial<ExportSubmissionRequest>;
      if (
        !body ||
        typeof body.targetId !== 'string' ||
        !body.targetId.trim() ||
        (body.format !== 'json' && body.format !== 'csv' && body.format !== 'markdown')
      ) {
        res.status(400).json({ error: 'Invalid export submission payload.' });
        return;
      }
      const receipt = await recordExportAudit({
        targetId: body.targetId,
        format: body.format,
        generatedAtUtc: body.generatedAtUtc || new Date().toISOString(),
        includedNotebookEntryIds: Array.isArray(body.includedNotebookEntryIds)
          ? body.includedNotebookEntryIds
          : [],
      });
      res.status(201).json(receipt);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to record export audit.',
      });
    }
  });

  // Explicit 404 for unknown /api routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Frontend Vite middleware (dev) or static bundle serving (production)
  if (IS_PROD) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `ORBIT OS full-stack server listening on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`
    );
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
