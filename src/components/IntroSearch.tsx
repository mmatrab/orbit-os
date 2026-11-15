import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Compass, Search } from 'lucide-react';
import type { DiscoveryMethod, ExoplanetSearchItem } from '../api/contracts';
import type { PlanetSnapshot } from '../stories/planetSnapshot';
import { METHOD_ORDER, METHOD_PLAIN, LIGHT_YEARS_PER_PARSEC } from '../stories/planetSnapshot';
import { CatalogBrowser } from './CatalogBrowser';
import {
  discoverySuggestions,
  liveResultSuggestions,
  PLANET_SIZE_LABELS,
  type DiscoveryFilters,
  type PlanetSizeFilter,
  type SearchObjectType,
} from '../utils/discoverySearch';

interface IntroSearchProps {
  query: string;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (q: string) => void;
  onPickExample: (planetName: string) => void;
  discoveryMethod: DiscoveryMethod | 'ALL';
  onDiscoveryMethodChange: (method: DiscoveryMethod | 'ALL') => void;
  snapshot: PlanetSnapshot | null;
  liveItems: ExoplanetSearchItem[];
  loading: boolean;
  error: string | null;
  selectedPlanetName: string | null;
}

const EXAMPLES = ['TRAPPIST-1 e', '51 Peg b', 'Proxima Cen b'];
const LIGHT_YEAR = (pc: number | null) =>
  pc !== null && Number.isFinite(pc) && pc >= 0
    ? `${Number((pc * LIGHT_YEARS_PER_PARSEC).toPrecision(3)).toLocaleString('en-US')} ly`
    : null;

/**
 * A search-first discovery panel. Suggestions appear directly below the input,
 * rather than in a separate list far below the sky canvas.
 *
 * Uses the already-dated, real NASA snapshot for instant suggestions. Selecting
 * one still opens its live scientific record through the existing app API.
 */
