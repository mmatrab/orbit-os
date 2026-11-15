# ORBIT OS — Space Explorer

An independent exoplanet exploration module: **Discover → Explore → Understand → Research → Export.**

- Search confirmed planets in the NASA Exoplanet Archive (live, nothing simulated).
- See three key facts in plain language, then every published parameter with its uncertainties, limits and references.
- View the host star's surroundings in real sky-survey images (Aladin Lite + CDS/ESA HiPS), and export that view as a PNG.
- Keep research notes (private to your browser by default) and export the evidence as JSON, CSV or Markdown.

A two-minute walkthrough is in [DEMO.md](DEMO.md). This is an exoplanet exploration tool; it does not analyse SPHEREx or other image data.

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
| `npm test` | Unit, API and regression tests (synthetic data, no network needed) |
| `npm run typecheck` | TypeScript check |
| `npm run smoke` | Smoke test against a running instance (`SMOKE_BASE_URL`, default `http://localhost:3000/`). Reports whether NASA answers came from a fresh request or the cache. |

## Layout

```
server.ts                 standalone entry point
server/config.ts          environment configuration
server/app.ts             API router + UI serving (createSpaceExplorerApp, createApiRouter)
server/nasaTap.ts         NASA Exoplanet Archive TAP adapter (caching, parsing, references)
server/notebookStore.ts   optional shared notebook (ORBIT_NOTEBOOK_MODE=server only)
src/                      React UI (runs inside the module's own page)
src/sky/                  HiPS survey mirrors, tile watchdog helpers, sky-view export metadata
src/api/contracts.ts      TypeScript types of every API payload
src/embed/bridge.ts       iframe <-> host messaging
public/orbit-space-explorer.js   framework-agnostic embed (<orbit-space-explorer>)
tests/                    vitest suites (synthetic archive rows, no network)
scripts/smoke.mjs         smoke test
```

## Data sources and credits

- NASA Exoplanet Archive (TAP, `pscomppars`): "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program."
- CDS Aladin Lite 3.8.2 (LGPL-3.0), loaded as a separate unmodified chunk.
- Sky images: HiPS surveys (DSS2, 2MASS, AllWISE, Pan-STARRS) served by CDS Strasbourg, with the ESA ESASky mirror as fallback. The credit of the survey actually displayed is shown under the viewer and printed on exported PNGs.

No values are simulated or estimated by this module. When an upstream service is unreachable, the UI shows an error instead of substitute data. Synthetic rows exist only in `tests/` and are labelled as such.

## Notes and privacy

By default notes are saved only in the visitor's browser (`localStorage`); nothing is stored on the server and nobody else can read them. Clearing site data deletes them, so the UI reminds users to export. A shared server notebook exists for deployments behind the host platform's authentication: set `ORBIT_NOTEBOOK_MODE=server` (see [INTEGRATION.md](INTEGRATION.md#notes-and-authentication)). The module has no login system of its own and never holds credentials in the frontend.
