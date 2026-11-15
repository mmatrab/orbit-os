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
    className="mb-4 px-5 py-4 rounded border border-slate-800 bg-[#161e2c]"
    aria-labelledby="intro-title"
  >
    <h1 id="intro-title" className="text-xl sm:text-2xl font-semibold text-slate-50">
      Explore worlds beyond our Solar System
    </h1>
    <p className="mt-1.5 text-sm text-slate-300 max-w-3xl">
      Every planet here is a confirmed exoplanet from the{' '}
      <a
        href="https://exoplanetarchive.ipac.caltech.edu/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan-300 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-200"
      >
        NASA Exoplanet Archive
      </a>
      , fetched live, with the paper behind every number. Search a planet, then explore its star in real sky images.
    </p>

    <div className="mt-3 relative max-w-2xl">
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
        className="w-full pl-10 pr-10 py-3 text-base bg-[#0e1420] border border-slate-600 rounded text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
      />
      <kbd
        className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 rounded border border-slate-700 text-[11px] text-slate-500 font-mono"
        title="Press / anywhere to jump to the search"
      >
        /
      </kbd>
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
      <span>Try a real planet:</span>
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
    </div>
  </section>
);
