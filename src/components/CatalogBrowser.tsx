import { useMemo, useState } from 'react';
import { ChevronDown, Compass, Shuffle } from 'lucide-react';
import type { ExoplanetSearchItem } from '../api/contracts';
import type { PlanetSnapshot } from '../stories/planetSnapshot';
import { LIGHT_YEARS_PER_PARSEC, methodGroup } from '../stories/planetSnapshot';
import { buildDiscoveryPicks, type DiscoveryPick } from '../utils/discoveryPicks';

type BrowseCategory = 'nearby' | 'small' | 'systems' | 'all';
const CATEGORIES: { key: BrowseCategory; label: string; description: string }[] = [
  { key: 'nearby', label: 'Nearby', description: 'Nearby confirmed exoplanets, one per host star.' },
  { key: 'small', label: 'Earth-sized', description: 'Planets with a reported measured radius of 0.8–1.25 Earth radii; this says nothing about habitability.' },
  { key: 'systems', label: 'Planet families', description: 'Stars hosting at least three confirmed planets.' },
  { key: 'all', label: 'All planets', description: 'Browse the full dated NASA catalogue alphabetically. Use search above to find a specific name.' },
];

const INITIAL_VISIBLE = 6;
const MORE_STEP = 6;

function formatDistance(parsecs: number | null): string {
  if (parsecs === null || !Number.isFinite(parsecs) || parsecs <= 0) return 'Distance not reported';
  return `${Number((parsecs * LIGHT_YEARS_PER_PARSEC).toPrecision(3)).toLocaleString('en-US')} light-years`;
}

function livePicks(items: readonly ExoplanetSearchItem[]): DiscoveryPick[] {
  return items.map((p) => ({
    planetName: p.planetName,
    title: p.planetName,
    description: `${p.discoveryMethod || 'Method not reported'} · ${p.hostname}`,
    distancePc: p.distancePc,
  }));
}

/** All choices come from a real dated archive snapshot, or the current live NASA API page. */
function browsePicks(snapshot: PlanetSnapshot | null, liveItems: readonly ExoplanetSearchItem[], category: BrowseCategory): DiscoveryPick[] {
  if (!snapshot) return livePicks(liveItems);
  const planets = snapshot.planets;
  if (category === 'nearby') return buildDiscoveryPicks(planets, 'nearby', 120);
  if (category === 'small') return buildDiscoveryPicks(planets, 'earth-size', 120);
  if (category === 'systems') return buildDiscoveryPicks(planets, 'families', 120);
  return [...planets]
    .filter((p) => p.planetName && p.hostname)
    .sort((a, b) => a.planetName.localeCompare(b.planetName))
    .map((p) => ({
      planetName: p.planetName,
      title: p.planetName,
      description: `${methodGroup(p.discoveryMethod)} · ${p.hostname}`,
      distancePc: p.distancePc,
    }));
}

interface CatalogBrowserProps {
  snapshot: PlanetSnapshot | null;
  liveItems: ExoplanetSearchItem[];
  loading: boolean;
  error: string | null;
  selectedPlanetName: string | null;
  onPickPlanet: (planetName: string) => void;
}

/**
 * Replaces the giant 50-item result list below the sky viewer with a compact
 * browsing experience beside the guided planet questions.
 */
