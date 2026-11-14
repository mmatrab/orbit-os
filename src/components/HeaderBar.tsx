import React from 'react';
import { DataSourceMode, ExoplanetDetail, HealthResponse } from '../api/contracts';

export type WorkspaceTab = 'explorer' | 'notebook' | 'provenance';

interface HeaderBarProps {
  activeTab: WorkspaceTab;
  notebookCount: number;
  sourcesCount: number;
  mode: DataSourceMode;
  health: HealthResponse | null;
  healthError: string | null;
  selectedTarget: ExoplanetDetail | null;
  onSelectTab: (tab: WorkspaceTab) => void;
}

const TABS: { id: WorkspaceTab; label: (n: { notes: number }) => string }[] = [
  { id: 'explorer', label: () => 'Explore' },
  { id: 'notebook', label: ({ notes }) => (notes ? `My notes (${notes})` : 'My notes') },
  { id: 'provenance', label: () => 'Data sources' },
];

/** One quiet bar: name, three places to go, and whether the live archive is reachable. */
export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeTab,
  notebookCount,
  health,
  healthError,
  onSelectTab,
}) => {
  const online = health?.status === 'ok' && !healthError;
  return (
    <header className="border-b border-slate-800 bg-[#0B0F17]">
      <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-x-8 px-4 lg:px-6 min-h-14">
        <span className="text-[15px] font-semibold tracking-tight text-slate-100 whitespace-nowrap py-3">
          ORBIT OS <span className="text-slate-500 font-normal">· Space Explorer</span>
        </span>

        <span
          className={`sm:order-last inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap ${
            healthError ? 'text-rose-300' : online ? 'text-emerald-300' : 'text-slate-400'
          }`}
          role="status"
          title={healthError ?? 'Data is fetched live from the NASA Exoplanet Archive'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${healthError ? 'bg-rose-400' : online ? 'bg-emerald-400' : 'bg-slate-500'}`}
            aria-hidden="true"
          />
          {healthError ? 'Service unreachable' : online ? 'Live NASA data' : 'Connecting…'}
        </span>

        <nav
          className="order-3 w-full sm:order-none sm:w-auto flex items-center gap-6 overflow-x-auto"
          role="tablist"
          aria-label="Space Explorer sections"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => onSelectTab(t.id)}
              className={`py-3.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? 'border-cyan-400 text-cyan-200'
                  : 'border-transparent text-slate-400 hover:text-slate-100'
              }`}
            >
              {t.label({ notes: notebookCount })}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
