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
import { ExoplanetDetailPanel, type PlanetTab } from './components/ExoplanetDetailPanel';
import { HeaderBar, WorkspaceTab } from './components/HeaderBar';
import { IntroSearch } from './components/IntroSearch';
import { ProvenancePanel } from './components/ProvenancePanel';
import { ResearchNotebookPanel } from './components/ResearchNotebookPanel';
import { SkyViewerPanel } from './components/SkyViewerPanel';
import { SpaceStage } from './components/SpaceStage';
import { FindAWorld } from './components/FindAWorld';
import { SnapshotWorldGuide, SnapshotOverview } from './components/SnapshotWorldGuide';
import { StoryCharts } from './components/StoryCharts';
import { ScienceLearnPage } from './components/ScienceLearnPage';
import { SystemViewer3D } from './components/SystemViewer3D';
import { BRIDGE_VERSION, onHostSelectTarget, postToHost, readLaunchOptions } from './embed/bridge';
import { pickExample } from './utils/examplePick';
import { useSnapshot } from './stories/useSnapshot';
import { startsOnLearnPage, workspaceHref } from './utils/workspaceNavigation';

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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    () => startsOnLearnPage(window.location.search) ? 'learn' : 'explorer'
  );

  const navigateTab = useCallback((tab: WorkspaceTab) => {
    setActiveTab(tab);
    const next = workspaceHref(window.location.href, tab);
    if (window.location.pathname + window.location.search + window.location.hash !== next) {
      window.history.pushState(null, '', next);
    }
    if (tab === 'learn' || tab === 'explorer') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    const onNavigation = () => {
      setActiveTab(startsOnLearnPage(window.location.search) ? 'learn' : 'explorer');
    };
    window.addEventListener('popstate', onNavigation);
    return () => window.removeEventListener('popstate', onNavigation);
  }, []);
  const [planetTab, setPlanetTab] = useState<PlanetTab>('overview');

  // The sky canvas measured 0×0 while hidden; let Aladin re-measure when it is shown again.
  useEffect(() => {
    if (planetTab === 'overview' && activeTab === 'explorer') {
      window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
  }, [planetTab, activeTab]);
  const launch = useMemo(() => readLaunchOptions(), []);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const snapshotState = useSnapshot();
  const discoverySnapshot = snapshotState.phase === 'ready' ? snapshotState.snapshot : null;

  const openMainSearch = () => {
    navigateTab('explorer');
    window.requestAnimationFrame(() => {
      searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      searchInputRef.current?.focus({ preventScroll: true });
    });
  };

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
  const currentTarget = selectedTarget?.id === selectedId ? selectedTarget : null;
  const snapshotPlanet = useMemo(
    () => discoverySnapshot?.planets.find((planet) => planet.planetName === selectedId) ?? null,
    [discoverySnapshot, selectedId]
  );
  const archiveLocation = useMemo(() => {
    if (!snapshotPlanet || !discoverySnapshot ||
        typeof snapshotPlanet.raDeg !== 'number' || !Number.isFinite(snapshotPlanet.raDeg) ||
        typeof snapshotPlanet.decDeg !== 'number' || !Number.isFinite(snapshotPlanet.decDeg) ||
        !snapshotPlanet.hostname) return null;
    return {
      planetName: snapshotPlanet.planetName,
      hostname: snapshotPlanet.hostname,
      raDeg: snapshotPlanet.raDeg,
      decDeg: snapshotPlanet.decDeg,
      snapshotDate: discoverySnapshot.retrievedAtUtc.slice(0, 10),
    };
  }, [snapshotPlanet, discoverySnapshot]);

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

  // A previous NASA query must never replace results for a newer search or filter set.
  const latestSearchRequest = useRef(0);

  const runSearch = useCallback(async () => {
    const requestNo = ++latestSearchRequest.current;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await client.searchTargets(searchParams);
      if (requestNo !== latestSearchRequest.current) return;
      setSearchItems(res.items);
      // Keep the current target (e.g. one opened by deep link) even when it is not in this result page.
      setSelectedId((prevSelected) => prevSelected ?? res.items[0]?.id ?? null);
    } catch (err) {
      if (requestNo !== latestSearchRequest.current) return;
      setSearchItems([]);
      setSearchError(err instanceof Error ? err.message : 'Failed to search catalog.');
    } finally {
      if (requestNo === latestSearchRequest.current) setSearchLoading(false);
    }
  }, [client, searchParams]);

  useEffect(() => {
    // Invalidate in-flight requests immediately, even before the debounce timer fires.
    latestSearchRequest.current += 1;
    const timer = window.setTimeout(runSearch, 200);
    return () => {
      window.clearTimeout(timer);
      latestSearchRequest.current += 1;
    };
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
    <div className="min-h-screen flex flex-col bg-[#0e1420] text-[#E6EDF3]">
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
        onSelectTab={navigateTab}
        onOpenSearch={openMainSearch}
      />

      <main id="main-workspace" className="flex-1 w-full max-w-[1400px] mx-auto p-4 lg:p-6">
        {activeTab === 'explorer' && (
          <>
          <div className="relative mb-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-4">
            <div className="relative z-20 min-w-0">
            <IntroSearch
              query={searchParams.q ?? ''}
              searchInputRef={searchInputRef}
              onQueryChange={(q) => setSearchParams((prev) => ({ ...prev, q }))}
              onPickExample={(name) => {
                const next = pickExample(searchParams, name);
                setSearchParams({ ...next.params, discoveryMethod: 'ALL', requireRadius: false, requireMass: false });
                setSelectedId(next.selectedId);
              }}
              discoveryMethod={searchParams.discoveryMethod ?? 'ALL'}
              onDiscoveryMethodChange={(method) =>
                setSearchParams((prev) => ({ ...prev, discoveryMethod: method }))
              }
              snapshot={discoverySnapshot}
              liveItems={searchItems}
              loading={searchLoading || snapshotState.phase === 'loading'}
              error={searchError}
              selectedPlanetName={selectedId}
            />
            </div>
            <div className="relative z-10 min-w-0">
            {currentTarget ? (
              <FindAWorld
                key={currentTarget.id}
                target={currentTarget}
                onExploreSky={() => document.getElementById('sky-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              />
            ) : (
              <SnapshotWorldGuide
                key={selectedId ?? 'none'}
                planet={snapshotPlanet}
                planetName={selectedId}
                snapshotDate={discoverySnapshot?.retrievedAtUtc.slice(0, 10) ?? null}
                loading={detailLoading || snapshotState.phase === 'loading'}
                error={detailError}
                onRetry={loadSelectedTarget}
              />
            )}
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] gap-4 items-start">
            {/* Sky imagery and 3D system view. Planet discovery now lives beside the hero search. */}
            <div className="flex flex-col gap-4 min-w-0">
              <div id="sky-stage">
                <SpaceStage
                  sky={<SkyViewerPanel target={currentTarget} archiveLocation={archiveLocation} />}
                  system={currentTarget ? <SystemViewer3D target={currentTarget} /> : null}
                />
              </div>

            </div>

            {/* Right: the numbers for the selected planet, kept in view while scrolling. */}
            <div className="flex flex-col gap-4 min-w-0 xl:sticky xl:top-4">
              {currentTarget || !snapshotPlanet ? (
                <ExoplanetDetailPanel
                  mode={mode}
                  target={currentTarget}
                  loading={detailLoading}
                  error={detailError}
                  onPinToNotebook={pinToNotebook}
                  onRetry={loadSelectedTarget}
                  onOpenExport={() => setExportOpen(true)}
                  planetTab={planetTab}
                  onPlanetTabChange={setPlanetTab}
                />
              ) : (
                <SnapshotOverview
                  planet={snapshotPlanet}
                  snapshotDate={discoverySnapshot?.retrievedAtUtc.slice(0, 10) ?? null}
                  error={detailError}
                  loading={detailLoading}
                  onRetry={loadSelectedTarget}
                />
              )}
            </div>
          </div>

          <StoryCharts onLearnScience={() => navigateTab('learn')} />

          {planetTab === 'data' && (
            <div className="mt-4">
              <ExoplanetDetailPanel
                view="advanced"
                mode={mode}
                target={selectedTarget}
                loading={detailLoading}
                error={detailError}
                onPinToNotebook={pinToNotebook}
                onRetry={loadSelectedTarget}
              />
            </div>
          )}
          </>
        )}

        {activeTab === 'learn' && (
          <ScienceLearnPage onBack={() => {
            navigateTab('explorer');
            window.requestAnimationFrame(() =>
              document.getElementById('story-charts-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            );
          }} />
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
