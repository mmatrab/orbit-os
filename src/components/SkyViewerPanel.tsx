import React, { useEffect, useRef, useState } from 'react';
import type { AladinCatalog, AladinInstance, AladinLiteModule } from 'aladin-lite';

// Aladin Lite (LGPL-3.0) is loaded on demand as its own unmodified chunk: smaller initial
// bundle, and the library stays separable from the application code.
let aladinModule: Promise<AladinLiteModule> | null = null;
function loadAladin(): Promise<AladinLiteModule> {
  aladinModule ??= import('aladin-lite').then((m) => m.default);
  return aladinModule;
}
import { Crosshair, RotateCw } from 'lucide-react';
import { ExoplanetDetail } from '../api/contracts';
import { formatDecDms, formatDeg, formatRaHms } from '../utils/coordinates';

interface SkyViewerPanelProps {
  target: ExoplanetDetail | null;
}

const HIPS_SURVEYS = [
  { id: 'P/DSS2/color', label: 'DSS2 Color (Optical)' },
  { id: 'P/2MASS/color', label: '2MASS Color (Near-IR)' },
  { id: 'P/allWISE/color', label: 'AllWISE Color (Mid-IR)' },
  { id: 'P/DSS2/red', label: 'DSS2 Red (Optical)' },
];

const FOV_PRESETS_DEG = [0.05, 0.25, 1.0, 5.0];

