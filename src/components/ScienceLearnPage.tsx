import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';

const SOURCES = {
  methods: 'https://science.nasa.gov/exoplanets/how-we-find-and-characterize/',
  kepler2014: 'https://www.nasa.gov/news-release/nasas-kepler-mission-announces-a-planet-bonanza-715-new-worlds/',
  kepler2016: 'https://www.nasa.gov/news-release/nasas-kepler-mission-announces-largest-collection-of-planets-ever-discovered/',
  archive: 'https://exoplanetarchive.ipac.caltech.edu/docs/API_PS_columns.html',
  kepler: 'https://science.nasa.gov/mission/kepler/in-depth/',
};

const METHODS = [
  {
    name: 'Transit',
    question: 'Does the star briefly get dimmer?',
    body: 'When a planet passes in front of its star from our viewpoint, a small, repeatable dip in starlight can reveal its orbital period. Combined with information about the star, the dip also helps estimate the planet’s radius.',
    takeaway: 'Especially good at finding many planets in the same monitored star field.',
  },
  {
    name: 'Radial velocity',
    question: 'Does the star wobble?',
    body: 'A planet’s gravity pulls on its host star. Astronomers measure shifts in the star’s spectrum as the star moves toward and away from us. This can constrain the planet’s mass; sometimes only a minimum mass (M sin i) is known.',
    takeaway: 'Useful for measuring planetary masses and checking transit discoveries.',
  },
  {
    name: 'Direct imaging',
    question: 'Can we separate the planet’s light?',
    body: 'Specialized optics block the much brighter starlight so a faint planet can sometimes be detected directly. This is challenging and works best for some wide-orbit, relatively luminous planets.',
    takeaway: 'Can help scientists study the light of a planet itself.',
  },
  {
    name: 'Gravitational microlensing',
    question: 'Does gravity briefly brighten a distant star?',
    body: 'An intervening star can bend and amplify light from a more distant star. A planet around the intervening star may add a short-lived signal to that brightening.',
    takeaway: 'Can reveal planets at distances and orbits different from those usually found by transits.',
  },
  {
    name: 'Other methods',
    question: 'Can orbital motion reveal a planet in another way?',
    body: 'Astrometry looks for a star’s small motion across the sky. Transit timing variations look for departures from regularly scheduled transits as planets tug on one another.',
    takeaway: 'Different methods reveal different kinds of systems.',
  },
] as const;

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-cyan-300 underline underline-offset-2 hover:text-cyan-100">
      {children}<ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}

