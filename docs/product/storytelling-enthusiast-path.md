# Storytelling views and the enthusiast path

Status: ready to build.
Product owner: Mohamed. Build: ChatGPT (copy, layout, charts). Engineering review: Claude.

## Goal

A first-time visitor who is not a specialist should understand what a planet is like, and how astronomers found the planets we know, in about two minutes, without reading a glossary. Researchers get the same charts with their source and counts visible.

## Principles (non-negotiable)

- Only archive values, or figures we label as derived. No invented data, no placeholder numbers in published views.
- No habitability score, no ranking of planets for life, no claim of discovery by AI.
- Every chart shows its source (NASA Exoplanet Archive, table `pscomppars`), the snapshot date, and how many planets it uses.
- Plain language first. Put the technical term in brackets or in a tooltip.
- Keep the measured / derived marking that the detail panel already uses.

## Audience

Astronomy enthusiasts and non-specialists first. Independent researchers should find the same views useful, with the counts and sources visible.

## Part 1: Guided path, "Find a world"

Three questions appear under the search box. Each answer shows one picture and one sentence, then a "Next" button.

1. **How big is it?** Show the planet's radius next to Earth. Use the existing size comparison.
2. **How far is it?** Show the distance in light-years. Convert from parsecs with 1 pc = 3.26156 light-years.
3. **How long is its year?** Show the orbital period in Earth days, with one comparison to Earth's year.

End screen: a "Share this world" button (uses the existing PNG export) and a link to "Explore its sky".

Acceptance: a first-time user reaches the end in under 90 seconds. No step needs a physics term to be understood.

## Part 2: Discovery timeline

Question shown to the visitor: **How did we find the planets we know?**

- Chart: stacked bars or area, one bar per discovery year, stacked by discovery method.
- Methods, in this order: Transit, Radial Velocity, Imaging, Microlensing, Transit Timing Variations, Astrometry, Other.
- Hover shows the year, the method, and the count for that year.
- Clicking a method in the legend hides or shows it.
- Annotate 3 milestones. The implementer must check each milestone against a published source before adding it, and show the source in the annotation.

Data: a generated snapshot file, not a live loop over the API. The live search endpoint returns at most 100 rows per page, so a full timeline needs a snapshot.

Acceptance: the totals match the snapshot count, and the snapshot date is visible on the chart.

## Part 3: Radius and orbital period

Question shown to the visitor: **Where are the Earth-sized planets, and how close are they to their stars?**

- Scatter plot. X axis: orbital period in Earth days, logarithmic. Y axis: radius in Earth radii, logarithmic.
- Points coloured by discovery method. Use a colour-blind safe palette.
- Mark Earth (1 Earth radius, 365.25 days) with a reference point.
- Shade or mark the region around 1.5 to 2 Earth radii, described as a gap that many planets seem to avoid. Say that researchers are still studying why. Do not state a cause.
- Only planets with both radius and period can be plotted. Show how many were left out.
- Hover shows the planet name, host star, method, radius and period.

Acceptance: both axes are logarithmic, the plotted and excluded counts are visible, and no planet is ranked.

## Accessibility

- Every chart has a table alternative, switched on with a button.
- Keyboard users can reach every legend item and every planet in the table.
- The colour palette must stay readable in greyscale and for colour-blind users.

## Data

Fields available per planet (from `ExoplanetSearchItem` in `src/api/contracts.ts`):

`planetName`, `hostname`, `discoveryMethod`, `discoveryYear`, `orbitalPeriodDays`, `radiusEarth`, `massEarth`, `massIsMsini`, `distancePc`, `raDeg`, `decDeg`, `spectralType`.

Snapshot rules:

- A script in `scripts/` writes `data/snapshots/planets-YYYY-MM-DD.json`.
- The file records `retrievedAtUtc`, the source table, and the query used.
- Keep the file under 2 MB. If it is larger, generate it at build time instead of committing it.
- Do not mix in exoplanet.eu data without a visible flag.

## Out of scope

- Habitability, life signals, technosignatures.
- Light curves and raw TESS data.
- Mass–radius models or any interior-composition claims.
- Any ranking or score that tells a visitor which planet is "best".

## Technical notes

- Stack: React 19, Tailwind v4, the existing components (`IntroSearch`, `ExoplanetDetailPanel`, `SkyViewerPanel`).
- Charts: the implementer may add a small charting library. Keep it small, say why in the PR, and check the bundle size with `npm run build`.
- Tests: unit tests for the binning, the logarithmic filter and the unit conversion. A Playwright smoke test for the guided path.
- Git: small commits on `main`, as agreed. Claude reviews the diff after each part.

## Definition of done

- Part 1, Part 2 and Part 3 are reachable from the first screen.
- `npm run typecheck`, `npm test` and `npm run build` pass.
- Each chart shows its source, snapshot date and counts.
- No out-of-scope item appears in the UI or the copy.
- A short note in `docs/product/` says what changed and what is still open.
