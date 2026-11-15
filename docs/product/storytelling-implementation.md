# Storytelling views: what changed and what is open

Date: 15 November 2026. Brief: [storytelling-enthusiast-path.md](storytelling-enthusiast-path.md).

Built in parallel by two contributors (a first version of all three parts, then a review and rework
by Claude), merged on `main`. This note describes the state after the merge.

## Delivered

| Part | Where | Status |
| --- | --- | --- |
| Snapshot | `scripts/build-planet-snapshot.ts`, `data/snapshots/planets-2026-11-15.json`, `src/stories/` | Done |
| 1. Find a world | `src/components/FindAWorld.tsx` (under the search box) | Done |
| 2. Discovery timeline | `src/components/DiscoveryTimeline.tsx` | Done |
| 3. Radius and orbital period | `src/components/RadiusPeriodChart.tsx` | Done |

All three are reachable from the first screen (Explore tab): the guided path under the search
box, the charts below the explorer.

### Snapshot

- One TAP query on `pscomppars`: 6,470 planets, 625 KB, retrieved 2026-11-15T11:50:09Z.
- Per value: `m` measured, `d` derived (reference "Calculated Value"), `l` limit (direction not
  verified), the same rules as the detail panel (`server/nasaTap.ts` `buildMeasurement`).
- Each planet keeps the ADS bibcode of its discovery paper.
- Changed after review: the first version stored the same 1.25 MB file three times and had no
  derived marking, although about 1,500 radii in `pscomppars` are calculated by the archive.

### Part 1: Find a world

- Size to scale, distance on a ruler where each mark is 10× farther, year as two bars on one scale.
- Derived values are called estimates in the sentence; limits and missing values are never drawn.
- End screen: Share this world (existing captioned sky PNG export), Copy link (`?target=`),
  Explore its sky.
- Changed after review: the first size picture used fixed circles (TRAPPIST-1 e was drawn larger
  than Earth), and sharing only copied a link instead of using the PNG export the brief asks for.

### Part 2: Discovery timeline

- Bars per year 1992–2026 (empty years kept), stacked in the brief's method order; hover tooltip;
  legend toggles with totals; table view; totals line equal to the snapshot count.
- Milestones, each checked against the archive's discovery reference (`disc_refname`,
  `disc_year`, `disc_facility`, `st_spectype`) on 15 November 2026 and re-checked against the
  snapshot at display time:
  - 1992: 2 planets around PSR B1257+12, the earliest discovery year in the archive.
    Wolszczan et al. 1992, Nature 355, 145 (1992Natur.355..145W).
  - 1995: 51 Peg b, radial velocity, Sun-type host (G5V), period 4.23 days.
    Mayor & Queloz 1995, Nature 378, 355 (1995Natur.378..355M).
  - 2016: 1,269 Kepler planets from one paper, the tallest bar.
    Morton et al. 2016, ApJ 822, 86 (2016ApJ...822...86M).
- Changed after review: the first milestones linked to NASA web pages that could not be checked
  from the build environment, and one (Kepler launch, 2009) is not a discovery in the data.

### Part 3: Radius and orbital period

- Log–log scatter, Earth reference, 1.5–2 Earth-radii band ("researchers are still studying
  why"), counts plotted and left out per reason, nearest-point hover, alphabetical table.
- Measured radii only by default (4,843 planets); derived radii on request as hollow marks (6,060).
- Changed after review: the first version plotted 1,217 derived radii as if measured.

## Verification

- `npm run typecheck`, `npm test` (96 tests), `npm run build`: passing on 15 November 2026.
- Unit tests: unit conversion, binning, axis rounding, logarithmic filter (missing, zero,
  negative, limit, derived), and the committed snapshot (source, size, totals, milestones).
- Real browser (Chromium via Playwright, ad hoc scripts, not committed): guided path completed in
  about 4 s; timeline hover, legend and table; scatter hover and derived toggle; no horizontal
  scroll at 390 px.
- Live archive queries ran from the build environment on 15 November 2026.

## Open

1. **Sky images were not checked here.** CDS and ESA image servers were blocked by the build
   environment's network, so "Share this world" was only tested in its "not loaded yet" state.
2. **No committed Playwright test for the guided path.** The project has no `@playwright/test`
   dependency yet. Adding one is a team decision (dev dependency and CI browser install).
3. **Milestone sources checked only through the archive's own records.** The ADS pages and
   publisher sites were not reachable from the build environment.
4. **The 1.5–2 Earth-radii gap has no citation on the chart.** The brief does not ask for one;
   add one once a reference is checked.
5. **Snapshot refresh is manual.** Run `npm run snapshot` or the GitHub Action, then review.
6. **No measured test for the 90-second acceptance criterion** with first-time users.
