import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AladinCatalog, AladinInstance, AladinLiteModule } from 'aladin-lite';
import { Crosshair, Download, ExternalLink, Maximize2, RotateCw, Image as ImageIcon } from 'lucide-react';
import { ExoplanetDetail } from '../api/contracts';
import { formatDecDms, formatDeg, formatRaHms } from '../utils/coordinates';
import {
  DEFAULT_SURVEY_ID,
  HIPS_SURVEYS,
  HipsUnavailableError,
  findSurvey,
  isHipsTileUrl,
  resolveHipsMirror,
  type ResolvedHips,
} from '../sky/hips';
import {
  aladinPermalink,
  buildSkyViewMetadata,
  skyFileStem,
  skyFooterLines,
} from '../sky/skySnapshot';
import { triggerTextDownload } from '../utils/exportBundle';

// Aladin Lite (LGPL-3.0) is loaded on demand as its own unmodified chunk: smaller initial
// bundle, and the library stays separable from the application code.
let aladinModule: Promise<AladinLiteModule> | null = null;
function loadAladin(): Promise<AladinLiteModule> {
  aladinModule ??= import('aladin-lite').then((m) => m.default);
  return aladinModule;
}

/** How long to wait for the first image tile before telling the user something is wrong. */
const TILE_WATCHDOG_MS = 15000;

const ZOOM_PRESETS: { deg: number; label: string; hint: string }[] = [
  { deg: 0.05, label: 'Close', hint: '3 arcminutes across — the star and its nearest neighbours' },
  { deg: 0.25, label: 'Field', hint: '15 arcminutes across — about half the width of the full Moon' },
  { deg: 1, label: 'Wide', hint: '1 degree across — two full Moons side by side' },
  { deg: 5, label: 'Region', hint: '5 degrees across — the surrounding patch of sky' },
];

type ViewerPhase =
  | 'starting' // loading the WebGL library
  | 'resolving' // finding a reachable image server
  | 'loading-tiles' // survey set, waiting for the first tile
  | 'ok' // at least one tile received
  | 'stalled' // no tile after TILE_WATCHDOG_MS
  | 'unreachable' // no mirror answered
  | 'failed'; // library / WebGL failure

interface SkyViewerPanelProps {
  target: ExoplanetDetail | null;
  /**
   * Lets other parts of the page (the guided path's "Share this world") reuse the same captioned
   * PNG export. Filled on every render with the current state of the viewer.
   */
  actionsRef?: React.MutableRefObject<SkyViewerActions | null>;
}

export interface SkyViewerActions {
  /** True once real sky tiles have arrived for the current target. */
  canExport: boolean;
  /** Saves the captioned PNG; resolves with the message shown to the user. */
  exportPng: () => Promise<string>;
}

/**
 * Watches the browser's resource timeline for HiPS tiles served from `baseUrl`.
 * Aladin Lite exposes no "tile loaded" event, so this is the only reliable signal that imagery
 * really arrived (both fetch() and <img> loads appear in resource timing, cross-origin included).
 */
function watchForTiles(baseUrl: string, onTile: () => void): () => void {
  if (typeof PerformanceObserver === 'undefined') {
    onTile();
    return () => {};
  }
  let done = false;
  const observer = new PerformanceObserver((list) => {
    if (done) return;
    if (list.getEntries().some((e) => isHipsTileUrl(e.name, baseUrl))) {
      done = true;
      observer.disconnect();
      onTile();
    }
  });
  try {
    observer.observe({ type: 'resource', buffered: false });
  } catch {
    onTile();
    return () => {};
  }
  return () => {
    done = true;
    observer.disconnect();
  };
}

