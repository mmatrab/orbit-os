import React, { useMemo, useRef, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import {
  EARTH_YEAR_DAYS,
  filterForLogPlot,
  logPosition,
  logTicks,
  methodGroup,
  snapshotDateLabel,
  type LogPoint,
  type PlanetSnapshot,
} from '../stories/planetSnapshot';

/**
 * Three colour groups: on a scatter every pair of colours can touch, and only three slots of the
 * palette stay separable for colour-blind readers in that case (validated all-pairs on #0e1420).
 * "Other methods" also uses a square marker, so shape tells it apart without colour.
 */
type Group = 'Transit' | 'Radial Velocity' | 'Other methods';
const GROUPS: { id: Group; label: string; colour: string; explain: string }[] = [
  { id: 'Transit', label: 'Transit', colour: '#3987e5', explain: 'The star dims a little each time the planet passes in front of it.' },
  { id: 'Radial Velocity', label: 'Star wobble', colour: '#d95926', explain: 'Radial velocity: the planet pulls its star back and forth.' },
  {
    id: 'Other methods',
    label: 'Other methods',
    colour: '#199e70',
    explain: 'Imaging, microlensing, transit timing, astrometry and the rarer methods. The table gives each planet’s method.',
  },
];
const groupOf = (raw: string | null): Group => {
  const g = methodGroup(raw);
  return g === 'Transit' || g === 'Radial Velocity' ? g : 'Other methods';
};
const colourOf = (g: Group) => GROUPS.find((x) => x.id === g)!.colour;

const W = 860;
const H = 440;
const PAD = { l: 56, r: 48, t: 14, b: 46 };
const PAGE = 100;

const fmt = (n: number) => n.toLocaleString('en-US');
const tickLabel = (v: number) => (v >= 1 ? fmt(v) : String(v));

export const RadiusPeriodChart: React.FC<{ snapshot: PlanetSnapshot & { fileName: string } }> = ({ snapshot }) => {
  const [includeDerived, setIncludeDerived] = useState(false);
  const [hidden, setHidden] = useState<Set<Group>>(new Set());
  const [showTable, setShowTable] = useState(false);
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState<{ p: LogPoint; x: number; y: number } | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const result = useMemo(() => filterForLogPlot(snapshot.planets, { includeDerivedRadius: includeDerived }), [snapshot, includeDerived]);
  const visible = useMemo(() => result.plotted.filter((p) => !hidden.has(groupOf(p.planet.discoveryMethod))), [result, hidden]);
  const groupCounts = useMemo(() => {
    const c: Record<Group, number> = { Transit: 0, 'Radial Velocity': 0, 'Other methods': 0 };
    for (const p of result.plotted) c[groupOf(p.planet.discoveryMethod)] += 1;
    return c;
  }, [result]);

  // Axis ranges: whole powers of ten around every plottable planet (not only the visible ones,
  // so the axes do not jump when a legend item is switched off) and around Earth.
  const [xLo, xHi, yLo, yHi] = useMemo(() => {
    const per = result.plotted.map((p) => p.periodDays).concat(EARTH_YEAR_DAYS);
    const rad = result.plotted.map((p) => p.radiusEarth).concat(1);
    const lo = (v: number[]) => 10 ** Math.floor(Math.log10(Math.min(...v)));
    const hi = (v: number[]) => 10 ** Math.ceil(Math.log10(Math.max(...v)));
    return [lo(per), hi(per), lo(rad), hi(rad)];
  }, [result]);

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const x = (v: number) => PAD.l + logPosition(v, xLo, xHi) * plotW;
  const y = (v: number) => PAD.t + plotH - logPosition(v, yLo, yHi) * plotH;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - svg.left) / svg.width) * W;
    const sy = ((e.clientY - svg.top) / svg.height) * H;
    let best: LogPoint | null = null;
    let bestD = 14 * 14; // hit radius in chart units, larger than the 2.5-unit marks
    for (const p of visible) {
      const dx = x(p.periodDays) - sx;
      const dy = y(p.radiusEarth) - sy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    const box = frameRef.current?.getBoundingClientRect();
    setHover(best && box ? { p: best, x: e.clientX - box.left, y: e.clientY - box.top } : null);
  };

  const toggle = (g: Group) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  const ex = result.excluded;
  const pages = Math.max(1, Math.ceil(result.plotted.length / PAGE));
  const derivedShown = result.plotted.filter((p) => p.radiusDerived).length;

  return (
    <section aria-labelledby="scatter-title" className="rounded border border-slate-800 bg-[#161e2c] p-4" data-testid="radius-period-chart">
      <h3 id="scatter-title" className="text-lg font-semibold text-slate-50">
        Where are the Earth-sized planets, and how close are they to their stars?
      </h3>
      <p className="mt-1 text-xs text-slate-300">
        Source: NASA Exoplanet Archive, table <span className="font-mono">{snapshot.table}</span> · snapshot of{' '}
        {snapshotDateLabel(snapshot.retrievedAtUtc)} <span className="text-slate-500">({snapshot.fileName})</span> ·{' '}
        <strong className="text-slate-100">{fmt(result.plotted.length)}</strong> of {fmt(snapshot.planets.length)} planets plotted ·{' '}
        <strong className="text-slate-100">{fmt(result.excludedTotal)}</strong> left out
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Left out: {fmt(ex.missing_period)} without an orbital period, {fmt(ex.missing_radius)} without a radius, {fmt(ex.limit)} with
        only a limit
        {!includeDerived && `, ${fmt(ex.derived_radius)} whose radius was estimated by the archive rather than measured`}
        {ex.not_positive > 0 && `, ${fmt(ex.not_positive)} with a zero or negative value`}.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Discovery methods: press to show or hide" className="flex flex-wrap gap-2">
          {GROUPS.map((g) => {
            const on = !hidden.has(g.id);
            return (
              <button
                key={g.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(g.id)}
                title={g.explain}
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs cursor-pointer ${
                  on ? 'border-slate-600 text-slate-100' : 'border-slate-800 text-slate-500 line-through'
                }`}
              >
                <span
                  className={`inline-block h-2.5 w-2.5 ${g.id === 'Other methods' ? 'rounded-[1px]' : 'rounded-full'}`}
                  style={{ backgroundColor: on ? g.colour : 'transparent', outline: `1px solid ${g.colour}` }}
                  aria-hidden="true"
                />
                {g.label} <span className="tabular-nums text-slate-400">{fmt(groupCounts[g.id])}</span>
              </button>
            );
          })}
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
          <input type="checkbox" checked={includeDerived} onChange={(e) => setIncludeDerived(e.target.checked)} />
          Also show radii estimated by the archive (hollow circles)
        </label>
        <button type="button" onClick={() => setShowTable((v) => !v)} className="sky-btn ml-auto" aria-pressed={showTable}>
          {showTable ? <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> : <Table2 className="w-3.5 h-3.5" aria-hidden="true" />}
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <div className="mt-3">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full border-collapse text-xs tabular-nums">
              <caption className="pb-2 text-left text-slate-400">
                Every plotted planet in alphabetical order (no ranking), page {page + 1} of {pages}.
              </caption>
              <thead className="sticky top-0 bg-[#161e2c]">
                <tr>
                  {['Planet', 'Host star', 'Discovery method', 'Radius (Earth radii)', 'Orbital period (days)'].map((h) => (
                    <th key={h} scope="col" className="p-1.5 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.plotted.slice(page * PAGE, (page + 1) * PAGE).map((p) => (
                  <tr key={p.planet.planetName} className="border-t border-slate-800">
                    <th scope="row" className="p-1.5 text-left font-normal text-slate-100">{p.planet.planetName}</th>
                    <td className="p-1.5">{p.planet.hostname ?? '—'}</td>
                    <td className="p-1.5">{p.planet.discoveryMethod ?? '—'}</td>
                    <td className="p-1.5">
                      {p.radiusEarth}
                      {p.radiusDerived && <span className="ml-1 text-amber-300">(derived)</span>}
                    </td>
                    <td className="p-1.5">{p.periodDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <button type="button" className="sky-btn" disabled={page === 0} onClick={() => setPage((n) => Math.max(0, n - 1))}>
              Previous page
            </button>
            <span aria-live="polite">
              Page {page + 1} / {pages}
            </span>
            <button type="button" className="sky-btn" disabled={page >= pages - 1} onClick={() => setPage((n) => Math.min(pages - 1, n + 1))}>
              Next page
            </button>
          </div>
        </div>
      ) : (
        <div ref={frameRef} className="relative mt-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            role="img"
            aria-label={`Scatter plot of ${fmt(visible.length)} planets: orbital period in days across, radius in Earth radii up, both on logarithmic scales. Earth is marked for reference. Use "Show table" for every value.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <rect x={PAD.l} y={y(2)} width={plotW} height={y(1.5) - y(2)} fill="#94a3b8" opacity={0.14} />
            <text x={W - PAD.r - 6} y={y(2) - 5} textAnchor="end" fontSize={11} fill="#cbd5e1">
              1.5–2 × Earth: fewer planets here; researchers are still studying why
            </text>
            {logTicks(xLo, xHi).map((t) => (
              <g key={`x${t}`}>
                <line x1={x(t)} x2={x(t)} y1={PAD.t} y2={PAD.t + plotH} stroke="#1f2937" />
                <text x={x(t)} y={H - PAD.b + 16} textAnchor="middle" fontSize={11} fill="#94a3b8">
                  {tickLabel(t)}
                </text>
              </g>
            ))}
            {logTicks(yLo, yHi).map((t) => (
              <g key={`y${t}`}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#1f2937" />
                <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#94a3b8">
                  {tickLabel(t)}
                </text>
              </g>
            ))}
            <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} stroke="#475569" />
            <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t + plotH} stroke="#475569" />
            <text x={PAD.l + plotW / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="#cbd5e1">
              Length of its year: orbital period in Earth days (each grid line is 10× longer)
            </text>
            <text x={14} y={PAD.t + plotH / 2} textAnchor="middle" fontSize={12} fill="#cbd5e1" transform={`rotate(-90 14 ${PAD.t + plotH / 2})`}>
              Size: radius in Earth radii (10× per line)
            </text>
            {visible.map((p) => {
              const g = groupOf(p.planet.discoveryMethod);
              const c = colourOf(g);
              const cx = x(p.periodDays);
              const cy = y(p.radiusEarth);
              if (g === 'Other methods') {
                return (
                  <rect key={p.planet.planetName} x={cx - 2.6} y={cy - 2.6} width={5.2} height={5.2}
                    fill={p.radiusDerived ? 'none' : c} stroke={c} strokeWidth={p.radiusDerived ? 1.2 : 0} />
                );
              }
              return (
                <circle key={p.planet.planetName} cx={cx} cy={cy} r={2.5}
                  fill={p.radiusDerived ? 'none' : c} fillOpacity={0.75} stroke={c} strokeWidth={p.radiusDerived ? 1.1 : 0} />
              );
            })}
            <g aria-hidden="true">
              <circle cx={x(EARTH_YEAR_DAYS)} cy={y(1)} r={7} fill="none" stroke="#f8fafc" strokeWidth={2} />
              <circle cx={x(EARTH_YEAR_DAYS)} cy={y(1)} r={1.8} fill="#f8fafc" />
              <text x={x(EARTH_YEAR_DAYS) + 11} y={y(1) + 4} fontSize={12} fill="#f8fafc">
                Earth (1 Earth radius, 365.25 days)
              </text>
            </g>
            {hover && (
              <circle cx={x(hover.p.periodDays)} cy={y(hover.p.radiusEarth)} r={6} fill="none" stroke="#f8fafc" strokeWidth={1.5} />
            )}
          </svg>
          {hover && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 w-60 rounded border border-slate-600 bg-[#0e1420] px-2.5 py-1.5 text-xs text-slate-100 shadow-lg"
              style={{ left: Math.min(hover.x + 14, (frameRef.current?.clientWidth ?? 600) - 250), top: Math.max(0, hover.y - 96) }}
            >
              <div className="font-semibold">{hover.p.planet.planetName}</div>
              <div className="text-slate-400">Star: {hover.p.planet.hostname ?? '—'}</div>
              <div>Method: {hover.p.planet.discoveryMethod ?? '—'}</div>
              <div className="tabular-nums">
                Radius: {hover.p.radiusEarth} Earth radii
                {hover.p.radiusDerived && <span className="text-amber-300"> (derived, not measured)</span>}
              </div>
              <div className="tabular-nums">Orbital period: {hover.p.periodDays} days</div>
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-[11px] text-slate-400">
        Filled marks are measured radii; hollow marks ({fmt(derivedShown)} shown) are radii the archive calculated from other values
        instead of measuring them. Values in this composite table can come from different papers. Earth is a reference point,
        not an archive planet. Nothing on this chart ranks planets or says anything about life.
      </p>
    </section>
  );
};
