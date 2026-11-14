# Integrating Space Explorer

Space Explorer is a self-contained module: one Node.js process serves both its UI and its REST API, keeps its own data directory, and calls only public astronomy services (NASA Exoplanet Archive, CDS). Your platform does not need React, Node.js or any shared database.

Choose one integration option:

| Option | You add to your app | Best when |
| --- | --- | --- |
| **A. iframe** | One `<iframe>` tag | Any stack; quickest |
| **B. Web component** | One `<script>` + one `<orbit-space-explorer>` tag | Any stack, and you want events or to open a planet from your own UI |
| **C. REST API** | HTTP calls from your backend or frontend | You build your own UI on our data |
| D. Node/Express mount (optional) | `app.use(...)` in your Express server | Your platform is itself Express and you want one process |

## 1. Run the module

**Docker:**

```bash
docker build -t orbit-space-explorer .
docker run -d -p 3000:3000 -v orbit-se-data:/data \
  -e ORBIT_FRAME_ANCESTORS="'self' https://platform.example.org" \
  orbit-space-explorer
```

**Node.js 22.18 or later:**

```bash
npm ci
npm run build
NODE_ENV=production npm start
```

The module then runs at `http://localhost:3000/`. Check it with `npm run smoke`, which exits with 0 when every check passes.

## 2. Configuration (environment variables)

All variables are optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `ORBIT_BASE_PATH` | `/` | Serve under a prefix, e.g. `/space-explorer`. The UI and API move together. |
| `ORBIT_DATA_DIR` | `./data` (`/data` in Docker) | Notebook and export-audit JSON files. Mount a volume here. |
| `ORBIT_FRAME_ANCESTORS` | `'self'` | Pages allowed to embed the UI (CSP `frame-ancestors`), space-separated. **Required for options A and B.** |
| `ORBIT_CORS_ORIGINS` | *(empty: same-origin only)* | Exact origins allowed to call the API from browser code, comma-separated. `*` is rejected. |
| `ORBIT_TAP_CACHE_TTL_SECONDS` | `600` | How long an archive answer is reused; `0` disables caching |
| `ORBIT_CONTACT` | *(empty)* | Contact added to the User-Agent sent to NASA and CDS |
| `ORBIT_TAP_URL` | NASA TAP sync URL | Override only for a mirror or for tests |
| `ORBIT_STATIC_DIR` | `./dist` | Location of the built UI |

Outbound network access required:
- From the server: `exoplanetarchive.ipac.caltech.edu`, plus `alasky.cds.unistra.fr` and `cdsweb.u-strasbg.fr` for the status checks in `/api/v1/sources`.
- From users' browsers: `alasky.cds.unistra.fr` and `alaskybis.cds.unistra.fr`, for sky images.

## Option A: iframe

```html
<iframe
  src="https://explorer.example.org/?target=TRAPPIST-1%20e"
  title="Space Explorer"
  style="width:100%;height:900px;border:0"
  allow="fullscreen"></iframe>
```

- `target` (optional) is an exact NASA Exoplanet Archive planet name, e.g. `51 Peg b`.
- Add your platform's origin to `ORBIT_FRAME_ANCESTORS`, otherwise the browser refuses to display the frame.
- With a prefix (`ORBIT_BASE_PATH=/space-explorer`), use `https://your-domain/space-explorer/`.

## Option B: web component

```html
<script src="https://explorer.example.org/orbit-space-explorer.js" defer></script>

<orbit-space-explorer id="explorer" target="TRAPPIST-1 e" height="900px"></orbit-space-explorer>

<script>
  const explorer = document.getElementById('explorer');
  explorer.addEventListener('orbit-ready', () => console.log('Space Explorer ready'));
  explorer.addEventListener('orbit-target-selected', (e) => console.log('Now viewing', e.detail.planetName));
  // Open a planet from your own UI:
  // explorer.selectTarget('51 Peg b');   or   explorer.setAttribute('target', '51 Peg b');
</script>
```

- The script has no dependencies and works in plain HTML, React, Vue, Angular or Svelte (it is a standard custom element).
- It loads the module from the URL the script came from; set the `src` attribute to point elsewhere.
- Messages travel through `postMessage`, and each side accepts messages only from the other side's origin. `ORBIT_FRAME_ANCESTORS` must include your origin.
- In React 18 and earlier, `onOrbitTargetSelected`-style props do not reach custom events. Attach listeners with a ref and `addEventListener`. Attributes such as `target` work as usual.

A working example is in [`examples/host.html`](examples/host.html).

## Option C: REST API

Base URL: `https://explorer.example.org` + `ORBIT_BASE_PATH` + `/api/v1`. Responses are JSON. Errors look like `{"error": "...", "detail": "..."}`. TypeScript types for every payload are in [`src/api/contracts.ts`](src/api/contracts.ts); copy that file if your client is TypeScript.

