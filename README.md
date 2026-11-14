# ORBIT OS — Space Explorer

An independent exoplanet research module. It lets you:
- search confirmed planets in the NASA Exoplanet Archive
- inspect published parameters with their uncertainties, limits and references
- view the host star in an Aladin Lite sky map
- keep research notes and export evidence as JSON, CSV or Markdown

It is one Node.js process that serves its own UI and REST API. **To add it to another application, read [INTEGRATION.md](INTEGRATION.md).**

## Quick start

Requires Node.js 22.18 or later. The server runs TypeScript directly.

```bash
npm ci
npm run dev                         # development, http://localhost:3000
# or
npm run build && npm start          # production
npm run smoke                       # checks a running instance (add -- --offline to skip NASA calls)
```

With Docker:

```bash
docker build -t orbit-space-explorer .
docker run -p 3000:3000 -v orbit-se-data:/data orbit-space-explorer
```

Configuration is through environment variables only; see [.env.example](.env.example) and [INTEGRATION.md](INTEGRATION.md#2-configuration-environment-variables).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Server with Vite hot reload |
| `npm run build` | Builds the UI into `dist/` |
| `npm start` | Production server (needs `dist/`) |
| `npm test` | Unit and API tests (no network needed) |
| `npm run typecheck` | TypeScript check |
| `npm run smoke` | Smoke test against a running instance (`SMOKE_BASE_URL`, default `http://localhost:3000/`) |

## Layout

```
server.ts                 standalone entry point
server/config.ts          environment configuration
server/app.ts             API router + UI serving (createSpaceExplorerApp, createApiRouter)
server/nasaTap.ts         NASA Exoplanet Archive TAP adapter (caching, parsing, references)
server/notebookStore.ts   JSON-file notebook and export audit log
src/                      React UI (runs inside the module's own page)
src/api/contracts.ts      TypeScript types of every API payload
src/embed/bridge.ts       iframe <-> host messaging
public/orbit-space-explorer.js   framework-agnostic embed (<orbit-space-explorer>)
tests/                    vitest suites (synthetic archive rows, no network)
scripts/smoke.mjs         smoke test
```

## Data sources and credits

- NASA Exoplanet Archive (TAP, `pscomppars`): "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program."
- CDS Aladin Lite (LGPL-3.0), loaded as a separate unmodified chunk, with HiPS surveys from CDS.

No values are simulated or estimated by this module. When an upstream service is unreachable, the UI shows an error instead of substitute data.
