import fs from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSpaceExplorerApp } from '../server/app.ts';
import { loadConfig } from '../server/config.ts';
import { makeTapFetch, SYNTHETIC_TAP_URL } from './fixtures.ts';

const realFetch = globalThis.fetch;
let server: Server;
let base: string;
let tmp: string;

const json = { 'Content-Type': 'application/json' };
const validEntry = {
  targetId: 'TEST-1 b',
  targetName: 'TEST-1 b',
  category: 'Target Screening',
  title: 'Check provenance',
  body: 'Compare the mass reference with the radius reference.',
};

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'orbit-se-'));
  const staticDir = path.join(tmp, 'dist');
  await fs.mkdir(staticDir);
  await fs.writeFile(path.join(staticDir, 'index.html'), '<!doctype html><title>UI</title>');

  const config = loadConfig({
    NODE_ENV: 'production',
    ORBIT_BASE_PATH: '/space-explorer',
    ORBIT_DATA_DIR: path.join(tmp, 'data'),
    ORBIT_STATIC_DIR: staticDir,
    ORBIT_CORS_ORIGINS: 'https://host.example',
    ORBIT_FRAME_ANCESTORS: "'self' https://host.example",
    ORBIT_TAP_URL: SYNTHETIC_TAP_URL,
  });
  vi.stubGlobal('fetch', makeTapFetch(realFetch));
  const app = await createSpaceExplorerApp(config);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}/space-explorer`;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('isolation and embedding', () => {
  it('serves the UI under the base path with frame-ancestors', async () => {
    const res = await realFetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toBe("frame-ancestors 'self' https://host.example");
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('redirects the bare prefix to the trailing-slash URL, keeping the query', async () => {
    const res = await realFetch(`${base}?target=TEST-1%20b`, { redirect: 'manual' });
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/space-explorer/?target=TEST-1%20b');
  });

  it('falls back to the UI for deep links', async () => {
    expect((await realFetch(`${base}/any/deep/link`)).status).toBe(200);
  });

  it('allows CORS only for configured origins', async () => {
    const ok = await realFetch(`${base}/api/v1/health`, { headers: { Origin: 'https://host.example' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://host.example');
    const other = await realFetch(`${base}/api/v1/health`, { headers: { Origin: 'https://evil.example' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
    const preflight = await realFetch(`${base}/api/v1/notebook/entries`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    expect(preflight.status).toBe(403);
  });
});

describe('archive endpoints', () => {
  it('searches', async () => {
    const res = await realFetch(`${base}/api/v1/targets/search?q=test`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].planetName).toBe('TEST-1 b');
    expect(body.items[0]).not.toHaveProperty('isDefaultParameterSet');
  });

  it('returns a planet with mass provenance', async () => {
    const res = await realFetch(`${base}/api/v1/exoplanets/${encodeURIComponent('TEST-1 b')}`);
    const body = await res.json();
    expect(body.planetaryParameters.massIsMsini).toBe(true);
    expect(body.provenance.notes).toMatch(/different publications/);
  });

  it('reports limits over HTTP as direction-unverified with the raw NASA flag', async () => {
    const res = await realFetch(`${base}/api/v1/exoplanets/${encodeURIComponent('TEST-1 b')}`);
    const body = await res.json();
    expect(body.orbitalParameters.eccentricity.status).toBe('limit_direction_unverified');
    expect(body.orbitalParameters.eccentricity.rawLimitFlag).toBe(1);
    expect(JSON.stringify(body)).not.toMatch(/"(upper|lower)_limit"/);
  });

  it('answers 404 for unknown planets and unknown API routes', async () => {
    expect((await realFetch(`${base}/api/v1/exoplanets/NOPE`)).status).toBe(404);
    expect((await realFetch(`${base}/api/v9/nothing`)).status).toBe(404);
  });
});

describe('notebook', () => {
  it('rejects non-JSON writes, malformed JSON and invalid fields', async () => {
    const form = await realFetch(`${base}/api/v1/notebook/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'title=x',
    });
    expect(form.status).toBe(415);
    const malformed = await realFetch(`${base}/api/v1/notebook/entries`, { method: 'POST', headers: json, body: '{bad' });
    expect(malformed.status).toBe(400);
    const invalid = await realFetch(`${base}/api/v1/notebook/entries`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ ...validEntry, tags: 'not-a-list' }),
    });
    expect(invalid.status).toBe(400);
  });

  it('creates, updates, lists and deletes entries', async () => {
    const created = await realFetch(`${base}/api/v1/notebook/entries`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify(validEntry),
    });
    expect(created.status).toBe(201);
    const entry = await created.json();

    const patched = await realFetch(`${base}/api/v1/notebook/entries/${entry.id}`, {
      method: 'PATCH',
      headers: json,
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect((await patched.json()).title).toBe('Updated');

    const list = await (await realFetch(`${base}/api/v1/notebook/entries?targetId=TEST-1%20b`)).json();
    expect(list.some((e: { id: string }) => e.id === entry.id)).toBe(true);

    expect((await realFetch(`${base}/api/v1/notebook/entries/${entry.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await realFetch(`${base}/api/v1/notebook/entries/${entry.id}`, { method: 'DELETE' })).status).toBe(404);
  });

  it('does not lose entries under concurrent writes', async () => {
    const before = (await (await realFetch(`${base}/api/v1/notebook/entries`)).json()).length;
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        realFetch(`${base}/api/v1/notebook/entries`, {
          method: 'POST',
          headers: json,
          body: JSON.stringify({ ...validEntry, title: `Concurrent ${i}` }),
        })
      )
    );
    const after = (await (await realFetch(`${base}/api/v1/notebook/entries`)).json()).length;
    expect(after - before).toBe(20);
  });
});
