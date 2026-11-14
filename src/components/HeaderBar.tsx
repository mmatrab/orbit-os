import React from 'react';
import { Download } from 'lucide-react';
import { DataSourceMode, ExoplanetDetail, HealthResponse } from '../api/contracts';
import { formatDecDms, formatRaHms } from '../utils/coordinates';

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
  onOpenExport: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeTab,
  notebookCount,
  sourcesCount,
  mode,
  health,
  healthError,
  selectedTarget,
  onSelectTab,
  onOpenExport,
}) => {
  return (
    <div className="border-b border-slate-800 bg-[#0B0F17]">
      {/* Strict 3-Zone Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-x-8 px-4 lg:px-6 min-h-14 border-b border-slate-800/80">
        {/* Zone 1: Single-element Brand Wordmark */}
        <span className="text-base font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
          ORBIT OS
        </span>

        {/* Zone 2: Clean Typography Navigation Links */}
        <nav
          className="order-3 w-full sm:order-none sm:w-auto flex items-center gap-5 sm:gap-6 overflow-x-auto"
          role="tablist"
          aria-label="ORBIT OS workspaces"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'explorer'}
            onClick={() => onSelectTab('explorer')}
            className={`py-4 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'explorer'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            Sky Explorer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'notebook'}
            onClick={() => onSelectTab('notebook')}
            className={`py-4 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'notebook'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            Research Notebook ({notebookCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'provenance'}
            onClick={() => onSelectTab('provenance')}
            className={`py-4 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'provenance'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            Data Provenance ({sourcesCount})
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0 py-2 sm:py-0">
          <button
            type="button"
            disabled={!selectedTarget}
            onClick={onOpenExport}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export data</span>
          </button>
        </div>
      </header>

      {/* Top Telemetry & Mode Ribbon */}
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 lg:px-6 py-2 text-xs bg-emerald-950/25 text-emerald-200 border-b border-emerald-500/20"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-emerald-300 whitespace-nowrap">
            ● Live NASA Exoplanet Archive (TAP, {mode})
            {health ? ` · API ${health.status}` : ''}
          </span>

          {healthError ? (
            <span className="text-rose-300">API connection warning: {healthError}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {selectedTarget && (
            <div
              className="hidden md:flex items-center gap-2 font-mono tabular-nums text-[11px] text-slate-300"
              aria-label="Active target astrometry summary"
            >
              <span className="text-slate-100 font-medium">{selectedTarget.planetName}</span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span>
                ICRS {formatRaHms(selectedTarget.hostStar.raDeg)}{' '}
                {formatDecDms(selectedTarget.hostStar.decDeg)}
              </span>
              {selectedTarget.hostStar.spectralType && (
                <>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span>SpT {selectedTarget.hostStar.spectralType}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
