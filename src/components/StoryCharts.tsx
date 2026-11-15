import { useEffect, useMemo, useState } from 'react';
import {
  binDiscoveryYears,
  DISCOVERY_METHODS,
  filterLoggable,
  verifySnapshot,
  type DiscoveryCategory,
  type PlanetSnapshot,
} from '../utils/storyCharts';

const COLOURS: Record<DiscoveryCategory, string> = {
  Transit: '#56B4E9',
  'Radial Velocity': '#E69F00',
  Imaging: '#009E73',
  Microlensing: '#CC79A7',
  'Transit Timing Variations': '#F0E442',
  Astrometry: '#0072B2',
  Other: '#D55E00',
};

const MILESTONES = [
  { year: 1992, text: 'First confirmed pulsar planets', url: 'https://science.nasa.gov/universe/exoplanets/discovery-alert-with-six-new-worlds-5500-discovery-milestone-passed/' },
  { year: 1995, text: '51 Pegasi b around a Sun-like star', url: 'https://science.nasa.gov/exoplanet-catalog/51-pegasi-b/' },
  { year: 2009, text: 'NASA launches Kepler', url: 'https://science.nasa.gov/mission/kepler/in-depth/' },
] as const;

const W = 850;
const H = 280;
const L = 52;
const R = 20;
const T = 14;
const B = 42;