export function CatalogBrowser({
  snapshot, liveItems, loading, error, selectedPlanetName, onPickPlanet,
}: CatalogBrowserProps) {
  const [open, setOpen] = useState(true);
  const [category, setCategory] = useState<BrowseCategory>('nearby');
  const [visible, setVisible] = useState(INITIAL_VISIBLE);

  const picks = useMemo(
    () => browsePicks(snapshot, liveItems, category),
    [snapshot, liveItems, category]
  );
  const categoryInfo = CATEGORIES.find((item) => item.key === category)!;

  const choose = (name: string) => onPickPlanet(name);
  const surprise = () => {
    if (picks.length === 0) return;
    const alternatives = picks.filter((p) => p.planetName !== selectedPlanetName);
    const pool = alternatives.length > 0 ? alternatives : picks;
    choose(pool[Math.floor(Math.random() * pool.length)].planetName);
  };

  return (
    <section className="mt-5 border-t border-slate-700/80 pt-4" aria-labelledby="browse-heading">
      <button type="button"
        className="flex w-full items-center justify-between gap-3 text-left cursor-pointer"
        aria-expanded={open} aria-controls="catalog-browse-panel"
        onClick={() => setOpen((prev) => !prev)}>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-50" id="browse-heading">
          <Compass className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          Explore the NASA planet catalog
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-cyan-300">
          {open ? 'Hide' : 'Browse'}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div id="catalog-browse-panel" className="mt-3">
          <p className="text-sm text-slate-300 leading-5">
            No planet name needed. Pick a category, then select any planet to update the exploration.
          </p>
          <div role="group" aria-label="Discovery categories" className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <button key={item.key} type="button"
                disabled={!snapshot && item.key !== 'nearby'}
                title={!snapshot && item.key !== 'nearby' ? 'Available after the dated NASA snapshot loads' : undefined}
                aria-pressed={category === item.key}
                onClick={() => { setCategory(item.key); setVisible(INITIAL_VISIBLE); }}
                className={`rounded-full border px-3 py-2 text-xs font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                  category === item.key
                    ? 'border-cyan-400 bg-cyan-400/10 text-cyan-100'
                    : 'border-slate-600 text-slate-300 hover:border-cyan-500 hover:text-slate-100'
                } ${!snapshot && item.key !== 'nearby' ? 'opacity-45 cursor-not-allowed' : ''}`}>
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {snapshot ? categoryInfo.description :
              'Showing the current live NASA results. Additional categories become available once the dated archive snapshot loads.'}
          </p>

          {picks.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Planet suggestions">
              {picks.slice(0, visible).map((pick) => {
                const active = selectedPlanetName === pick.planetName;
                return (
                  <button type="button" key={pick.planetName}
                    aria-pressed={active}
                    onClick={() => choose(pick.planetName)}
                    className={`min-w-0 rounded-lg border px-3 py-3 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                      active
                        ? 'border-cyan-400 bg-cyan-950/30'
                        : 'border-slate-600 bg-[#101a2a] hover:border-cyan-400 hover:bg-[#173148]'
                    }`}>
                    <span className="block truncate text-sm font-semibold text-slate-100">
                      {pick.title}{active ? ' · Selected' : ''}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-300">{pick.description}</span>
                    <span className="mt-1 block text-xs text-cyan-200">{formatDistance(pick.distancePc)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 rounded border border-slate-700 p-3 text-sm text-slate-300" role="status">
              {loading ? 'Loading the NASA catalogue…' :
                error && !snapshot ? `NASA search unavailable: ${error}` :
                  'No planets available for this category. Try another category or the search field above.'}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-400">
              {snapshot
                ? `NASA Exoplanet Archive · pscomppars · ${snapshot.retrievedAtUtc.slice(0, 10)}`
                : 'Current live NASA search results'}
            </span>
            <div className="flex flex-wrap gap-2">
              {visible < picks.length && (
                <button type="button" className="sky-btn" onClick={() => setVisible((n) => Math.min(n + MORE_STEP, picks.length))}>
                  Show more ({Math.min(visible, picks.length)} of {picks.length})
                </button>
              )}
              <button type="button" className="sky-btn" onClick={surprise} disabled={picks.length === 0}>
                <Shuffle className="h-3.5 w-3.5" aria-hidden="true" /> Surprise me
              </button>
            </div>
          </div>
          {selectedPlanetName && (
            <p className="mt-2 text-xs font-medium text-cyan-200" role="status">
              Currently exploring: {selectedPlanetName}. Its guided questions are beside this panel; its real sky image is below.
            </p>
          )}
          <p className="mt-1 text-[11px] leading-4 text-slate-400">
            Choices are organized from NASA catalogue records, not NASA-endorsed recommendations or habitability rankings.
          </p>
        </div>
      )}
    </section>
  );
}