export const SkyViewerPanel: React.FC<SkyViewerPanelProps> = ({ target, actionsRef }) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const aladinRef = useRef<AladinInstance | null>(null);
  const catalogRef = useRef<AladinCatalog | null>(null);
  const libRef = useRef<AladinLiteModule | null>(null);
  const confirmedUrlsRef = useRef<Set<string>>(new Set());
  const stopWatchRef = useRef<() => void>(() => {});
  const watchdogRef = useRef<number | undefined>(undefined);
  const surveyRequestRef = useRef(0);

  const [phase, setPhase] = useState<ViewerPhase>('starting');
  const [problem, setProblem] = useState<string | null>(null);
  const [problemDetail, setProblemDetail] = useState<string[]>([]);
  const [initAttempt, setInitAttempt] = useState(0);
  const [libReady, setLibReady] = useState(false);

  const [surveyId, setSurveyId] = useState<string>(DEFAULT_SURVEY_ID);
  const [resolved, setResolved] = useState<ResolvedHips | null>(null);
  const [fovDeg, setFovDeg] = useState<number>(0.25);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [cooFrame, setCooFrame] = useState<'ICRSd' | 'galactic'>('ICRSd');
  const [projection, setProjection] = useState<'SIN' | 'AIT' | 'MOL'>('SIN');
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const survey = findSurvey(surveyId);
  const ra = target?.hostStar.raDeg ?? null;
  const dec = target?.hostStar.decDeg ?? null;

  const clearWatch = () => {
    stopWatchRef.current();
    stopWatchRef.current = () => {};
    window.clearTimeout(watchdogRef.current);
  };

  /** Starts the "did any tile arrive?" watchdog for a freshly displayed survey. */
  const armTileWatch = useCallback((baseUrl: string) => {
    clearWatch();
    if (confirmedUrlsRef.current.has(baseUrl)) {
      // Tiles from this server already arrived in this session; Aladin may serve them from memory.
      setPhase('ok');
      return;
    }
    setPhase('loading-tiles');
    stopWatchRef.current = watchForTiles(baseUrl, () => {
      window.clearTimeout(watchdogRef.current);
      confirmedUrlsRef.current.add(baseUrl);
      setPhase('ok');
    });
    watchdogRef.current = window.setTimeout(() => {
      stopWatchRef.current();
      setPhase('stalled');
      setProblem(
        'The image server answered, but no sky image tiles arrived within 15 seconds. ' +
          'The connection may be slow or blocked by a firewall or the embedding page.'
      );
    }, TILE_WATCHDOG_MS);
  }, []);

  // 1. Library + first survey. Re-runs only on explicit retry.
  useEffect(() => {
    let cancelled = false;
    const hostEl = hostRef.current;
    const requestId = ++surveyRequestRef.current;

    // Aladin reports HiPS failures as unhandled promise rejections; surface them instead of
    // leaving a gray canvas with an endless "loading" label.
    const onRejection = (event: PromiseRejectionEvent) => {
      const msg = String(
        (event.reason && (event.reason.message ?? event.reason)) || ''
      );
      if (/HiPS|does not point|not refer to a found CDS ID/i.test(msg)) {
        event.preventDefault();
        clearWatch();
        setPhase('unreachable');
        setProblem('The sky survey could not be loaded from its image server.');
        setProblemDetail([msg.replace(/\s+/g, ' ').slice(0, 300)]);
      }
    };
    window.addEventListener('unhandledrejection', onRejection);

    (async () => {
      setPhase('starting');
      setProblem(null);
      setProblemDetail([]);
      setLibReady(false);
      let A: AladinLiteModule;
      try {
        A = await loadAladin();
        await A.init;
      } catch (err) {
        if (cancelled) return;
        setPhase('failed');
        setProblem(
          'The sky viewer could not start. It needs WebGL2, which this browser or device has disabled. ' +
            (err instanceof Error ? `(${err.message})` : '')
        );
        return;
      }
      if (cancelled || !hostEl) return;
      libRef.current = A;

      setPhase('resolving');
      let mirror: ResolvedHips;
      try {
        mirror = await resolveHipsMirror(findSurvey(surveyId));
      } catch (err) {
        if (cancelled || requestId !== surveyRequestRef.current) return;
        setPhase('unreachable');
        setProblem(err instanceof Error ? err.message : 'Image servers unreachable.');
        setProblemDetail(err instanceof HipsUnavailableError ? err.attempts : []);
        return;
      }
      if (cancelled || requestId !== surveyRequestRef.current) return;

      try {
        hostEl.innerHTML = '';
        const instance = A.aladin(hostEl, {
          survey: mirror.baseUrl,
          fov: fovDeg,
          projection,
          cooFrame,
          target: ra !== null && dec !== null ? `${ra} ${dec}` : undefined,
          showReticle: false,
          showCooGrid: showGrid,
          showZoomControl: true,
          showFullscreenControl: false,
          showLayersControl: false,
          showGotoControl: false,
          showFrame: false,
          showCooGridControl: false,
          showSimbadPointerControl: false,
          // Our own header already shows the coordinates; keep the canvas uncluttered.
          showCooLocation: false,
          showProjectionControl: false,
          showContextMenu: false,
        });
        const overlay = A.catalog({
          name: 'Host star (NASA Exoplanet Archive position)',
          sourceSize: 18,
          color: '#22d3ee',
          shape: 'circle',
        });
        instance.addCatalog(overlay);
        aladinRef.current = instance;
        catalogRef.current = overlay;
        setResolved(mirror);
        setLibReady(true);
        armTileWatch(mirror.baseUrl);
      } catch (err) {
        if (cancelled) return;
        setPhase('failed');
        setProblem(
          'The sky viewer could not start in this browser. ' +
            (err instanceof Error ? `(${err.message})` : '')
        );
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('unhandledrejection', onRejection);
      clearWatch();
      aladinRef.current = null;
      catalogRef.current = null;
      if (hostEl) hostEl.innerHTML = '';
    };
    // Survey/zoom/frame changes are applied incrementally by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initAttempt]);

  // 2. Survey switch after start-up: resolve a mirror, then swap the base layer.
  const changeSurvey = async (nextId: string) => {
    setSurveyId(nextId);
    setExportNote(null);
    const aladin = aladinRef.current;
    if (!aladin || !libReady) {
      setInitAttempt((n) => n + 1);
      return;
    }
    const requestId = ++surveyRequestRef.current;
    clearWatch();
    setPhase('resolving');
    setProblem(null);
    setProblemDetail([]);
    try {
      const mirror = await resolveHipsMirror(findSurvey(nextId));
      if (requestId !== surveyRequestRef.current) return;
      await Promise.resolve(aladin.setBaseImageLayer(mirror.baseUrl));
      setResolved(mirror);
      armTileWatch(mirror.baseUrl);
    } catch (err) {
      if (requestId !== surveyRequestRef.current) return;
      setPhase('unreachable');
      setProblem(err instanceof Error ? err.message : 'Image servers unreachable.');
      setProblemDetail(err instanceof HipsUnavailableError ? err.attempts : []);
    }
  };

  // 3. Follow the selected planet's host star.
  useEffect(() => {
    const aladin = aladinRef.current;
    const catalog = catalogRef.current;
    if (!aladin || !libReady || !target) return;
    if (ra === null || dec === null) return; // never invent a position
    try {
      aladin.gotoRaDec(ra, dec);
      if (catalog) {
        if (typeof catalog.clear === 'function') catalog.clear();
        else if (typeof catalog.removeAll === 'function') catalog.removeAll();
        catalog.addSources([
          libRef.current!.source(ra, dec, {
            name: target.hostStar.hostname,
            planet: target.planetName,
          }),
        ]);
      }
    } catch {
      // Aladin can throw during a layer transition; the next selection re-applies.
    }
  }, [target, ra, dec, libReady]);

  // 4. Grid, frame and projection.
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || !libReady) return;
    try {
      aladin.setProjection(projection);
      aladin.setFrame(cooFrame);
      if (showGrid) aladin.showCooGrid();
      else aladin.hideCooGrid();
    } catch {
      // ignore transient transition errors
    }
  }, [projection, cooFrame, showGrid, libReady]);

  const applyZoom = (deg: number) => {
    setFovDeg(deg);
    aladinRef.current?.setFoV(deg);
  };

  const handleRecenter = () => {
    if (!aladinRef.current || ra === null || dec === null) return;
    aladinRef.current.gotoRaDec(ra, dec);
    aladinRef.current.setFoV(fovDeg);
  };

  const handleFullscreen = () => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() =>
        setExportNote('Full screen is blocked here (the embedding page must allow it).')
      );
    }
  };

  const metadata = () =>
    buildSkyViewMetadata({
      planetName: target?.planetName ?? 'No target',
      hostName: target?.hostStar.hostname ?? '',
      raDeg: ra,
      decDeg: dec,
      fieldOfViewDeg: fovDeg,
      surveyId: survey.id,
      surveyTitle: resolved?.title ?? survey.label,
      tileBaseUrl: resolved?.baseUrl ?? null,
      credit: resolved?.credit ?? survey.credit,
      imageryConfirmed: phase === 'ok',
    });

  const downloadMetadata = () => {
    if (!target) return;
    triggerTextDownload(
      `${skyFileStem(target.planetName)}_view.json`,
      JSON.stringify(metadata(), null, 2),
      'application/json'
    );
  };

  const exportPng = async (): Promise<string> => {
    const aladin = aladinRef.current;
    if (!aladin || !target || phase !== 'ok') {
      return 'The sky image has not loaded yet, so there is nothing to save. Open the sky view to check it.';
    }
    setExporting(true);
    setExportNote(null);
    try {
      if (typeof aladin.getViewDataURL !== 'function') throw new Error('capture not supported');
      const dataUrl = await aladin.getViewDataURL({ format: 'image/png' });
      const img = new Image();
      await new Promise<void>((ok, ko) => {
        img.onload = () => ok();
        img.onerror = () => ko(new Error('could not decode the captured view'));
        img.src = dataUrl;
      });
      const meta = metadata();
      const lines = skyFooterLines(meta);
      const lineH = 18;
      const footerH = lines.length * lineH + 16;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height + footerH;
      const g = canvas.getContext('2d');
      if (!g) throw new Error('2D canvas unavailable');
      g.drawImage(img, 0, 0);
      g.fillStyle = '#0b1019';
      g.fillRect(0, img.height, canvas.width, footerH);
      g.fillStyle = '#e2e8f0';
      g.font = '13px ui-monospace, SFMono-Regular, Menlo, monospace';
      lines.forEach((line, i) => g.fillText(line, 10, img.height + 20 + i * lineH, canvas.width - 20));
      const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
      if (!blob) throw new Error('the browser refused to encode the image');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${skyFileStem(target.planetName)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      const done = 'Sky image saved. Survey, coordinates and capture time are printed under the image.';
      setExportNote(done);
      return done;
    } catch (err) {
      const blocked = `This browser blocked the image capture (${
        err instanceof Error ? err.message : 'unknown reason'
      }). Use “Open in Aladin Lite” for a shareable view, or download the view details as JSON.`;
      setExportNote(blocked);
      return blocked;
    } finally {
      setExporting(false);
    }
  };

  // Refreshed after every render so callers always get the current viewer state.
  useEffect(() => {
    if (actionsRef) actionsRef.current = { canExport: !!target && phase === 'ok' && !exporting, exportPng };
  });

  const permalink = aladinPermalink(ra, dec, fovDeg, survey.id);
  const hasCoords = ra !== null && dec !== null;
  const blocking = phase === 'unreachable' || phase === 'failed' || phase === 'stalled';

  const statusText: Record<ViewerPhase, string> = {
    starting: 'Starting the sky viewer…',
    resolving: `Connecting to the ${survey.label} image server…`,
    'loading-tiles': `Loading ${survey.label} images…`,
    ok: '',
    stalled: '',
    unreachable: '',
    failed: '',
  };

  return (
    <section
      className="bg-[#161e2c] border border-slate-800 rounded flex flex-col"
      aria-labelledby="sky-viewer-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-[#1a2332]">
        <div>
          <h2 id="sky-viewer-title" className="text-sm font-semibold text-slate-100">
            Sky around {target ? target.hostStar.hostname : 'the host star'}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real telescope survey images centred on the host star (circle). The planet itself is too faint to see.
          </p>
        </div>
        {target && (
          <span className="font-mono tabular-nums text-[11px] text-cyan-300" title="Right ascension / declination (ICRS, J2000)">
            {formatRaHms(ra)} / {formatDecDms(dec)}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 text-xs">
          <label className="flex flex-col gap-1 text-slate-300 min-w-[14rem]">
            <span className="text-[11px] text-slate-400">Image survey</span>
            <select
              value={surveyId}
              onChange={(e) => void changeSurvey(e.target.value)}
              className="px-2 py-1.5 text-xs bg-[#0e1420] border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              {HIPS_SURVEYS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-400" id="zoom-label">
              Zoom
            </span>
            <div className="inline-flex bg-[#0e1420] border border-slate-800 rounded p-0.5" role="group" aria-labelledby="zoom-label">
              {ZOOM_PRESETS.map((z) => (
                <button
                  key={z.deg}
                  type="button"
                  title={z.hint}
                  aria-pressed={fovDeg === z.deg}
                  onClick={() => applyZoom(z.deg)}
                  className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                    fovDeg === z.deg
                      ? 'bg-cyan-500/20 text-cyan-200 font-medium'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={!libReady || !hasCoords}
              onClick={handleRecenter}
              className="sky-btn"
              title="Centre the view on the host star again"
            >
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" /> Recenter
            </button>
            <button
              type="button"
              aria-pressed={showGrid}
              disabled={!libReady}
              onClick={() => setShowGrid((v) => !v)}
              className="sky-btn"
              title="Overlay a coordinate grid"
            >
              Grid {showGrid ? 'on' : 'off'}
            </button>
            <button type="button" onClick={handleFullscreen} className="sky-btn" title="Show the sky viewer full screen">
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" /> Full screen
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 -mt-1">{survey.description}</p>

        <div ref={frameRef} className="sky-frame relative rounded border border-slate-800 overflow-hidden bg-[#0a0f18]">
          <div
            ref={hostRef}
            className="aladin-viewport-host cursor-crosshair"
            role="application"
            aria-label={
              target
                ? `Sky map centred on ${target.hostStar.hostname}. Drag to pan, scroll to zoom.`
                : 'Sky map'
            }
          />
          {statusText[phase] && (
            <div
              className="absolute inset-x-0 bottom-0 px-3 py-2 bg-[#0a0f18]/85 text-xs text-slate-200 flex items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" aria-hidden="true" />
              {statusText[phase]}
            </div>
          )}
          {blocking && (
            <div
              className="absolute inset-0 flex items-center justify-center p-4 bg-[#0a0f18]/92"
              role="alert"
            >
              <div className="max-w-md text-xs text-slate-200 flex flex-col gap-3">
                <strong className="text-sm text-rose-200">
                  {phase === 'stalled' ? 'Sky images are not arriving' : 'Sky images unavailable'}
                </strong>
                <p>{problem}</p>
                <p className="text-slate-400">
                  The planet data on this page is unaffected. No placeholder image is shown, so what you
                  see here is always real survey imagery or nothing.
                </p>
                {problemDetail.length > 0 && (
                  <details className="text-[11px] text-slate-400">
                    <summary className="cursor-pointer">Technical details</summary>
                    <ul className="mt-1 font-mono break-all">
                      {problemDetail.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setInitAttempt((n) => n + 1)} className="sky-btn">
                    <RotateCw className="w-3.5 h-3.5" aria-hidden="true" /> Retry
                  </button>
                  {phase !== 'failed' &&
                    HIPS_SURVEYS.filter((s) => s.id !== surveyId)
                      .slice(0, 2)
                      .map((s) => (
                        <button key={s.id} type="button" onClick={() => void changeSurvey(s.id)} className="sky-btn">
                          Try {s.label.split(' (')[0]}
                        </button>
                      ))}
                  {permalink && (
                    <a href={permalink} target="_blank" rel="noopener noreferrer" className="sky-btn">
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Open in Aladin Lite
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          {target && !hasCoords && (
            <div className="absolute top-2 left-2 right-2 px-3 py-2 rounded bg-amber-950/80 border border-amber-500/40 text-amber-100 text-xs" role="status">
              The archive reports no coordinates for this host star, so the view is not centred on it.
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => void exportPng()}
            disabled={!target || phase !== 'ok' || exporting}
            className="sky-btn"
            title={phase === 'ok' ? 'Save the current view with its details printed underneath' : 'Available once sky images have loaded'}
          >
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {exporting ? 'Capturing…' : 'Export sky image (PNG)'}
          </button>
          {permalink && (
            <a href={permalink} target="_blank" rel="noopener noreferrer" className="sky-btn">
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Open in Aladin Lite
            </a>
          )}
          <span className="text-[11px] text-slate-500 ml-auto">
            {resolved ? `Images: ${resolved.credit}` : 'Images: CDS / ESA sky surveys'} · Aladin Lite (CDS)
          </span>
        </div>
        {exportNote && (
          <p className="text-[11px] text-slate-300" role="status">
            {exportNote}
          </p>
        )}

        <details className="text-[11px] text-slate-400">
          <summary className="cursor-pointer select-none text-slate-300">More options</summary>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <button type="button" onClick={downloadMetadata} disabled={!target} className="sky-btn">
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> View details (JSON)
            </button>
            <label className="inline-flex items-center gap-1.5">
              <span title="ICRS is the standard equatorial frame used for RA/Dec. Galactic aligns with the Milky Way.">Coordinate frame</span>
              <select
                value={cooFrame}
                onChange={(e) => setCooFrame(e.target.value as 'ICRSd' | 'galactic')}
                className="px-2 py-1 bg-[#0e1420] border border-slate-700 rounded text-slate-100"
              >
                <option value="ICRSd">Equatorial (ICRS, J2000)</option>
                <option value="galactic">Galactic</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5">
              <span title="How the curved sky is flattened onto the screen. Only matters for very wide views.">Projection</span>
              <select
                value={projection}
                onChange={(e) => setProjection(e.target.value as 'SIN' | 'AIT' | 'MOL')}
                className="px-2 py-1 bg-[#0e1420] border border-slate-700 rounded text-slate-100"
              >
                <option value="SIN">Orthographic (SIN)</option>
                <option value="AIT">Aitoff (AIT)</option>
                <option value="MOL">Mollweide (MOL)</option>
              </select>
            </label>
            <span className="font-mono tabular-nums">
              Centre: {formatDeg(ra)}, {formatDeg(dec)} · field {fovDeg}°
            </span>
            {resolved && <span className="break-all">Tile server: {resolved.baseUrl}</span>}
          </div>
          <p className="mt-2 leading-snug">
            The circle marks the host star&apos;s catalogue position from the NASA Exoplanet Archive. Survey
            images were taken decades ago, so fast-moving nearby stars can appear slightly offset from it.
          </p>
        </details>
      </div>
    </section>
  );
};