export const SkyViewerPanel: React.FC<SkyViewerPanelProps> = ({ target }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const aladinRef = useRef<AladinInstance | null>(null);
  const catalogRef = useRef<AladinCatalog | null>(null);
  const libRef = useRef<AladinLiteModule | null>(null);
  const mountedSurveyRef = useRef<string>(HIPS_SURVEYS[0].id);

  const [viewerStatus, setViewerStatus] = useState<'initializing' | 'ready' | 'error'>(
    'initializing'
  );
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [surveyWarning, setSurveyWarning] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);

  const [surveyId, setSurveyId] = useState<string>(HIPS_SURVEYS[0].id);
  const [cooFrame, setCooFrame] = useState<'ICRSd' | 'galactic'>('ICRSd');
  const [projection, setProjection] = useState<'SIN' | 'AIT' | 'MOL'>('SIN');
  const [fovDeg, setFovDeg] = useState<number>(0.25);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showReticle, setShowReticle] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    const hostEl = hostRef.current;

    const initViewer = async () => {
      if (!hostEl) return;
      try {
        setViewerStatus('initializing');
        setViewerError(null);
        setSurveyWarning(null);
        const A = await loadAladin();
        await A.init;
        libRef.current = A;
        if (cancelled || !hostEl) return;

        hostEl.innerHTML = '';

        const instance = A.aladin(hostEl, {
          survey: surveyId,
          fov: fovDeg,
          projection,
          cooFrame,
          showReticle,
          showCooGrid: showGrid,
          showZoomControl: true,
          showFullscreenControl: true,
          showLayersControl: true,
          showGotoControl: false,
          showFrame: true,
          showCooGridControl: false,
        });

        mountedSurveyRef.current = surveyId;

        const overlay = A.catalog({
          name: 'ORBIT OS Active Target',
          sourceSize: 16,
          color: '#22d3ee',
          shape: 'cross',
        });
        instance.addCatalog(overlay);

        aladinRef.current = instance;
        catalogRef.current = overlay;
        setViewerStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setViewerStatus('error');
          setViewerError(
            err instanceof Error
              ? err.message
              : typeof err === 'string'
              ? err
              : 'Failed to initialize Aladin Lite WebGL2 sky renderer.'
          );
        }
      }
    };

    initViewer();

    return () => {
      cancelled = true;
      aladinRef.current = null;
      catalogRef.current = null;
      if (hostEl) {
        hostEl.innerHTML = '';
      }
    };
    // Mount once per initAttempt; incremental updates handled in separate effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initAttempt]);

  // Sync active target RA/Dec and catalog marker
  useEffect(() => {
    const aladin = aladinRef.current;
    const catalog = catalogRef.current;
    if (!aladin || viewerStatus !== 'ready' || !target) return;

    const { raDeg, decDeg, hostname, spectralType } = target.hostStar;
    // Never point the viewer at an invented position when the archive has no coordinates.
    if (raDeg === null || decDeg === null) return;
    try {
      aladin.gotoRaDec(raDeg, decDeg);
      aladin.setFoV(fovDeg);

      if (catalog) {
        if (typeof catalog.clear === 'function') {
          catalog.clear();
        } else if (typeof catalog.removeAll === 'function') {
          catalog.removeAll();
        }
        catalog.addSources([
          libRef.current!.source(raDeg, decDeg, {
            name: hostname,
            planet: target.planetName,
            spectralType: spectralType ?? 'Unknown',
          }),
        ]);
      }
    } catch {
      // Guard against transient render-loop timing
    }
  }, [target, viewerStatus, fovDeg]);

  // Sync survey changes without triggering duplicate mount fetches
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || viewerStatus !== 'ready') return;
    if (mountedSurveyRef.current === surveyId) return;

    mountedSurveyRef.current = surveyId;
    setSurveyWarning(null);
    Promise.resolve(aladin.setBaseImageLayer(surveyId)).catch((err) => {
      setSurveyWarning(
        err instanceof Error
          ? `HiPS survey load error (${surveyId}): ${err.message}`
          : `Unable to load HiPS survey "${surveyId}".`
      );
    });
  }, [surveyId, viewerStatus]);

  // Sync projection, coordinate frame, grid, and reticle
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || viewerStatus !== 'ready') return;
    try {
      aladin.setProjection(projection);
      aladin.setFrame(cooFrame);
      if (showGrid) {
        aladin.showCooGrid();
      } else {
        aladin.hideCooGrid();
      }
      aladin.showReticle(showReticle);
    } catch {
      // Guard against transient layer transitions
    }
  }, [projection, cooFrame, showGrid, showReticle, viewerStatus]);

  const handleRecenter = () => {
    if (!aladinRef.current || !target) return;
    if (target.hostStar.raDeg === null || target.hostStar.decDeg === null) return;
    aladinRef.current.gotoRaDec(target.hostStar.raDeg, target.hostStar.decDeg);
    aladinRef.current.setFoV(fovDeg);
  };

  return (
    <section
      className="bg-[#0F151E] border border-slate-800 rounded flex flex-col"
      aria-labelledby="sky-viewer-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-[#121A25]">
        <h2 id="sky-viewer-title" className="text-xs font-semibold tracking-wide text-slate-100">
          Interactive Sky Viewer — Aladin Lite v3 (HiPS)
        </h2>
        {target ? (
          <span className="font-mono tabular-nums text-[11px] text-cyan-300">
            {formatRaHms(target.hostStar.raDeg)} / {formatDecDms(target.hostStar.decDeg)}
          </span>
        ) : (
          <span className="text-[11px] text-slate-500">No target centered</span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* Viewer Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-1.5 text-slate-300">
            <span>Survey</span>
            <select
              value={surveyId}
              onChange={(e) => setSurveyId(e.target.value)}
              className="px-2 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              {HIPS_SURVEYS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-300">
            <span>Frame</span>
            <select
              value={cooFrame}
              onChange={(e) => setCooFrame(e.target.value as 'ICRSd' | 'galactic')}
              className="px-2 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              <option value="ICRSd">ICRS (J2000)</option>
              <option value="galactic">Galactic</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-1.5 text-slate-300">
            <span>Proj</span>
            <select
              value={projection}
              onChange={(e) => setProjection(e.target.value as 'SIN' | 'AIT' | 'MOL')}
              className="px-2 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              <option value="SIN">SIN (Orthographic)</option>
              <option value="AIT">AIT (Aitoff)</option>
              <option value="MOL">MOL (Mollweide)</option>
            </select>
          </label>

          <div className="inline-flex items-center gap-1 bg-[#07090E] border border-slate-800 rounded p-0.5">
            <span className="px-1.5 text-[11px] text-slate-400">FOV</span>
            {FOV_PRESETS_DEG.map((deg) => (
              <button
                key={deg}
                type="button"
                aria-pressed={fovDeg === deg}
                onClick={() => {
                  setFovDeg(deg);
                  aladinRef.current?.setFoV(deg);
                }}
                className={`px-2 py-1 text-[11px] font-mono tabular-nums rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  fovDeg === deg
                    ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {deg}°
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-slate-300">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="accent-cyan-400"
              />
              <span>Grid</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showReticle}
                onChange={(e) => setShowReticle(e.target.checked)}
                className="accent-cyan-400"
              />
              <span>Reticle</span>
            </label>
          </div>

          <button
            type="button"
            disabled={!target || viewerStatus !== 'ready'}
            onClick={handleRecenter}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-700 bg-[#07090E] text-slate-200 hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-auto"
          >
            <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Recenter</span>
          </button>
        </div>

        {surveyWarning && (
          <div
            className="px-3 py-2 rounded border border-amber-500/40 bg-amber-950/30 text-amber-200 text-xs"
            role="status"
          >
            {surveyWarning}
          </div>
        )}

        {/* Sky Canvas or Graceful Error Fallback */}
        {viewerStatus === 'error' ? (
          <div
            className="p-6 rounded border border-rose-500/40 bg-rose-950/25 text-rose-200 text-xs flex flex-col gap-3"
            role="alert"
          >
            <div>
              <strong className="block text-rose-100 mb-1">Sky Viewer Unavailable</strong>
              <span>
                {viewerError}. Verify WebGL2 browser support and network reachability to IVOA HiPS
                tile servers.
              </span>
            </div>
            {target && (
              <div className="font-mono tabular-nums text-[11px] text-slate-300">
                Target coordinates: {target.hostStar.hostname} ({formatDeg(target.hostStar.raDeg)},{' '}
                {formatDeg(target.hostStar.decDeg)})
              </div>
            )}
            <div>
              <button
                type="button"
                onClick={() => setInitAttempt((n) => n + 1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-rose-400/50 hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3 h-3" aria-hidden="true" />
                <span>Reinitialize Sky Renderer</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative rounded border border-slate-800 overflow-hidden">
            <div
              ref={hostRef}
              className="aladin-viewport-host cursor-crosshair"
              role="application"
              aria-label={
                target
                  ? `Aladin Lite sky map centered on ${target.hostStar.hostname}`
                  : 'Aladin Lite sky map'
              }
            />
            {viewerStatus === 'initializing' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#04060A]/85 text-xs text-slate-300">
                Initializing Aladin Lite WebGL2 / WASM sky renderer…
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="font-mono tabular-nums">
            {target
              ? `Center: ${target.hostStar.hostname} (${formatDeg(
                  target.hostStar.raDeg
                )}, ${formatDeg(target.hostStar.decDeg)})`
              : 'Center: None selected'}
          </span>
          <span>Powered by CDS Aladin Lite v3 (IVOA HiPS)</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          The marker is the host star&apos;s catalogue position from the archive. The planet itself is
          not visible in survey images, and images taken at older epochs can show high-proper-motion
          stars offset from the marker.
        </p>
      </div>
    </section>
  );
};
