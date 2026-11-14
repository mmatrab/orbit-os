import React from 'react';
import { Search } from 'lucide-react';

interface IntroSearchProps {
  query: string;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (q: string) => void;
  onPickExample: (planetName: string) => void;
}

/** Real planet names from the NASA Exoplanet Archive, offered as one-click starting points. */
const EXAMPLES = ['TRAPPIST-1 e', '51 Peg b', 'Proxima Cen b'];

/** First thing a visitor sees: what this is, and one obvious place to start. */
export const IntroSearch: React.FC<IntroSearchProps> = ({
  query,
  searchInputRef,
  onQueryChange,
  onPickExample,
}) => (
  <section
    className="mb-4 p-5 rounded border border-slate-800 bg-[#0F151E]"
    aria-labelledby="intro-title"
  >
    <h1 id="intro-title" className="text-lg font-semibold text-slate-100">
      Explore confirmed exoplanets
    </h1>
    <p className="mt-1 text-sm text-slate-400 max-w-3xl">
      Search NASA&apos;s catalogue of planets beyond our Solar System, see where their star sits in
      the sky, and check every number against the paper it comes from.
    </p>

    <div className="mt-4 relative max-w-2xl">
      <Search
        className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
      />
      <label htmlFor="target-query" className="sr-only">
        Search a planet or star
      </label>
      <input
        ref={searchInputRef}
        id="target-query"
        type="search"
        placeholder="Search a planet or star, e.g. TRAPPIST-1"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="w-full pl-10 pr-3 py-3 text-base bg-[#07090E] border border-slate-600 rounded text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
      />
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
      <span>Try:</span>
      {EXAMPLES.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onPickExample(name)}
          className="px-2.5 py-1 rounded border border-slate-700 text-cyan-300 hover:border-cyan-400 cursor-pointer"
        >
          {name}
        </button>
      ))}
      <span className="ml-auto font-mono text-[10px] text-slate-500">Shortcut: /</span>
    </div>
  </section>
);
