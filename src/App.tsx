import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrbitApiClient } from './api/client';
import {
  CreateNotebookEntryRequest,
  DataSourceMode,
  DataSourceStatus,
  ExoplanetDetail,
  ExoplanetSearchItem,
  HealthResponse,
  NotebookEntry,
  ParameterSnapshot,
  SearchTargetsParams,
  UpdateNotebookEntryRequest,
} from './api/contracts';
import { EvidenceExportModal } from './components/EvidenceExportModal';
import { ExoplanetDetailPanel } from './components/ExoplanetDetailPanel';
import { HeaderBar, WorkspaceTab } from './components/HeaderBar';
import { IntroSearch } from './components/IntroSearch';
import { ProvenancePanel } from './components/ProvenancePanel';
import { ResearchNotebookPanel } from './components/ResearchNotebookPanel';
import { SkyViewerPanel } from './components/SkyViewerPanel';
import { TargetSearchPanel } from './components/TargetSearchPanel';
import { BRIDGE_VERSION, onHostSelectTarget, postToHost, readLaunchOptions } from './embed/bridge';
import { pickExample } from './utils/examplePick';
import { snapshotOf } from './utils/snapshot';

const DEFAULT_TARGET = 'TRAPPIST-1 e';

const LOCAL_NOTEBOOK_KEY = 'orbit_os_notebook_entries_v1';

