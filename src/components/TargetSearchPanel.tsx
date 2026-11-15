import React, { useRef } from 'react';
import { RotateCw } from 'lucide-react';
import { LIGHT_YEARS_PER_PARSEC } from '../stories/planetSnapshot';
import {
  DataSourceMode,
  DiscoveryMethod,
  ExoplanetSearchItem,
  SearchTargetsParams,
} from '../api/contracts';

/** Rounds to 3 significant figures for scanning; full values are in the planet view. */
function short(n: number): string {
  return Number(n.toPrecision(3)).toLocaleString('en-US');
}

interface TargetSearchPanelProps {
  mode: DataSourceMode;
  params: SearchTargetsParams;
  items: ExoplanetSearchItem[];
  totalCount: number;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  onParamsChange: (next: SearchTargetsParams) => void;
  onSelectTarget: (id: string) => void;
  onRetry: () => void;
}

const DISCOVERY_METHODS: Array<DiscoveryMethod | 'ALL'> = [
  'ALL',
  'Transit',
  'Radial Velocity',
  'Imaging',
  'Microlensing',
  'Transit Timing Variations',
  'Astrometry',
];

export const TargetSearchPanel: React.FC<TargetSearchPanelProps> = ({
  mode,
  params,
  items,
  totalCount,
  selectedId,
  loading,
  error,
  onParamsChange,
  onSelectTarget,
  onRetry,
}) => {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      itemRefs.current[Math.min(idx + 1, items.length - 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      itemRefs.current[Math.max(idx - 1, 0)]?.focus();
    }
  };

  const activeFilterCount =
    (params.discoveryMethod && params.discoveryMethod !== 'ALL' ? 1 : 0) +
    (params.requireRadius ? 1 : 0) +
    (params.requireMass ? 1 : 0);

  const hasActiveFilters =
    Boolean(params.q?.trim()) ||
    (params.discoveryMethod && params.discoveryMethod !== 'ALL') ||
    Boolean(params.requireRadius) ||
    Boolean(params.requireMass);

  return (
    <section
      className="bg-[#161e2c] border border-slate-800 rounded flex flex-col"
      aria-labelledby="search-panel-title"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-[#1a2332]">
        <h2 id="search-panel-title" className="text-sm font-semibold text-slate-100">
          Planets
        </h2>
        <span className="text-[11px] text-slate-400" aria-live="polite">
          {loading
            ? 'Searching…'
            : totalCount > items.length
            ? `${items.length} of ${totalCount.toLocaleString('en-US')} · nearest first`
            : `${totalCount.toLocaleString('en-US')} found · nearest first`}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <details className="group text-xs" open={Boolean(hasActiveFilters && !params.q?.trim())}>
          <summary className="cursor-pointer select-none text-slate-300 hover:text-slate-100 inline-flex items-center gap-2">
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 rounded bg-cyan-500/20 text-cyan-200 text-[10px]">{activeFilterCount} on</span>
            )}
          </summary>
        <div className="flex flex-col gap-2.5 mt-2.5">
          <div>
            <label
              htmlFor="method-filter"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              How it was discovered
            </label>
            <select
              id="method-filter"
              value={params.discoveryMethod ?? 'ALL'}
              onChange={(e) =>
                onParamsChange({
                  ...params,
                  discoveryMethod: e.target.value as DiscoveryMethod | 'ALL',
                })
              }
              className="w-full px-2.5 py-2 text-xs bg-[#0e1420] border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              {DISCOVERY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m === 'ALL' ? 'All detection methods' : m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(params.requireRadius)}
                  onChange={(e) =>
                    onParamsChange({ ...params, requireRadius: e.target.checked })
                  }
                  className="accent-cyan-400 rounded"
                />
                <span>Has a radius</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(params.requireMass)}
                  onChange={(e) =>
                    onParamsChange({ ...params, requireMass: e.target.checked })
                  }
                  className="accent-cyan-400 rounded"
                />
                <span>Has a mass</span>
              </label>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() =>
                  onParamsChange({
                    ...params,
                    q: '',
                    discoveryMethod: 'ALL',
                    requireRadius: false,
                    requireMass: false,
                  })
                }
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 cursor-pointer"
              >
                Clear search and filters
              </button>
            )}
          </div>
        </div>
        </details>

        <div>
          {error && (
            <div
              className="p-3 rounded border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs flex flex-col gap-2"
              role="alert"
            >
              <div>
                <strong className="block text-rose-100 mb-0.5">Search failed</strong>
                <span>{error}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-rose-400/50 hover:bg-rose-500/20 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" aria-hidden="true" />
                  <span>Try again</span>
                </button>
              </div>
            </div>
          )}

          {!error && loading && items.length === 0 && (
            <div
              className="p-4 rounded border border-dashed border-slate-700 text-center text-xs text-slate-400"
              aria-busy="true"
            >
              Searching the NASA Exoplanet Archive…
            </div>
          )}

          {!error && !loading && items.length === 0 && (
            <div className="p-4 rounded border border-dashed border-slate-700 text-center text-xs text-slate-400">
              No planets match. Check the spelling (e.g. “TRAPPIST-1”) or clear the filters.
            </div>
          )}

          {!error && items.length > 0 && (
            <ul
              className="flex flex-col gap-1.5 max-h-[340px] lg:max-h-[calc(100vh-260px)] overflow-y-auto pr-1"
              role="listbox"
              aria-label="Exoplanet search results"
            >
              {items.map((item, idx) => {
                const isSelected = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      ref={(el) => {
                        itemRefs.current[idx] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelectTarget(item.id)}
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      className={`w-full text-left px-3 py-2 rounded border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                        isSelected
                          ? 'border-cyan-400/80 bg-cyan-950/25'
                          : 'border-slate-800 bg-[#0e1420] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-semibold text-slate-100">
                          {item.planetName}
                        </span>
                        <span className="text-[11px] text-slate-500 whitespace-nowrap">
                          {item.discoveryYear ?? ''}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {[
                          item.discoveryMethod,
                          item.distancePc !== null ? `${short(item.distancePc * LIGHT_YEARS_PER_PARSEC)} light-years` : null,
                          item.orbitalPeriodDays !== null ? `${short(item.orbitalPeriodDays)}-day orbit` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
