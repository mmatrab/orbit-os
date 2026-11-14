#!/usr/bin/env node
/**
 * Smoke test against a RUNNING Space Explorer instance.
 *
 *   npm run smoke                                   # http://localhost:3000/
 *   SMOKE_BASE_URL=https://host/space-explorer/ npm run smoke
 *   npm run smoke -- --offline                      # skip the live NASA checks
 *
 * Exit code 0 = all checks passed. Leaves no data behind (the test note is deleted).
 */
const base = new URL(process.env.SMOKE_BASE_URL || 'http://localhost:3000/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const offline = process.argv.includes('--offline');
const results = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name} (${Date.now() - started} ms)${detail ? ` - ${detail}` : ''}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name} - ${err instanceof Error ? err.message : err}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(path, init) {
  const res = await fetch(new URL(path, base), { ...init, signal: AbortSignal.timeout(30000) });
  return res;
}

await check('health endpoint', async () => {
  const res = await get('api/v1/health');
  assert(res.ok, `HTTP ${res.status}`);
  const body = await res.json();
  assert(body.status === 'ok', `status=${body.status}`);
  return `version ${body.version}`;
});

await check('UI is served with a frame-ancestors policy', async () => {
  const res = await get('');
  assert(res.ok, `HTTP ${res.status}`);
  assert((res.headers.get('content-type') || '').includes('text/html'), 'not HTML');
  const csp = res.headers.get('content-security-policy') || '';
  assert(csp.includes('frame-ancestors'), 'missing frame-ancestors');
  return csp;
});

await check('embed script is served', async () => {
  const res = await get('orbit-space-explorer.js');
  assert(res.ok, `HTTP ${res.status}`);
  assert((await res.text()).includes("customElements.define('orbit-space-explorer'"), 'unexpected content');
});

await check('notebook create / list / delete', async () => {
  const headers = { 'Content-Type': 'application/json' };
  const created = await get('api/v1/notebook/entries', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      targetId: 'SMOKE-TEST',
      targetName: 'SMOKE-TEST',
      category: 'Target Screening',
      title: 'smoke test',
      body: 'Created and deleted by scripts/smoke.mjs',
    }),
  });
  assert(created.status === 201, `create HTTP ${created.status}`);
  const entry = await created.json();
  const list = await (await get('api/v1/notebook/entries?targetId=SMOKE-TEST')).json();
  assert(list.some((e) => e.id === entry.id), 'created entry not listed');
  const deleted = await get(`api/v1/notebook/entries/${entry.id}`, { method: 'DELETE' });
  assert(deleted.status === 204, `delete HTTP ${deleted.status}`);
});

if (offline) {
  console.log('SKIP  live NASA Exoplanet Archive checks (--offline)');
} else {
  await check('live archive search (TRAPPIST-1)', async () => {
    const res = await get('api/v1/targets/search?q=TRAPPIST-1&limit=10');
    assert(res.ok, `HTTP ${res.status}: ${await res.text()}`);
    const body = await res.json();
    assert(body.items.length > 0, 'no results');
    return `${body.totalCount} matches`;
  });

  await check('live archive planet record (TRAPPIST-1 e)', async () => {
    const res = await get(`api/v1/exoplanets/${encodeURIComponent('TRAPPIST-1 e')}`);
    assert(res.ok, `HTTP ${res.status}: ${await res.text()}`);
    const body = await res.json();
    assert(typeof body.hostStar.raDeg === 'number', 'no host coordinates');
    assert(body.orbitalParameters.periodDays.value !== null, 'no orbital period');
    return `period ${body.orbitalParameters.periodDays.value} ${body.orbitalParameters.periodDays.unit}`;
  });
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
