import { useMemo, useState } from 'react';
import {
  binDiscoveryYears,
  DISCOVERY_METHODS,
  filterLoggable,
  verifySnapshot,
  type DiscoveryCategory,
  type PlanetSnapshot,
} from '../utils/storyCharts';
import { useSnapshot } from '../stories/useSnapshot';
import { DiscoveryTimeline } from './DiscoveryTimeline';
import type { PlanetSnapshot as LoadedSnapshot } from '../stories/planetSnapshot';

const COLOURS: Record<DiscoveryCategory, string> = {
  Transit: '#56B4E9',
  'Radial Velocity': '#E69F00',
  Imaging: '#009E73',
  Microlensing: '#CC79A7',
  'Transit Timing Variations': '#F0E442',
  Astrometry: '#0072B2',
  Other: '#D55E00',
};

const W = 850;
const H = 280;
const L = 52;
const R = 20;
const T = 14;
const B = 42;

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
        {' '}{plotted.length.toLocaleString()} plotted · {excluded.toLocaleString()} excluded (missing, non-positive or NASA limit-flagged radius/period)
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Both axes use logarithmic spacing. The shaded region marks the 1.5–2 Earth-radii gap studied mainly for short-period planets (under ~100 days), not a habitability indicator. Orbital period is not the same as distance from the star.{' '}
        <a href="https://science.nasa.gov/exoplanets/terrestrial/" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">NASA explanation of the radius gap</a>.
      </p>
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
            <rect x={L} y={gapY} width={Math.max(0, x(100) - L)} height={Math.max(0,gapH)} fill="#fbbf24" opacity="0.12" />
            <line x1={L} x2={W-R} y1={H-B} y2={H-B} stroke="#94a3b8" />
            <line x1={L} x2={L} y1={T} y2={H-B} stroke="#94a3b8" />
            {Array.from({ length: Math.floor(maxX) - Math.ceil(minX) + 1 }, (_, i) => i + Math.ceil(minX)).map((power) => {
              const value = 10 ** power;
              return <g key={`x-${power}`}>
                <line x1={x(value)} x2={x(value)} y1={H-B} y2={H-B+5} stroke="#94a3b8" />
                <text x={x(value)} y={H-B+17} fill="#cbd5e1" fontSize="10" textAnchor="middle">{value.toLocaleString('en-US', { maximumFractionDigits: 4 })}</text>
              </g>;
            })}
            {Array.from({ length: Math.floor(maxY) - Math.ceil(minY) + 1 }, (_, i) => i + Math.ceil(minY)).map((power) => {
              const value = 10 ** power;
              return <g key={`y-${power}`}>
                <line x1={L-4} x2={L} y1={y(value)} y2={y(value)} stroke="#94a3b8" />
                <text x={L-7} y={y(value)+3} fill="#cbd5e1" fontSize="10" textAnchor="end">{value.toLocaleString('en-US', { maximumFractionDigits: 4 })}</text>
              </g>;
            })}
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

/** Adapter for the radius–period chart's shape; the snapshot keeps the archive's limit marking as status "l". */
function toChartSnapshot(snap: LoadedSnapshot): PlanetSnapshot {
  return {
    schemaVersion: 'orbit-os.planets-snapshot.v1',
    retrievedAtUtc: snap.retrievedAtUtc,
    source: snap.sourceName,
    table: snap.table,
    query: snap.query,
    totalCount: snap.planets.length,
    planets: snap.planets.map((p) => ({
      planetName: p.planetName,
      hostname: p.hostname ?? '',
      discoveryMethod: p.discoveryMethod ?? 'Other',
      discoveryYear: p.discoveryYear,
      orbitalPeriodDays: p.orbitalPeriodDays,
      radiusEarth: p.radiusEarth,
      radiusLimitFlag: p.radiusStatus === 'l' ? 1 : 0,
      periodLimitFlag: p.orbitalPeriodStatus === 'l' ? 1 : 0,
    })),
  };
}

/** Charts only render from a real, dated NASA snapshot; nothing is substituted if it is missing. */
export function StoryCharts() {
  const state = useSnapshot();
  const chartSnapshot = useMemo(() => {
    if (state.phase !== 'ready') return null;
    const value = toChartSnapshot(state.snapshot);
    return verifySnapshot(value) ? value : null;
  }, [state]);

  return (
    <section id="story-charts" className="mt-6 space-y-4" aria-labelledby="story-charts-heading">
      <h2 id="story-charts-heading" className="text-xl font-semibold text-slate-50">Discoveries across the galaxy</h2>
      {state.phase === 'loading' ? <p className="text-sm text-slate-300" role="status">Loading the dated NASA snapshot…</p> : null}
      {state.phase === 'error' ? (
        <div role="status" className="rounded border border-amber-700 bg-amber-950/20 p-4 text-sm text-slate-200">
          <p>The charts are unavailable: {state.message}</p>
          <p className="mt-1">A real archive snapshot is needed (<code>npm run snapshot</code>). No example data are substituted.</p>
        </div>
      ) : null}
      {state.phase === 'ready' ? (
        <>
          <DiscoveryTimeline snapshot={state.snapshot} />
          {chartSnapshot ? <RadiusPeriodChart snapshot={chartSnapshot} /> : null}
        </>
      ) : null}
    </section>
  );
}
