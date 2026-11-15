import React, { useMemo, useRef, useState } from 'react';
import { ExternalLink, Table2, BarChart3 } from 'lucide-react';
import type { DiscoveryMethod } from '../api/contracts';
import {
  METHOD_ORDER,
  METHOD_PLAIN,
  binDiscoveriesByYear,
  checkedMilestones,
  snapshotDateLabel,
  visibleTotal,
  type PlanetSnapshot,
} from '../stories/planetSnapshot';
import { METHOD_COLOURS } from '../stories/methodColors';

const W = 860;
const H = 300;
const PAD = { l: 48, r: 12, t: 26, b: 34 };

/** Round axis maximum: 1, 2 or 5 times a power of ten, at least the data maximum. */
export function niceMax(n: number): number {
  if (n <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= n)!;
}

interface Hover {
  x: number;
  y: number;
  year: number;
  method: DiscoveryMethod;
  count: number;
  total: number;
}

export const DiscoveryTimeline: React.FC<{ snapshot: PlanetSnapshot & { fileName: string } }> = ({ snapshot }) => {
  const { bins, counted, withoutYear, methodTotals } = useMemo(() => binDiscoveriesByYear(snapshot.planets), [snapshot]);
  const milestones = useMemo(() => checkedMilestones(snapshot.planets), [snapshot]);
  const [hidden, setHidden] = useState<Set<DiscoveryMethod>>(new Set());
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const total = snapshot.planets.length;
  const shownCount = bins.reduce((s, b) => s + visibleTotal(b, hidden), 0);
  const yMax = niceMax(Math.max(1, ...bins.map((b) => visibleTotal(b, hidden))));
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const step = plotW / Math.max(1, bins.length);
  const barW = Math.max(2, step - 2);
  const xOf = (year: number) => PAD.l + (year - (bins[0]?.year ?? year)) * step;
  const yOf = (v: number) => PAD.t + plotH - (v / yMax) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * yMax));

  const toggle = (m: DiscoveryMethod) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });

  const onEnter = (e: React.PointerEvent, year: number, method: DiscoveryMethod, count: number, yearTotal: number) => {
    const box = frameRef.current?.getBoundingClientRect();
    if (!box) return;
    setHover({ x: e.clientX - box.left, y: e.clientY - box.top, year, method, count, total: yearTotal });
  };

  const dateLabel = snapshotDateLabel(snapshot.retrievedAtUtc);

  return (
    <section aria-labelledby="timeline-title" className="rounded border border-slate-800 bg-[#161e2c] p-4" data-testid="discovery-timeline">
      <h3 id="timeline-title" className="text-lg font-semibold text-slate-50">
        How did we find the planets we know?
      </h3>
      <p className="mt-1 text-xs text-slate-300">
        Source: NASA Exoplanet Archive, table <span className="font-mono">{snapshot.table}</span> · snapshot of {dateLabel}{' '}
        <span className="text-slate-500">({snapshot.fileName})</span> · {counted.toLocaleString('en-US')} of{' '}
        {total.toLocaleString('en-US')} planets
        {withoutYear > 0 ? ` (${withoutYear.toLocaleString('en-US')} without a discovery year are not shown)` : ''}
      </p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Discovery methods: press to show or hide">
        {METHOD_ORDER.map((m) => {
          const on = !hidden.has(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(m)}
              title={`${METHOD_PLAIN[m].explain}${m !== METHOD_PLAIN[m].label ? ` (archive name: ${m})` : ''}`}
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs cursor-pointer ${
                on ? 'border-slate-600 text-slate-100' : 'border-slate-800 text-slate-500 line-through'
              }`}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: on ? METHOD_COLOURS[m] : 'transparent', outline: `1px solid ${METHOD_COLOURS[m]}` }} aria-hidden="true" />
              {METHOD_PLAIN[m].label}
              <span className="text-slate-400 tabular-nums">{methodTotals[m].toLocaleString('en-US')}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => setShowTable((v) => !v)} className="sky-btn ml-auto" aria-pressed={showTable}>
          {showTable ? <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> : <Table2 className="w-3.5 h-3.5" aria-hidden="true" />}
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <div className="mt-3 max-h-[420px] overflow-auto">
          <table className="w-full border-collapse text-xs tabular-nums">
            <caption className="pb-2 text-left text-slate-400">
              Planets per discovery year and method, all methods, {dateLabel} snapshot.
            </caption>
            <thead className="sticky top-0 bg-[#161e2c]">
              <tr>
                <th scope="col" className="p-1.5 text-left">Year</th>
                {METHOD_ORDER.map((m) => (
                  <th key={m} scope="col" className="p-1.5 text-right" title={m}>
                    {METHOD_PLAIN[m].label}
                  </th>
                ))}
                <th scope="col" className="p-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {bins.map((b) => (
                <tr key={b.year} className="border-t border-slate-800">
                  <th scope="row" className="p-1.5 text-left font-normal">{b.year}</th>
                  {METHOD_ORDER.map((m) => (
                    <td key={m} className="p-1.5 text-right">{b.byMethod[m]}</td>
                  ))}
                  <td className="p-1.5 text-right text-slate-100">{b.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600">
                <th scope="row" className="p-1.5 text-left">All years</th>
                {METHOD_ORDER.map((m) => (
                  <td key={m} className="p-1.5 text-right">{methodTotals[m].toLocaleString('en-US')}</td>
                ))}
                <td className="p-1.5 text-right text-slate-100">{counted.toLocaleString('en-US')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div ref={frameRef} className="relative mt-3" onPointerLeave={() => setHover(null)}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            role="img"
            aria-label={`Bar chart: planets discovered each year from ${bins[0]?.year} to ${bins[bins.length - 1]?.year}, stacked by discovery method. ${shownCount.toLocaleString('en-US')} planets shown. Use "Show table" for every number.`}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} stroke={t === 0 ? '#475569' : '#263042'} strokeWidth={1} />
                <text x={PAD.l - 6} y={yOf(t) + 4} textAnchor="end" fontSize={11} fill="#94a3b8">
                  {t.toLocaleString('en-US')}
                </text>
              </g>
            ))}
            {bins.map((b) => {
              let acc = 0;
              const yearTotal = visibleTotal(b, hidden);
              return (
                <g key={b.year}>
                  {METHOD_ORDER.filter((m) => !hidden.has(m) && b.byMethod[m] > 0).map((m) => {
                    const c = b.byMethod[m];
                    const y0 = yOf(acc);
                    acc += c;
                    const y1 = yOf(acc);
                    return (
                      <rect
                        key={m}
                        x={xOf(b.year) + 1}
                        y={y1}
                        width={barW}
                        height={Math.max(1, y0 - y1)}
                        fill={METHOD_COLOURS[m]}
                        stroke="#161e2c"
                        strokeWidth={0.75}
                        onPointerEnter={(e) => onEnter(e, b.year, m, c, yearTotal)}
                        onPointerMove={(e) => onEnter(e, b.year, m, c, yearTotal)}
                      />
                    );
                  })}
                  {b.year % 5 === 0 && (
                    <text x={xOf(b.year) + step / 2} y={H - PAD.b + 16} textAnchor="middle" fontSize={11} fill="#94a3b8">
                      {b.year}
                    </text>
                  )}
                </g>
              );
            })}
            {milestones.map((m, i) => {
              const x = xOf(m.year) + step / 2;
              return (
                <g key={m.id} aria-hidden="true">
                  <line x1={x} x2={x} y1={PAD.t - 4} y2={PAD.t + plotH} stroke="#e2e8f0" strokeDasharray="2 3" strokeWidth={1} opacity={0.6} />
                  <circle cx={x} cy={PAD.t - 12} r={8} fill="#0e1420" stroke="#e2e8f0" strokeWidth={1} />
                  <text x={x} y={PAD.t - 8} textAnchor="middle" fontSize={10} fill="#f1f5f9">
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
          {hover && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 rounded border border-slate-600 bg-[#0e1420] px-2.5 py-1.5 text-xs text-slate-100 shadow-lg"
              style={{ left: Math.min(hover.x + 12, (frameRef.current?.clientWidth ?? 600) - 190), top: Math.max(0, hover.y - 64) }}
            >
              <div className="font-semibold">{hover.year}</div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: METHOD_COLOURS[hover.method] }} aria-hidden="true" />
                {METHOD_PLAIN[hover.method].label}: <span className="tabular-nums">{hover.count.toLocaleString('en-US')}</span>
              </div>
              <div className="text-slate-400">Year total shown: {hover.total.toLocaleString('en-US')}</div>
            </div>
          )}
        </div>
      )}

      {milestones.length > 0 && (
        <ol className="mt-3 grid gap-2 text-xs text-slate-300 md:grid-cols-3" aria-label="Milestones">
          {milestones.map((m, i) => (
            <li key={m.id} className="rounded border border-slate-800 p-2.5">
              <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px]">{i + 1}</span>
              <strong className="text-slate-100">{m.year}</strong> · {m.text}
              <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-cyan-300 hover:text-cyan-200">
                Source: {m.sourceLabel} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-[11px] text-slate-400">
        Totals check: the bars add up to {counted.toLocaleString('en-US')} planets
        {counted === total ? `, the full snapshot count.` : `; ${(total - counted).toLocaleString('en-US')} have no discovery year.`} The
        discovery year is the year the planet was first reported; {bins[bins.length - 1]?.year} only counts planets reported up to {dateLabel}. “Other methods” groups pulsar timing, eclipse timing, orbital
        brightness changes, pulsation timing and disk motion. Each milestone was checked against the archive’s discovery reference
        and is shown only if this snapshot still supports it.
      </p>
    </section>
  );
};