export const IntroSearch: React.FC<IntroSearchProps> = ({
  query,
  searchInputRef,
  onQueryChange,
  onPickExample,
  discoveryMethod,
  onDiscoveryMethodChange,
  snapshot,
  liveItems,
  loading,
  error,
  selectedPlanetName,
}) => {
  const [open, setOpen] = useState(false);
  const [objectType, setObjectType] = useState<SearchObjectType>('planet');
  const [planetSize, setPlanetSize] = useState<PlanetSizeFilter>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const filters: DiscoveryFilters = { query, objectType, planetSize, discoveryMethod };
  const results = useMemo(
    () => snapshot
      ? discoverySuggestions(snapshot.planets, filters)
      : { suggestions: liveResultSuggestions(liveItems, filters), matchedPlanets: null, matchedSystems: null },
    // Querying 6,470 local catalogue rows is inexpensive and avoids a network call on each keypress.
    [snapshot, liveItems, query, objectType, planetSize, discoveryMethod]
  );
  const suggestions = results.suggestions;

  useEffect(() => setActiveIndex(0), [query, objectType, planetSize, discoveryMethod]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [open]);

  const choose = (planetName: string) => {
    onPickExample(planetName);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && open && suggestions.length > 0) {
      e.preventDefault();
      choose(suggestions[Math.min(activeIndex, suggestions.length - 1)].planetName);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <section className="h-full px-5 py-4 rounded border border-slate-800 bg-[#161e2c] flex flex-col" aria-labelledby="intro-title">
      <h1 id="intro-title" className="text-xl sm:text-2xl font-semibold text-slate-50">
        Explore worlds beyond our Solar System
      </h1>
      <p className="mt-1.5 text-sm text-slate-300 max-w-3xl">
        Discover confirmed exoplanets from the{' '}
        <a href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noopener noreferrer"
          className="text-cyan-300 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-200">
          NASA Exoplanet Archive
        </a>.
        {' '}Start with a name, or browse real planets and the stars they orbit.
      </p>

      <div ref={rootRef} className="mt-3 relative w-full" id="planet-search">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          <label htmlFor="target-query" className="sr-only">Search a planet or host star</label>
          <input
            ref={searchInputRef}
            id="target-query"
            type="search"
            placeholder="Find a planet or a star — or just browse"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => { onQueryChange(e.target.value); setOpen(true); }}
            onKeyDown={handleKeyDown}
            aria-expanded={open}
            aria-controls="search-suggestions"
            aria-autocomplete="list"
            role="combobox"
            autoComplete="off"
            className="w-full pl-10 pr-12 py-3 text-base bg-[#0e1420] border border-cyan-500/70 rounded text-slate-100 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <button type="button" aria-label={open ? 'Close discovery suggestions' : 'Browse discovery suggestions'}
            onClick={() => { setOpen((v) => !v); searchInputRef?.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-cyan-300 cursor-pointer">
            <ChevronDown aria-hidden="true" className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {open && (
          <div id="search-suggestions"
            className="absolute z-50 top-full left-0 right-0 mt-2 rounded-lg border border-slate-500 bg-[#192536] shadow-2xl shadow-black/70 overflow-hidden"
            aria-label="Explore NASA catalogue">
            <div className="p-4 border-b border-slate-700">
              <div className="flex gap-2 flex-wrap items-center justify-between">
                <span className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-cyan-300" aria-hidden="true" />
                  Explore by category
                </span>
                <button type="button" onClick={() => { onQueryChange(''); setPlanetSize('all'); onDiscoveryMethodChange('ALL'); }}
                  className="text-sm text-cyan-300 hover:underline cursor-pointer">Reset filters</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <label className="text-sm text-slate-200">
                  Object
                  <select value={objectType} onChange={(e) => setObjectType(e.target.value as SearchObjectType)}
                    className="mt-1.5 block w-full min-h-11 bg-[#0e1420] border border-slate-600 text-slate-100 rounded px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-cyan-400">
                    <option value="planet">Planets</option>
                    <option value="system">Host stars / systems</option>
                  </select>
                </label>
                <label className="text-sm text-slate-200">
                  Size of planet
                  <select value={planetSize} onChange={(e) => setPlanetSize(e.target.value as PlanetSizeFilter)}
                    className="mt-1.5 block w-full min-h-11 bg-[#0e1420] border border-slate-600 text-slate-100 rounded px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-cyan-400">
                    {(Object.entries(PLANET_SIZE_LABELS) as [PlanetSizeFilter,string][]).map(([key,label]) =>
                      <option value={key} key={key}>{label}</option>)}
                  </select>
                </label>
                <label className="text-sm text-slate-200">
                  Discovery method
                  <select value={discoveryMethod} onChange={(e) => onDiscoveryMethodChange(e.target.value as DiscoveryMethod | 'ALL')}
                    className="mt-1.5 block w-full min-h-11 bg-[#0e1420] border border-slate-600 text-slate-100 rounded px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-cyan-400">
                    <option value="ALL">All methods</option>
                    {METHOD_ORDER.map((method) => <option key={method} value={method}>{METHOD_PLAIN[method].label}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-xs leading-relaxed text-slate-300 mt-3">
                Planet size means published radius, not composition. The host-star category shows only stars with confirmed planets.
              </p>
            </div>
            <div className="max-h-[min(60vh,520px)] overflow-y-auto overscroll-contain" role="listbox" aria-label="Suggested planets or systems">
              {suggestions.map((suggestion, index) => (
                <button key={suggestion.id} type="button" role="option" aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(suggestion.planetName)}
                  className={`w-full min-h-[70px] text-left flex items-center justify-between gap-4 px-4 py-3.5 border-b border-slate-700/60 last:border-b-0 cursor-pointer focus-visible:outline focus-visible:outline-cyan-400 ${
                    index === activeIndex ? 'bg-cyan-900/25' : 'hover:bg-slate-700/40'
                  }`}>
                  <span className="min-w-0">
                    <span className="block text-base leading-6 text-slate-50 font-semibold truncate">{suggestion.label}</span>
                    <span className="block text-sm leading-5 text-slate-300 truncate">{suggestion.detail}</span>
                  </span>
                  <span className="text-sm text-cyan-100 shrink-0">{LIGHT_YEAR(suggestion.distancePc) ?? 'Distance unknown'}</span>
                </button>
              ))}
              {suggestions.length === 0 && (
                <div className="px-4 py-5 text-sm leading-6 text-slate-200">
                  {loading && !snapshot ? 'Loading real NASA results…' :
                   error && !snapshot ? `NASA search unavailable: ${error}` :
                   'No matching planets. Try removing a filter or typing part of another name.'}
                </div>
              )}
            </div>
            <div className="px-4 py-3 bg-[#111827] flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-300">
                {snapshot ? `${(objectType === 'planet' ? results.matchedPlanets : results.matchedSystems)?.toLocaleString('en-US')} matches · NASA snapshot ${snapshot.retrievedAtUtc.slice(0,10)}`
                  : 'Suggestions from current NASA search results'}
              </span>
              <span className="text-xs text-slate-400">↑ ↓ to choose · Enter to open · Esc to close</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>Not sure where to start?</span>
        {EXAMPLES.map((name) => (
          <button key={name} type="button" onClick={() => choose(name)}
            className="px-2.5 py-1 rounded border border-slate-700 text-cyan-300 hover:border-cyan-400 cursor-pointer">
            {name}
          </button>
        ))}
        <button type="button" onClick={() => { setOpen(true); searchInputRef?.current?.focus(); }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-cyan-700 text-cyan-200 hover:border-cyan-400 cursor-pointer">
          <Compass className="w-3.5 h-3.5" aria-hidden="true" /> Browse catalogue
        </button>
      </div>

      <CatalogBrowser
        snapshot={snapshot}
        liveItems={liveItems}
        loading={loading}
        error={error}
        selectedPlanetName={selectedPlanetName}
        onPickPlanet={choose}
      />
    </section>
  );
};