function loadLocalNotebook(): NotebookEntry[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_NOTEBOOK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as NotebookEntry[]) : [];
  } catch {
    return [];
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function App() {
  const mode: DataSourceMode = 'live';
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('explorer');
  const launch = useMemo(() => readLaunchOptions(), []);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const client = useMemo(() => new OrbitApiClient(), []);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useState<SearchTargetsParams>({
    q: '',
    discoveryMethod: 'ALL',
    requireRadius: false,
    requireMass: false,
    limit: 50,
  });
  const [searchItems, setSearchItems] = useState<ExoplanetSearchItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(launch.initialTarget ?? DEFAULT_TARGET);
  const [selectedTarget, setSelectedTarget] = useState<ExoplanetDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const [notebookEntries, setNotebookEntries] = useState<NotebookEntry[]>(loadLocalNotebook);
  const [pendingSnapshot, setPendingSnapshot] = useState<ParameterSnapshot | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Global `/` shortcut to focus search input when on Explorer tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        activeTab === 'explorer' &&
        !exportOpen &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, exportOpen]);

  // Persist local notebook fallback
  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_NOTEBOOK_KEY, JSON.stringify(notebookEntries));
    } catch {
      // Storage quota guard
    }
  }, [notebookEntries]);

  // Health check when in live mode
  useEffect(() => {
    if (mode !== 'live') {
      setHealth(null);
      setHealthError(null);
      return;
    }
    let cancelled = false;
    client
      .checkHealth()
      .then((res) => {
        if (!cancelled) {
          setHealth(res);
          setHealthError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHealth(null);
          setHealthError(err instanceof Error ? err.message : 'Health check failed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, mode]);

  const runSearch = useCallback(async () => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await client.searchTargets(searchParams);
      setSearchItems(res.items);
      setSearchTotal(res.totalCount);
      // Keep the current target (e.g. one opened by deep link) even when it is not in this result page.
      setSelectedId((prevSelected) => prevSelected ?? res.items[0]?.id ?? null);
    } catch (err) {
      setSearchItems([]);
      setSearchTotal(0);
      setSearchError(err instanceof Error ? err.message : 'Failed to search catalog.');
    } finally {
      setSearchLoading(false);
    }
  }, [client, searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(runSearch, 200);
    return () => window.clearTimeout(timer);
  }, [runSearch]);

  // Only the most recent selection may update the panel; a slow earlier response must not overwrite it.
  const latestDetailRequest = useRef(0);

  const loadSelectedTarget = useCallback(async () => {
    const requestNo = ++latestDetailRequest.current;
    if (!selectedId) {
      setSelectedTarget(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await client.getExoplanetDetail(selectedId);
      if (requestNo !== latestDetailRequest.current) return;
      setSelectedTarget(detail);
    } catch (err) {
      if (requestNo !== latestDetailRequest.current) return;
      setSelectedTarget(null);
      setDetailError(err instanceof Error ? err.message : 'Failed to fetch target parameters.');
    } finally {
      if (requestNo === latestDetailRequest.current) setDetailLoading(false);
    }
  }, [client, selectedId]);

  useEffect(() => {
    loadSelectedTarget();
  }, [loadSelectedTarget]);

  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      const res = await client.getSources();
      setSources(res.sources);
    } catch (err) {
      setSources([]);
      setSourcesError(err instanceof Error ? err.message : 'Failed to query source status.');
    } finally {
      setSourcesLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Notes stay in this browser unless the deployment explicitly enables the shared server notebook
  // (ORBIT_NOTEBOOK_MODE=server, intended only behind the host platform's authentication).
  const serverNotes = health?.notebookStorage === 'server';

  useEffect(() => {
    if (!serverNotes) return;
    client
      .listNotebookEntries()
      .then((serverEntries) => setNotebookEntries(serverEntries))
      .catch(() => {
        // Keep local entries intact if backend notebook endpoint is unavailable
      });
  }, [client, serverNotes]);

  // Embedding bridge: announce readiness, report selections, accept host commands.
  useEffect(() => {
    postToHost(launch.parentOrigin, 'ready', { version: BRIDGE_VERSION });
    return onHostSelectTarget(launch.parentOrigin, (planetName) => {
      setSelectedId(planetName);
      setActiveTab('explorer');
    });
  }, [launch.parentOrigin]);

  useEffect(() => {
    if (selectedTarget) {
      postToHost(launch.parentOrigin, 'target-selected', { planetName: selectedTarget.planetName });
    }
  }, [launch.parentOrigin, selectedTarget]);

  const pinToNotebook = (snapshot: ParameterSnapshot) => {
    setPendingSnapshot(snapshot);
    setActiveTab('notebook');
  };

  const handleCreateNotebookEntry = async (req: CreateNotebookEntryRequest) => {
    if (serverNotes) {
      try {
        const created = await client.createNotebookEntry(req);
        setNotebookEntries((prev) => [created, ...prev]);
        return;
      } catch {
        // Fall through to local_only with sync_error flag rather than losing researcher's note
      }
    }

    const now = new Date().toISOString();
    const localEntry: NotebookEntry = {
      id: makeId(),
      ...req,
      createdAtUtc: now,
      updatedAtUtc: now,
      syncState: serverNotes ? 'sync_error' : 'local_only',
    };
    setNotebookEntries((prev) => [localEntry, ...prev]);
  };

  const handleUpdateNotebookEntry = async (id: string, req: UpdateNotebookEntryRequest) => {
    if (serverNotes) {
      try {
        const updated = await client.updateNotebookEntry(id, req);
        setNotebookEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
        return;
      } catch {
        // Fall through to local update with sync_error marker
      }
    }

    const now = new Date().toISOString();
    setNotebookEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              ...req,
              updatedAtUtc: now,
              syncState: serverNotes ? 'sync_error' : 'local_only',
            }
          : e
      )
    );
  };

  const handleDeleteNotebookEntry = async (id: string) => {
    if (serverNotes) {
      await client.deleteNotebookEntry(id).catch(() => undefined);
    }
    setNotebookEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#07090E] text-[#E6EDF3]">
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded focus:bg-cyan-400 focus:text-slate-950 focus:font-semibold focus:text-xs"
      >
        Skip to workspace
      </a>

      <HeaderBar
        activeTab={activeTab}
        notebookCount={notebookEntries.length}
        sourcesCount={sources.length}
        mode={mode}
        health={health}
        healthError={healthError}
        selectedTarget={selectedTarget}
        onSelectTab={setActiveTab}
        onOpenExport={() => setExportOpen(true)}
      />

      <main id="main-workspace" className="flex-1 p-4 lg:p-6">
        {activeTab === 'explorer' && (
          <>
          <IntroSearch
            query={searchParams.q ?? ''}
            searchInputRef={searchInputRef}
            onQueryChange={(q) => setSearchParams((prev) => ({ ...prev, q }))}
            onPickExample={(name) => {
              const next = pickExample(searchParams, name);
              setSearchParams(next.params);
              setSelectedId(next.selectedId);
            }}
          />
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] gap-4 items-start">
            <div className="lg:sticky lg:top-4">
            <TargetSearchPanel
              mode={mode}
              params={searchParams}
              items={searchItems}
              totalCount={searchTotal}
              selectedId={selectedId}
              loading={searchLoading}
              error={searchError}
              onParamsChange={setSearchParams}
              onSelectTarget={(id) => setSelectedId(id)}
              onRetry={runSearch}
            />
            </div>

            <div className="flex flex-col gap-4 min-w-0">
              <ExoplanetDetailPanel
                mode={mode}
                target={selectedTarget}
                loading={detailLoading}
                error={detailError}
                onPinToNotebook={pinToNotebook}
                onRetry={loadSelectedTarget}
                onOpenExport={() => setExportOpen(true)}
              />

              <SkyViewerPanel target={selectedTarget} />

              <ExoplanetDetailPanel
                view="advanced"
                mode={mode}
                target={selectedTarget}
                loading={detailLoading}
                error={detailError}
                onPinToNotebook={pinToNotebook}
                onRetry={loadSelectedTarget}
              />

              {selectedTarget && (
                <section
                  className="p-4 rounded border border-slate-800 bg-[#0F151E] flex flex-wrap items-center gap-3 text-xs"
                  aria-label="Notes and export"
                >
                  <div className="flex-1 min-w-[14rem]">
                    <h2 className="text-sm font-semibold text-slate-100">Notes &amp; export</h2>
                    <p className="text-slate-400 mt-0.5">
                      {(() => {
                        const n = notebookEntries.filter((e) => e.targetId === selectedTarget.id).length;
                        const where = serverNotes ? 'in the shared notebook' : 'in this browser';
                        return n === 0
                          ? `No notes on ${selectedTarget.planetName} yet. Notes are saved ${where}.`
                          : `${n} note${n === 1 ? '' : 's'} on ${selectedTarget.planetName}, saved ${where}.`;
                      })()}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="sky-btn"
                    onClick={() => pinToNotebook(snapshotOf(selectedTarget))}
                  >
                    Write a note
                  </button>
                  <button type="button" className="sky-btn" onClick={() => setActiveTab('notebook')}>
                    Open notebook
                  </button>
                  <button type="button" className="sky-btn" onClick={() => setExportOpen(true)}>
                    Export data (JSON, CSV, Markdown)
                  </button>
                </section>
              )}
            </div>
          </div>
          </>
        )}

        {activeTab === 'notebook' && (
          <div className="max-w-6xl mx-auto">
            <ResearchNotebookPanel
              mode={mode}
              storage={serverNotes ? 'server' : 'browser'}
              activeTarget={selectedTarget}
              entries={notebookEntries}
              pendingSnapshot={pendingSnapshot}
              onClearPendingSnapshot={() => setPendingSnapshot(null)}
              onCreateEntry={handleCreateNotebookEntry}
              onUpdateEntry={handleUpdateNotebookEntry}
              onDeleteEntry={handleDeleteNotebookEntry}
            />
          </div>
        )}

        {activeTab === 'provenance' && (
          <div className="max-w-5xl mx-auto">
            <ProvenancePanel
              mode={mode}
              sources={sources}
              loading={sourcesLoading}
              error={sourcesError}
              activeTarget={selectedTarget}
              onRefresh={loadSources}
            />
          </div>
        )}
      </main>

      <EvidenceExportModal
        open={exportOpen}
        target={selectedTarget}
        mode={mode}
        notebookEntries={notebookEntries}
        sources={sources}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

export default App;
