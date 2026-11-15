# Space Explorer: pitch and quick demo

ORBIT OS, first module. Prepared 15 November 2026 for the team and for ChatGPT.

## 1. The pitch deck (7 slides)

Speaker outline. The slide text is shown as it appears in the deck; the notes under each slide are what to say.

### Slide 1: Cover

ORBIT OS · first module. Space Explorer. Explore worlds beyond our Solar System, with the evidence behind every number.

Say: ORBIT OS is a modular science platform, and Space Explorer is its first module. In two minutes I'll show what it does, why you can trust it, and how it plugs into the platform.

### Slide 2: The problem

Exoplanet data is public, but not approachable.

- Over 6,000 confirmed planets, listed as expert-only tables, codes and flags.
- Seeing where a star sits in the sky means opening a second, specialist tool.
- Once a number is copied, nobody knows which paper it came from or how sure it is.

Say: the NASA Exoplanet Archive is a fantastic resource, but it speaks in column names and flags. When numbers get copied into a report, their source and uncertainty usually disappear.

### Slide 3: What we built

One guided path, from a name to a cited report.

1. Discover: search any confirmed planet, or start from TRAPPIST-1 e, 51 Peg b or Proxima Cen b.
2. Explore: see the host star in real telescope survey images.
3. Understand: three key facts in plain words (size, mass, orbit), each with its paper.
4. Research: every value, uncertainty and reference one tab away. Notes stay private in the browser.
5. Export: JSON, CSV or a Markdown report, and a captioned sky image.

Say: you search a planet, see its star in real sky images, get three key facts in plain language, and find the detailed data with references one tab away. Everything can be exported with its sources.

### Slide 4: Real sky, honestly labelled

![The exported sky image: a real capture around TRAPPIST-1, with its caption printed on the PNG.](docs/product/pitch/sky-export.png)

*The exported sky image: a real capture around TRAPPIST-1, with its caption printed on the PNG.*

- Real survey images: DSS2, 2MASS, AllWISE and Pan-STARRS, from CDS, with an ESA mirror as backup.
- The star, not the planet: the circle marks the host star. The planet is too faint to see, and the app says so.
- Export with its caption: planet, coordinates, survey, credit and capture time are printed on the PNG.
- Never a fake image: if the servers are unreachable, the viewer says so and offers alternatives.

Say: this is a real capture around TRAPPIST-1. Earlier the viewer could stay grey forever when the main image server was blocked. We found the cause and now fall back to ESA's mirror automatically.

### Slide 5: Trust by design

Every number keeps its evidence. How the app shows each case the archive can report:

| When the archive says | The user sees |
| --- | --- |
| Minimum mass only | “Minimum mass (M sin i)”, and why the true mass can be larger |
| Value estimated by NASA | Marked “derived”, never presented as a measurement |
| Flagged as a limit | “Limit — direction unverified” instead of a guessed < or > |
| No value | “Not measured”: nothing is estimated or filled in |
| Any published value | Its uncertainty, its paper and a link, in the app and in every export |

Say: scientific honesty is built in, not added later. Missing stays missing. There is no simulated data anywhere in the product.

### Slide 6: Plug and play

Drops into ORBIT OS without touching the platform. Four ways to integrate:

- iframe: one tag, works with any stack.
- Web component: one script and one tag, with events to open a planet from the platform.
- REST API: the same cited data, for a team that wants its own interface.
- Express mount: one process, for a Node host.

Say: it is a self-contained module, with one Node.js service and one runtime dependency. Notes stay in each user's browser by default: no accounts, no shared database, no secrets in the frontend.

### Slide 7: Where we are

Status as of 15 November 2026. Updated since the deck was first written.

- Pull request #4 is merged into main.
- Automated tests: 79, all passing (the deck says 69; this is the current count).
- Layout v2: the sky image is now the main picture, the planet's numbers sit on the right, and a new 3D system tab shows the star, planet and orbit.
- Palette: the dark backgrounds were lightened for readability.
- Simulated values in the product: 0.

Next: the live NASA check on our machines, the Docker build, embedding in the ORBIT OS platform, and the storytelling views (a build brief is written for them).

## 2. The spoken pitch (about one minute)

Hi everyone. Space Explorer is the first product of ORBIT OS, a modular science platform.

It lets anyone explore the known worlds beyond our Solar System. You search for a planet, see its key facts, and look at its real position in the sky. Every value comes from the NASA Exoplanet Archive, and every value shows where it came from.

Three things make it useful. First, it is simple: the screen shows the sky and three key measurements, and everything else is one click away. Second, the data is honest: each value is marked as measured, derived, or a limit with an unverified direction. Third, it is easy to reuse: you can export the evidence as CSV, JSON or Markdown, keep private notes in your browser, and embed the module in another site with a short integration guide.

We are not finished. Live NASA checks and a full browser test still need to run, and the Docker build is unverified. Next we add the guided 'Find a world' path, a discovery timeline, and a radius-against-period chart.

Our goal for this stage is simple: make a real astronomy question easy to answer, and make the answer easy to trust. Thank you. Questions?

## 3. Quick demo (about 2 minutes)

Before you start: run the app, open it in a clean browser window, and check that the sky image loads. If it does not (the image servers may be blocked on your network), show the screenshot in docs/ui/ instead and say so. The planet data still loads from NASA.

1. First screen (15 s). Say: this is the whole front page, one question and one search box. Press / to show the shortcut.
2. Search and pick (20 s). Type TRAPPIST, then pick TRAPPIST-1 e. Say: the list is sorted nearest first, and each row shows the method, the distance in light-years and the orbit.
3. Sky first (20 s). Point to the sky image, top left. Say: the circle marks the host star. The planet is too faint to see, and we say so. Click Export PNG and show the caption on the file.
4. Three key numbers (25 s). Point to the right-hand column: radius, mass, orbital period. Say: each number has a plain sentence under it, and its source. For the full list, open All data & references.
5. 3D system (25 s). Click the 3D system tab. Say: the star's colour follows its temperature, and the planet's colour is an artistic guess, not a measurement. Drag to rotate. Click To scale and say: at this scale the planet is smaller than one pixel from far away, so we scroll in to find it. Say that motion is sped up on purpose.
6. Export data (15 s). Open Export data and show the CSV or Markdown. Point to the status column: measured, derived or limit. Say: if a value is only a limit, the file says so.
7. Private notes (10 s). Open My notes and save a short note on TRAPPIST-1 e. Say: notes stay in this browser by default. Nothing is sent to a server.
8. Mobile (optional, 10 s). Resize the window to a phone width. Say: the same flow works on a phone.

Close (5 s): That is the core. Next we add the guided 'Find a world' path, the discovery timeline and the radius-against-period chart.

### If something breaks

- No network for the sky image: say 'the image servers are blocked from this network, so I'll show you the saved screenshot', then use docs/ui/.
- A value looks wrong: say 'that's exactly why every value shows its source. Let's check it together.'