export function ScienceLearnPage({ onBack }: { onBack: () => void }) {
  return (
    <article className="mx-auto max-w-4xl pb-16 text-slate-100" aria-labelledby="science-article-title">
      <button type="button" onClick={onBack}
        className="mb-5 inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-100 cursor-pointer">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Space Explorer
      </button>

      <header className="rounded-xl border border-slate-700 bg-[#161e2c] p-6 sm:p-9">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
          <BookOpen className="h-4 w-4" aria-hidden="true" /> Space Explorer · The science behind the charts
        </p>
        <h1 id="science-article-title" className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
          How did we discover thousands of worlds?
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
          A beginner-friendly guide to planet-hunting techniques, the Kepler discoveries of
          2014 and 2016, and what the NASA Exoplanet Archive charts can — and cannot — tell us.
        </p>
        <p className="mt-3 text-xs text-slate-400">
          Educational article · ~4-minute read · Based on NASA mission and archive documentation
        </p>
      </header>

      <section className="mt-7 space-y-3" aria-labelledby="methods-heading">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">01 / Detection</p>
        <h2 id="methods-heading" className="text-2xl font-semibold">How can we find a planet we cannot see?</h2>
        <p className="text-sm sm:text-base leading-7 text-slate-300">
          Usually, astronomers detect an exoplanet indirectly: they measure a subtle effect
          on the star it orbits or on light passing through space. Each technique has strengths
          and biases, so the catalog contains more of some kinds of planets than others.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {METHODS.map((method) => (
            <div key={method.name} className="rounded-lg border border-slate-700 bg-[#161e2c] p-4 sm:p-5">
              <h3 className="text-lg font-semibold text-cyan-100">{method.name}</h3>
              <p className="mt-1 text-sm font-medium text-slate-100">{method.question}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{method.body}</p>
              <p className="mt-3 border-t border-slate-700 pt-3 text-xs leading-5 text-cyan-200">
                Why it matters: {method.takeaway}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs leading-5 text-slate-400">
          Read NASA’s overview: <SourceLink href={SOURCES.methods}>How we find and characterize exoplanets</SourceLink>.
        </p>
      </section>

      <section className="mt-9 space-y-4" aria-labelledby="kepler-heading">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">02 / A turning point</p>
        <h2 id="kepler-heading" className="text-2xl font-semibold">
          Why did discoveries jump around 2014 and 2016?
        </h2>
        <p className="text-sm sm:text-base leading-7 text-slate-300">
          NASA’s Kepler telescope monitored the brightness of vast numbers of stars to find
          repeatable transits. Its observations produced thousands of planet candidates.
          Later, new statistical validation techniques let researchers confirm many
          candidates together rather than verifying every one individually.
          Two landmark releases help explain the sharp rise in confirmed planets.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-cyan-900/70 bg-[#142436] p-5">
            <span className="text-sm font-semibold text-cyan-300">26 February 2014</span>
            <p className="mt-2 text-3xl font-bold tabular-nums">715</p>
            <h3 className="mt-1 text-lg font-semibold">Newly verified planets</h3>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              Kepler announced 715 planets orbiting 305 stars. Researchers used
              “verification by multiplicity”: multiple planet-like signals around
              the same star can provide strong statistical evidence.
            </p>
            <p className="mt-3 text-xs">
              <SourceLink href={SOURCES.kepler2014}>NASA 2014 announcement</SourceLink>
            </p>
          </div>
          <div className="rounded-lg border border-cyan-900/70 bg-[#142436] p-5">
            <span className="text-sm font-semibold text-cyan-300">10 May 2016</span>
            <p className="mt-2 text-3xl font-bold tabular-nums">1,284</p>
            <h3 className="mt-1 text-lg font-semibold">Newly validated planets</h3>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              A statistical analysis evaluated 4,302 planet candidates in a Kepler
              catalog. For 1,284 of them, the estimated probability of being a
              real planet exceeded 99%, enabling a large confirmation batch.
            </p>
            <p className="mt-3 text-xs">
              <SourceLink href={SOURCES.kepler2016}>NASA 2016 announcement</SourceLink>
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-amber-700/50 bg-[#221d20] p-4">
          <h3 className="text-sm font-semibold text-amber-200">What these spikes actually mean</h3>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            These announcements help explain the growth of the confirmed catalog,
            but the chart in Space Explorer groups planets by the archive’s
            <strong> discovery year</strong> (<code>disc_year</code>) — not the date
            a telescope first observed the signal, nor the date NASA imported the record.
            You cannot attribute every point in the 2014 or 2016 bars to these announcements
            without checking the underlying discovery records.
          </p>
        </div>
        <p className="text-xs text-slate-400">
          More background: <SourceLink href={SOURCES.kepler}>NASA’s Kepler / K2 mission history</SourceLink>.
        </p>
      </section>

      <section className="mt-9 space-y-4" aria-labelledby="charts-heading">
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">03 / Reading the evidence</p>
        <h2 id="charts-heading" className="text-2xl font-semibold">How to read our two charts</h2>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-700 bg-[#161e2c] p-5">
            <h3 className="text-lg font-semibold">Discoveries across the galaxy</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Each bar counts planets grouped by discovery year. Its colours show the
              method by which each planet was first identified. A taller bar means
              more cataloged discoveries for that year — not necessarily a sudden
              burst of planets being formed in space.
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-[#161e2c] p-5">
            <h3 className="text-lg font-semibold">Planet radius versus orbital period</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Each point represents one planet with a usable reported radius and orbital
              period. Vertical position shows size relative to Earth; horizontal position
              shows how long one orbit takes. Both axes are logarithmic, so each major
              step represents a factor of ten, not an equal numerical increment.
              The Earth marker is a reference point — not an exoplanet.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              A planet with an Earth-like radius is not automatically Earth-like in
              temperature, composition or potential to support life. Orbital period
              alone also does not tell us how far it is from its star.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-700 bg-[#111827] p-4">
          <h3 className="font-semibold text-slate-100">Where do these numbers come from?</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Our charts use a dated snapshot of the NASA Exoplanet Archive’s
            <code> pscomppars</code> (Planetary Systems Composite Parameters) table.
            Different parameters may come from different scientific papers.
            Missing and limit-flagged data are handled explicitly rather than invented.
            The snapshot date and number of planets appear beside each chart.
          </p>
          <p className="mt-3 text-xs text-slate-300">
            <SourceLink href={SOURCES.archive}>NASA archive column definitions</SourceLink>
          </p>
        </div>
      </section>

      <div className="mt-9 border-t border-slate-700 pt-5">
        <button type="button" onClick={onBack}
          className="inline-flex items-center gap-2 rounded border border-cyan-700 px-4 py-2 text-sm text-cyan-200 hover:border-cyan-400 cursor-pointer">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Return to the charts
        </button>
      </div>
    </article>
  );
}