function Timeline({ snapshot }: { snapshot: PlanetSnapshot }) {
  const { bins, excluded } = useMemo(() => binDiscoveryYears(snapshot.planets), [snapshot]);
  const [shown, setShown] = useState<DiscoveryCategory[]>([...DISCOVERY_METHODS]);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...bins.map((bin) => DISCOVERY_METHODS.reduce((sum, m) => sum + (shown.includes(m) ? bin.counts[m] : 0), 0)));
  const xStep = (W - L - R) / Math.max(1, bins.length);
  const yRange = H - T - B;

  return (
    <section aria-labelledby="story-timeline-title" className="rounded border border-slate-700 bg-[#161e2c] p-4">
      <h3 id="story-timeline-title" className="text-base font-semibold text-slate-50">How did we find the planets we know?</h3>
      <p className="mt-1 text-xs text-slate-300">
        NASA Exoplanet Archive · pscomppars · Snapshot {snapshot.retrievedAtUtc.slice(0, 10)} ·
        {' '}{snapshot.totalCount.toLocaleString()} planets · {excluded.toLocaleString()} without a discovery year
      </p>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Discovery methods — select to show or hide">
        {DISCOVERY_METHODS.map((method) => (
          <button
            key={method}
            type="button"
            aria-pressed={shown.includes(method)}
            onClick={() => setShown((s) => s.includes(method) ? s.filter((v) => v !== method) : [...s, method])}
            className={`rounded border px-2 py-1 text-xs cursor-pointer ${
              shown.includes(method) ? 'border-slate-500 text-slate-100' : 'border-slate-700 text-slate-500 line-through'
            }`}
          >
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOURS[method] }} />
            {method}
          </button>
        ))}
      </div>
      <button type="button" className="sky-btn mt-3" onClick={() => setTable((v) => !v)}>
        {table ? 'Show chart' : 'Show accessible data table'}
      </button>
      {table ? (
        <div className="mt-3 max-h-[350px] overflow-auto">
          <table className="w-full text-xs text-left border-collapse">
            <caption className="text-left pb-2">Number of planets by discovery year and method. All methods included, regardless of chart filters.</caption>
            <thead><tr><th scope="col" className="p-2">Year</th>{DISCOVERY_METHODS.map((m) => <th key={m} scope="col" className="p-2">{m}</th>)}<th scope="col" className="p-2">Total</th></tr></thead>
            <tbody>{bins.map((b) => <tr key={b.year} className="border-t border-slate-700"><th scope="row" className="p-2">{b.year}</th>{DISCOVERY_METHODS.map((m) => <td key={m} className="p-2">{b.counts[m]}</td>)}<td className="p-2">{b.total}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[600px] w-full" role="img" aria-label="Stacked bar chart of confirmed exoplanets per discovery year and discovery method. Use the data table for exact counts.">
            <line x1={L} y1={T + yRange} x2={W-R} y2={T + yRange} stroke="#94a3b8" />
            {[0, 0.5, 1].map((fraction) => (
              <g key={fraction}>
                <line x1={L} y1={T + yRange * (1-fraction)} x2={W-R} y2={T + yRange * (1-fraction)} stroke="#475569" strokeDasharray="3 5" />
                <text x={L - 7} y={T + yRange * (1-fraction) + 4} textAnchor="end" fontSize="12" fill="#cbd5e1">{Math.round(max * fraction)}</text>
              </g>
            ))}
            {bins.map((b, i) => {
              const x = L + i * xStep + 1;
              let used = 0;
              return (
                <g key={b.year}>
                  {DISCOVERY_METHODS.filter((m) => shown.includes(m)).map((method) => {
                    const count = b.counts[method];
                    const h = count / max * yRange;
                    const y = T + yRange - used - h;
                    used += h;
                    return count > 0 ? (
                      <rect key={method} x={x} y={y} width={Math.max(1, xStep - 2)} height={h} fill={COLOURS[method]}>
                        <title>{b.year} · {method}: {count} planets</title>
                      </rect>
                    ) : null;
                  })}
                  {(i % Math.max(1, Math.ceil(bins.length / 9)) === 0 || i === bins.length - 1) && (
                    <text x={x + xStep/2} y={H-B+20} textAnchor="middle" fill="#cbd5e1" fontSize="11">{b.year}</text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-300">Discovery year is when a planet was first reported, not the year NASA added it to this snapshot. Unknown discovery methods count as “Other”.</p>
      <div className="mt-3 border-t border-slate-700 pt-3">
        <p className="text-xs font-semibold text-cyan-200">Three milestones verified with NASA</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {MILESTONES.map((m) => (
            <a key={m.year} href={m.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline underline-offset-2">
              {m.year}: {m.text} (NASA source)
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function RadiusPeriodChart({ snapshot }: { snapshot: PlanetSnapshot }) {
  const { plotted, excluded } = useMemo(() => filterLoggable(snapshot.planets), [snapshot]);
  const [table, setTable] = useState(false);
  const [tablePage, setTablePage] = useState(0);
  const pageSize = 150;
  const tablePages = Math.max(1, Math.ceil(plotted.length / pageSize));
  const [shown, setShown] = useState<DiscoveryCategory[]>([...DISCOVERY_METHODS]);
  const valid = plotted.filter((p) => shown.includes(
    (DISCOVERY_METHODS as readonly string[]).includes(p.discoveryMethod)
      ? p.discoveryMethod as DiscoveryCategory : 'Other'
  ));
  const years = valid.map((p) => Math.log10(p.orbitalPeriodDays!));
  const radii = valid.map((p) => Math.log10(p.radiusEarth!));
  const minX = Math.min(-1, ...years, Math.log10(365.25));
  const maxX = Math.max(3, ...years, Math.log10(365.25));
  const minY = Math.min(-1, ...radii, 0);
  const maxY = Math.max(1, ...radii, 0);
  const x = (v: number) => L + (Math.log10(v) - minX) / (maxX - minX || 1) * (W-L-R);
  const y = (v: number) => T + (maxY - Math.log10(v)) / (maxY - minY || 1) * (H-T-B);
  const gapY = y(2);
  const gapH = y(1.5) - y(2);

  return (
    <section aria-labelledby="story-scatter-title" className="rounded border border-slate-700 bg-[#161e2c] p-4">
      <h3 id="story-scatter-title" className="text-base font-semibold text-slate-50">
        Where are the Earth-sized planets, and how close are they to their stars?
      </h3>
      <p className="mt-1 text-xs text-slate-300">
        NASA Exoplanet Archive · pscomppars · Snapshot {snapshot.retrievedAtUtc.slice(0,10)} ·
        {' '}{plotted.length.toLocaleString()} plotted · {excluded.toLocaleString()} excluded (missing or non-positive radius/period)
      </p>
      <p className="mt-1 text-xs text-slate-400">Both axes use logarithmic spacing. The highlighted radius range (1.5–2 Earth radii) is a region researchers study; it is not a habitability indicator.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DISCOVERY_METHODS.map((method) => (
          <button key={method} type="button" aria-pressed={shown.includes(method)}
            onClick={() => setShown((s) => s.includes(method) ? s.filter((v) => v !== method) : [...s, method])}
            className={`rounded border px-2 py-1 text-xs cursor-pointer ${shown.includes(method) ? 'border-slate-500 text-slate-100' : 'border-slate-700 text-slate-500 line-through'}`}>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOURS[method] }} />{method}
          </button>
        ))}
      </div>
      <button type="button" className="sky-btn mt-3" onClick={() => setTable((v) => !v)}>
        {table ? 'Show chart' : 'Show accessible data table'}
      </button>
      {table ? (
        <div className="mt-3 max-h-[350px] overflow-auto">
          <table className="w-full text-xs text-left">
            <caption className="text-left pb-2">Plot-eligible planets in snapshot order, page {tablePage + 1} of {tablePages}. {plotted.length} eligible in total.</caption>
            <thead><tr>{['Planet', 'Host star', 'Discovery method', 'Radius (Earth)', 'Period (days)'].map((m) => <th key={m} scope="col" className="p-2">{m}</th>)}</tr></thead>
            <tbody>{plotted.slice(tablePage * pageSize, (tablePage + 1) * pageSize).map((p) => <tr className="border-t border-slate-700" key={p.planetName}><th scope="row" className="p-2">{p.planetName}</th><td className="p-2">{p.hostname}</td><td className="p-2">{p.discoveryMethod}</td><td className="p-2">{p.radiusEarth}</td><td className="p-2">{p.orbitalPeriodDays}</td></tr>)}</tbody>
          </table>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button type="button" className="sky-btn" disabled={tablePage === 0} onClick={() => setTablePage((p) => Math.max(0, p - 1))}>Previous page</button>
            <span aria-live="polite">Page {tablePage + 1} / {tablePages}</span>
            <button type="button" className="sky-btn" disabled={tablePage >= tablePages - 1} onClick={() => setTablePage((p) => Math.min(tablePages - 1, p + 1))}>Next page</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[600px]" role="img" aria-label="Logarithmic scatter chart of planet orbital period versus planet radius. Open the accessible table for exact numbers.">
            <rect x={L} y={gapY} width={W-L-R} height={Math.max(0,gapH)} fill="#fbbf24" opacity="0.12" />
            <line x1={L} x2={W-R} y1={H-B} y2={H-B} stroke="#94a3b8" />
            <line x1={L} x2={L} y1={T} y2={H-B} stroke="#94a3b8" />
            {valid.map((p) => {
              const method = (DISCOVERY_METHODS as readonly string[]).includes(p.discoveryMethod)
                ? p.discoveryMethod as DiscoveryCategory : 'Other';
              return <circle key={p.planetName} cx={x(p.orbitalPeriodDays!)} cy={y(p.radiusEarth!)} r="2.1" opacity="0.68" fill={COLOURS[method]}>
                <title>{p.planetName} · {p.hostname} · {method} · Radius {p.radiusEarth} Earth radii · Period {p.orbitalPeriodDays} days</title>
              </circle>;
            })}
            <circle cx={x(365.25)} cy={y(1)} r="6" fill="none" stroke="#ffffff" strokeWidth="2" />
            <text x={x(365.25) + 9} y={y(1) - 9} fill="#ffffff" fontSize="12">Earth (reference)</text>
            <text x={W/2} y={H-4} fill="#cbd5e1" fontSize="12" textAnchor="middle">Orbital period (Earth days, log scale)</text>
            <text x="12" y="16" fill="#cbd5e1" fontSize="12">Radius (Earth radii, log)</text>
          </svg>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-400">Measurements from a composite catalogue can originate in different papers. Earth is a reference point, not an archive exoplanet. No conclusions about life are implied.</p>
    </section>
  );
}

/** Charts only render when a real, dated NASA snapshot has been generated. */
export function StoryCharts() {
  const [snapshot, setSnapshot] = useState<PlanetSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const url = new URL('data/snapshots/latest.json', document.baseURI);
    fetch(url).then(async (res) => {
      if (!res.ok) throw new Error('NASA snapshot is not installed on this deployment.');
      const value: unknown = await res.json();
      if (!verifySnapshot(value)) throw new Error('NASA snapshot did not pass validation.');
      if (!cancelled) setSnapshot(value);
    }).catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Cannot load NASA snapshot.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="mt-6 space-y-4" aria-labelledby="story-charts-heading">
      <h2 id="story-charts-heading" className="text-xl font-semibold text-slate-50">Discoveries across the galaxy</h2>
      {loading ? <p className="text-sm text-slate-300" role="status">Loading the dated NASA snapshot…</p> : null}
      {error ? (
        <div role="status" className="rounded border border-amber-700 bg-amber-950/20 p-4 text-sm text-slate-200">
          <p>The historical charts are unavailable: {error}</p>
          <p className="mt-1">The deployed site needs a real archive snapshot generated with <code>npm run snapshot</code>. No example data are substituted.</p>
        </div>
      ) : null}
      {snapshot ? <><Timeline snapshot={snapshot} /><RadiusPeriodChart snapshot={snapshot} /></> : null}
    </section>
  );
}