| Method and path | Purpose |
| --- | --- |
| `GET /api/v1/health` | Liveness: `{status, service, version, timestampUtc}` |
| `GET /api/v1/targets/search` | Search confirmed planets |
| `GET /api/v1/exoplanets/{planetName}` | One planet with measurements, uncertainties and references |
| `GET /api/v1/sources` | Live status and citation text of NASA and CDS services |
| `GET /api/v1/notebook/entries?targetId=` | List notes (optionally for one planet) |
| `POST /api/v1/notebook/entries` | Create a note |
| `PATCH /api/v1/notebook/entries/{id}` | Update a note |
| `DELETE /api/v1/notebook/entries/{id}` | Delete a note |
| `POST /api/v1/exports` | Record that an evidence export was produced (audit log) |

**Search parameters:**
- `q`: substring of the planet or host name.
- `discoveryMethod`: one of `Transit`, `Radial Velocity`, `Imaging`, `Microlensing`, `Transit Timing Variations`, `Astrometry`.
- `requireRadius` and `requireMass`: `true` to keep only planets with a value.
- `limit`: 1 to 100, default 50.
- `offset`: 0 to 400.

Results are sorted by distance.

```bash
curl "http://localhost:3000/api/v1/targets/search?q=trappist&limit=5"
curl "http://localhost:3000/api/v1/exoplanets/TRAPPIST-1%20e"
curl -X POST http://localhost:3000/api/v1/notebook/entries \
  -H "Content-Type: application/json" \
  -d '{"targetId":"TRAPPIST-1 e","targetName":"TRAPPIST-1 e","category":"Target Screening","title":"Check radius source","body":"Compare with the transit paper.","tags":["radius"]}'
```

**Notebook rules:**
- `category` is one of `Target Screening`, `Sky Inspection`, `Data Anomaly`, `Follow-up Candidate`, `Literature Cross-Check`.
- `title` is 1 to 200 characters and `body` 1 to 20,000.
- `tags` is an array of up to 20 strings.
- Writes must use `Content-Type: application/json`; anything else gets a 415.

**Status codes:**
- 400: invalid input.
- 404: unknown planet or route.
- 415: the body is not JSON.
- 502 or 504: the NASA archive is unreachable or too slow. The module never substitutes placeholder data.

**Reading a measurement:**
- Every value is `{value, unit, errPlus, errMinus, status, referenceLabel, referenceBibcode}`.
- `status` is `measured`, `upper_limit`, `lower_limit`, `derived` or `not_measured`.
- Show limits as `<` or `>` and never as plain values.
- When `planetaryParameters.massIsMsini` is true, the mass is a minimum mass (M sin i).

## Option D: mount inside an Express server (Node hosts only)

```ts
import express from 'express';
import { loadConfig } from './space-explorer/server/config.ts';
import { createApiRouter, createSpaceExplorerApp } from './space-explorer/server/app.ts';

const host = express();
const config = loadConfig({
  ...process.env,
  NODE_ENV: 'production',
  ORBIT_BASE_PATH: '/space-explorer',
  ORBIT_STATIC_DIR: './space-explorer/dist',      // built UI (npm run build inside the module)
  ORBIT_DATA_DIR: './space-explorer-data',
});
host.use(await createSpaceExplorerApp(config));          // UI + API under /space-explorer
// or only the API:  host.use('/space-explorer/api', createApiRouter(config));
```

Your server must run TypeScript the same way the module does (Node.js 22.18 or later). Running the module as its own process (options A to C) remains the recommended setup.

## Security and isolation notes

- **No accounts.** The notebook is shared by everyone who can reach the module. Put it behind your platform's authentication (reverse proxy or gateway) if notes must be private.
- **Isolation.** Styles, scripts and routing stay inside the iframe. The module sets no cookies, reads no host storage, and keeps its notebook fallback in its own origin's `localStorage`.
- **Response headers:** `Content-Security-Policy: frame-ancestors …`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
- **Data storage.** Data lives only in `ORBIT_DATA_DIR`. Run one instance per data directory, because the JSON store is not shared across processes.

## Data and scientific notes for integrators

- **Source.** Values come live from the NASA Exoplanet Archive *Planetary Systems Composite Parameters* table (`pscomppars`). Composite values can come from different publications, so each value carries its own reference. Do not combine them as one self-consistent solution.
- **Mass.** `pl_bmasse` is a "best mass" estimate and can be a minimum mass; the API exposes `massIsMsini` and `massProvenance`.
- **Sky view.** The marker shows the host star's catalogue position. The planet is not visible in survey images.
- **Limit flags (open item).** Values flagged `1` are shown as upper limits and `-1` as lower limits. The archive's documentation of this sign is inconsistent across pages, so it should be verified before scientific use.
- **Required acknowledgments.** For the NASA Exoplanet Archive: "This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program." The sky viewer uses CDS Aladin Lite (LGPL-3.0); keep its logo visible.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Blank iframe, console says "refused to frame" | Add your page's origin to `ORBIT_FRAME_ANCESTORS` |
| Browser CORS error when calling the API | Add your origin to `ORBIT_CORS_ORIGINS` (exact origin, no path) |
| 502 "Could not reach the NASA Exoplanet Archive" | The server has no outbound access to `exoplanetarchive.ipac.caltech.edu` |
| Sky viewer grey with "loading" | The browser cannot reach `alasky.cds.unistra.fr`, or WebGL2 is disabled |
| Assets 404 under a prefix | Set `ORBIT_BASE_PATH` to the same prefix your proxy uses, and do not strip it in the proxy |
