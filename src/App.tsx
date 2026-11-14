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
import { ProvenancePanel } from './components/ProvenancePanel';
import { ResearchNotebookPanel } from './components/ResearchNotebookPanel';
import { SkyViewerPanel } from './components/SkyViewerPanel';
import { TargetSearchPanel } from './components/TargetSearchPanel';

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
  const [mode, setMode] = useState<DataSourceMode>('live');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('explorer');

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const client = useMemo(() => new OrbitApiClient({ mode }), [mode]);

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

  const [selectedId, setSelectedId] = useState<string | null>('TRAPPIST-1 e');
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
      setSelectedId((prevSelected) => {
        if (res.items.length === 0) return prevSelected;
        if (prevSelected && res.items.some((i) => i.id === prevSelected)) {
          return prevSelected;
        }
        return res.items[0].id;
      });
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

  const loadSelectedTarget = useCallback(async () => {
    if (!selectedId) {
      setSelectedTarget(null);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await client.getExoplanetDetail(selectedId);
      setSelectedTarget(detail);
    } catch (err) {
      setSelectedTarget(null);
      setDetailError(err instanceof Error ? err.message : 'Failed to fetch target parameters.');
    } finally {
      setDetailLoading(false);
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

  // Sync notebook entries when live backend is active
  useEffect(() => {
    if (mode !== 'live') return;
    client
      .listNotebookEntries()
      .then((serverEntries) => setNotebookEntries(serverEntries))
      .catch(() => {
        // Keep local entries intact if backend notebook endpoint is unavailable
      });
  }, [client, mode]);

  const handleChangeMode = (nextMode: DataSourceMode) => {
    setMode(nextMode);
    if (nextMode === 'reference_fixture') {
      setSelectedId('trappist-1-e');
    } else {
      setSelectedId('TRAPPIST-1 e');
    }
  };

  const handleCreateNotebookEntry = async (req: CreateNotebookEntryRequest) => {
    if (mode === 'live') {
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
      syncState: mode === 'live' ? 'sync_error' : 'local_only',
    };
    setNotebookEntries((prev) => [localEntry, ...prev]);
  };

  const handleUpdateNotebookEntry = async (id: string, req: UpdateNotebookEntryRequest) => {
    if (mode === 'live') {
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
              syncState: mode === 'live' ? 'sync_error' : 'local_only',
            }
          : e
      )
    );
  };

  const handleDeleteNotebookEntry = async (id: string) => {
    if (mode === 'live') {
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
        onChangeMode={handleChangeMode}
        onOpenExport={() => setExportOpen(true)}
      />

      <main id="main-workspace" className="flex-1 p-4 lg:p-6">
        {activeTab === 'explorer' && (
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] xl:grid-cols-[340px_minmax(420px,1.25fr)_minmax(360px,1fr)] gap-4 items-start">
            <TargetSearchPanel
              mode={mode}
              params={searchParams}
              items={searchItems}
              totalCount={searchTotal}
              selectedId={selectedId}
              loading={searchLoading}
              error={searchError}
              searchInputRef={searchInputRef}
              onParamsChange={setSearchParams}
              onSelectTarget={(id) => setSelectedId(id)}
              onRetry={runSearch}
              onSwitchToFixture={() => handleChangeMode('reference_fixture')}
            />

            <SkyViewerPanel target={selectedTarget} />

            <div className="md:col-span-2 xl:col-span-1">
              <ExoplanetDetailPanel
                mode={mode}
                target={selectedTarget}
                loading={detailLoading}
                error={detailError}
                onPinToNotebook={(snapshot) => {
                  setPendingSnapshot(snapshot);
                  setActiveTab('notebook');
                }}
                onRetry={loadSelectedTarget}
                onSwitchToFixture={() => handleChangeMode('reference_fixture')}
              />
            </div>
          </div>
        )}

        {activeTab === 'notebook' && (
          <div className="max-w-6xl mx-auto">
            <ResearchNotebookPanel
              mode={mode}
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
        onSubmitServerExport={async (format, entryIds) => {
          if (!selectedTarget) return null;
          try {
            const resp = await client.submitExportRecord({
              targetId: selectedTarget.id,
              format,
              generatedAtUtc: new Date().toISOString(),
              includedNotebookEntryIds: entryIds,
            });
            return resp.exportId;
          } catch {
            return null;
          }
        }}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}

export default App;
