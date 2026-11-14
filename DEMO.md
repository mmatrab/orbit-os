# Space Explorer — 2-minute demo

A walkthrough with three real planets from the NASA Exoplanet Archive. All values on screen are fetched live; the numbers you see depend on the archive at the time of the demo, so this script describes what to point at rather than quoting figures.

> **Scope.** Space Explorer is an exoplanet exploration tool: it finds confirmed planets, explains their published parameters with references, and shows real sky-survey images around their host stars. It is **not** a SPHEREx (or any other mission) image-analysis solution and does not process telescope data.

Before you start: run the module (`npm run build && npm start`, or Docker — see [README.md](README.md)) and open http://localhost:3000. You need internet access from the server (NASA) and from the browser (CDS/ESA sky images).

## 0:00 — Discover

- The page opens with **"Explore worlds beyond our Solar System"** and a one-line explanation that every planet comes live from the NASA Exoplanet Archive.
- Point at the three steps under the title: search, see facts and sky, save and export.
- Click the example **TRAPPIST-1 e**. The search box and the results list update together.

## 0:20 — Explore and understand (TRAPPIST-1 e)

- The overview card shows three facts: **Radius** (Earth radii), **Mass** (Earth masses), **Orbital period** (days), each with a one-line explanation, its ± uncertainty and the paper it comes from.
- TRAPPIST-1 e was found by transits, so it has both a measured radius and a mass.

## 0:40 — The sky around the star

- The large sky viewer shows real DSS2 survey images centred on TRAPPIST-1, with a circle on the star.
- Say it out loud: this is the star's position, **not a photo of the planet**, which is far too faint to see.
- Click **Zoom: Wide**, then **Recenter**. Switch **Image survey** to *2MASS colour (near-infrared)*: TRAPPIST-1 is a cool red dwarf, so it stands out more in the infrared.
- Click **Export sky image (PNG)**. The file has the planet, host star, coordinates, survey, image credit and capture time printed under the image.
  If image servers are blocked on the demo network, the viewer says so (no fake image); use **Open in Aladin Lite** or **View details (JSON)** instead.

## 1:10 — A minimum mass (51 Peg b)

- Click the example **51 Peg b**, the first planet found around a Sun-like star (1995, radial velocity).
- The mass card is labelled **Minimum mass (M sin i)** and explains why: the radial-velocity method cannot see the orbit's tilt, so the true mass is this value or larger.
- Look at the radius card. 51 Peg b does not transit, so no paper measured its radius. If the archive filled the gap with its own estimate, the card is marked **(derived)** and says it was estimated by the archive, not measured; if not, it reads **Not measured**. The module itself never estimates a value.

## 1:30 — Advanced data and references (Proxima Cen b)

- Click **Proxima Cen b**, the planet around the nearest star to the Sun.
- Open **All scientific data**: every parameter with a plain-language hint, uncertainties, and an **ADS** link to its paper. Point out the note that this is a composite record: values can come from different papers.
- If a value is flagged by the archive as a limit, it reads **"Limit — direction unverified"** rather than a guessed < or >.

## 1:45 — Research and export

- Click **Save to notes**, type a short note and save. The notebook says notes are **saved privately in this browser only**.
- Click **Export data** and download the **Markdown** report (human-readable) or **CSV** (one row per value with status, raw limit flag and references). **JSON** contains the full record.

## 2:00 — Done

Every number came from the NASA Exoplanet Archive with its reference; every sky image came from a public survey with its credit. Nothing was simulated.
