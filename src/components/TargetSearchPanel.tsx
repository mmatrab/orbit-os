import React, { useRef } from 'react';
import { RotateCw, Search } from 'lucide-react';
import {
  DataSourceMode,
  DiscoveryMethod,
  ExoplanetSearchItem,
  SearchTargetsParams,
} from '../api/contracts';
import { formatDecDms, formatRaHms } from '../utils/coordinates';

interface TargetSearchPanelProps {
  mode: DataSourceMode;
  params: SearchTargetsParams;
  items: ExoplanetSearchItem[];
  totalCount: number;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
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
  searchInputRef,
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

  const hasActiveFilters =
    Boolean(params.q?.trim()) ||
    (params.discoveryMethod && params.discoveryMethod !== 'ALL') ||
    Boolean(params.requireRadius) ||
    Boolean(params.requireMass);

  return (
    <section
      className="bg-[#0F151E] border border-slate-800 rounded flex flex-col"
      aria-labelledby="search-panel-title"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-[#121A25]">
        <h2 id="search-panel-title" className="text-xs font-semibold tracking-wide text-slate-100">
          Target Catalog Search
        </h2>
        <span className="font-mono tabular-nums text-[11px] text-slate-400" aria-live="polite">
          {loading ? 'Querying…' : `${items.length} of ${totalCount} targets`}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="target-query" className="text-xs font-medium text-slate-300">
              Planet or Host Star Identifier
            </label>
            <span className="font-mono text-[10px] text-slate-500">Shortcut: /</span>
          </div>
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              id="target-query"
              type="search"
              placeholder="TRAPPIST-1, Kepler-186, Proxima Cen…"
              value={params.q ?? ''}
              onChange={(e) => onParamsChange({ ...params, q: e.target.value })}
              className="w-full pl-8 pr-3 py-2 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div>
            <label
              htmlFor="method-filter"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Detection Method
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
              className="w-full px-2.5 py-2 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
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
                <span>Measured Radius</span>
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
                <span>Measured Mass</span>
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
                Reset filters
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3">
          {error && (
            <div
              className="p-3 rounded border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs flex flex-col gap-2"
              role="alert"
            >
              <div>
                <strong className="block text-rose-100 mb-0.5">Live Archive Query Failed</strong>
                <span>{error}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-rose-400/50 hover:bg-rose-500/20 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" aria-hidden="true" />
                  <span>Retry Live Query</span>
                </button>
              </div>
            </div>
          )}

          {!error && loading && items.length === 0 && (
            <div
              className="p-4 rounded border border-dashed border-slate-700 text-center text-xs text-slate-400"
              aria-busy="true"
            >
              Querying exoplanet catalog…
            </div>
          )}

          {!error && !loading && items.length === 0 && (
            <div className="p-4 rounded border border-dashed border-slate-700 text-center text-xs text-slate-400">
              No catalog targets match the active filter criteria.
            </div>
          )}

          {!error && items.length > 0 && (
            <ul
              className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1"
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
                      className={`w-full text-left px-3 py-2.5 rounded border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-cyan-400/80 bg-cyan-950/25'
                          : 'border-slate-800 bg-[#07090E] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-semibold text-slate-100">
                          {item.planetName}
                        </span>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {item.discoveryMethod} · {item.discoveryYear || '—'}
                        </span>
                      </div>

                      <div className="font-mono tabular-nums text-[11px] text-slate-400 mt-1">
                        {formatRaHms(item.raDeg)} {formatDecDms(item.decDeg)}
                      </div>

                      <div className="font-mono tabular-nums text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-2">
                        <span>
                          P {item.orbitalPeriodDays !== null ? `${item.orbitalPeriodDays} d` : '—'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Rp {item.radiusEarth !== null ? `${item.radiusEarth} R⊕` : 'unmeasured'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {item.massIsMsini ? 'Mp sin i' : 'Mp'}{' '}
                          {item.massEarth !== null ? `${item.massEarth} M⊕` : 'unmeasured'}
                        </span>
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
