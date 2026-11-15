import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { ExoplanetDetail } from '../api/contracts';
import {
  buildSystemGeometry,
  planetColour,
  SECONDS_PER_ORBIT,
  starColour,
  type ScaleMode,
} from '../viewer3d/systemGeometry';

type ThreeNamespace = typeof import('three');

interface SystemViewer3DProps {
  target: ExoplanetDetail;
}

function makeGlowTexture(THREE: ThreeNamespace) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

function ringGeometry(THREE: ThreeNamespace, radius: number) {
  const points: InstanceType<ThreeNamespace['Vector3']>[] = [];
  const segments = 256;
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

export const SystemViewer3D: React.FC<SystemViewer3DProps> = ({ target }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ScaleMode>('clear');
  const [playing, setPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const modeRef = useRef<ScaleMode>(mode);
  const playingRef = useRef(playing);
  const layoutRef = useRef<((m: ScaleMode) => void) | null>(null);
  const resetRef = useRef<(() => void) | null>(null);

  const geometry = useMemo(
    () =>
      buildSystemGeometry({
        periodDays: target.orbitalParameters.periodDays.value,
        semiMajorAxisAu: target.orbitalParameters.semiMajorAxisAu.value,
        starMassSolar: target.hostStar.massSolar.value,
        starRadiusSolar: target.hostStar.radiusSolar.value,
        planetRadiusEarth: target.planetaryParameters.radiusEarth.value,
        inclinationDeg: target.orbitalParameters.inclinationDeg.value,
      }),
    [target]
  );

  useEffect(() => {
    modeRef.current = mode;
    layoutRef.current?.(mode);
  }, [mode]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    let cleanup: (() => void) | undefined;
    setError(null);

    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (disposed) return;

      let renderer: InstanceType<ThreeNamespace['WebGLRenderer']>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setError('The 3D view needs WebGL, which this browser does not provide. The sky image still works.');
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 10000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.minDistance = 0.5;

      const teff = target.hostStar.teffK.value;
      const eqt = target.planetaryParameters.equilibriumTempK.value;

      const star = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 32),
        new THREE.MeshBasicMaterial({ color: starColour(teff) })
      );
      scene.add(star);

      const glowTexture = makeGlowTexture(THREE);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: starColour(teff),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      glow.scale.setScalar(4);
      scene.add(glow);

      scene.add(new THREE.AmbientLight(0x6b7a90, 0.6));
      scene.add(new THREE.PointLight(0xffffff, 8, 0, 0));

      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(1, 40, 24),
        new THREE.MeshStandardMaterial({ color: planetColour(eqt), roughness: 0.85, metalness: 0, emissive: planetColour(eqt), emissiveIntensity: 0.25 })
      );
      const orbitPivot = new THREE.Group();
      orbitPivot.rotation.x = THREE.MathUtils.degToRad(geometry.inclinationDeg);
      orbitPivot.add(planet);
      scene.add(orbitPivot);

      const ringMaterial = new THREE.LineBasicMaterial({ color: 0x3ad6ef, transparent: true, opacity: 0.55 });
      let orbitLine: InstanceType<ThreeNamespace['LineLoop']> | null = null;
      let orbitRadius = 1;

      const frameCamera = () => {
        const distance = Math.max(4, (orbitRadius * 3.2) / Math.min(1, camera.aspect / 1.1));
        camera.position.set(0, distance * 0.55, distance);
        controls.target.set(0, 0, 0);
        controls.update();
      };

      const applyLayout = (m: ScaleMode) => {
        orbitRadius = m === 'to-scale' ? geometry.orbitToScale : geometry.orbitClear;
        const planetRadius = m === 'to-scale' ? Math.max(geometry.planetToScale, 0.02) : geometry.planetClear;
        planet.scale.setScalar(planetRadius);
        if (orbitLine) {
          orbitPivot.remove(orbitLine);
          orbitLine.geometry.dispose();
        }
        orbitLine = new THREE.LineLoop(ringGeometry(THREE, orbitRadius), ringMaterial);
        orbitPivot.add(orbitLine);
        frameCamera();
      };

      const resize = () => {
        const width = host.clientWidth || 600;
        const height = host.clientHeight || 400;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      applyLayout(modeRef.current);
      layoutRef.current = applyLayout;
      resetRef.current = frameCamera;

      let angle = 0;
      let last = performance.now();
      const tick = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        if (playingRef.current) {
          angle += (dt * 2 * Math.PI) / SECONDS_PER_ORBIT;
        }
        planet.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        controls.dispose();
        scene.traverse((obj) => {
          const mesh = obj as InstanceType<ThreeNamespace['Mesh']>;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((material) => material.dispose());
          }
        });
        glowTexture.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        layoutRef.current = null;
        resetRef.current = null;
      };

      if (disposed) cleanup();
    })().catch(() => {
      if (!disposed) setError('The 3D view could not start. The sky image still works.');
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
    // The scene is rebuilt only when the selected planet changes; scale and play state are read by ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const buttonClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
      active ? 'bg-cyan-500/20 text-cyan-100' : 'text-slate-300 hover:bg-slate-800/60'
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Scale of the 3D view"
          className="inline-flex rounded border border-slate-700 overflow-hidden"
        >
          <button type="button" aria-pressed={mode === 'clear'} onClick={() => setMode('clear')} className={buttonClass(mode === 'clear')}>
            Clear view
          </button>
          <button type="button" aria-pressed={mode === 'to-scale'} onClick={() => setMode('to-scale')} className={buttonClass(mode === 'to-scale')}>
            To scale
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPlaying((p) => !p)} className="sky-btn" aria-label={playing ? 'Pause motion' : 'Play motion'}>
            {playing ? <Pause className="w-3.5 h-3.5" aria-hidden="true" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={() => resetRef.current?.()} className="sky-btn">
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset view
          </button>
        </div>
      </div>

      <div className="relative w-full h-[min(68vh,620px)] min-h-[340px] rounded border border-slate-800 bg-[#0a0f18] overflow-hidden">
        <div ref={hostRef} className="absolute inset-0" role="img" aria-label={`3D diagram of ${target.planetName} and its star`} />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-amber-200">{error}</div>
        )}
      </div>

      <div className="text-sm text-slate-200 leading-relaxed space-y-1.5">
        <p>
          Drag to rotate and scroll to zoom. The star&apos;s colour follows its temperature. The planet&apos;s colour is an
          artistic guess from its equilibrium temperature, not a measured surface colour.
        </p>
        <p className="text-slate-300">
          {mode === 'clear'
            ? 'Clear view: distances are compressed and small planets are enlarged so they can be seen.'
            : 'To scale: sizes and distances use the published values, relative to the star. From a distance the planet is smaller than one pixel: scroll in to find it.'}{' '}
          Motion is sped up on purpose: one orbit every {SECONDS_PER_ORBIT} seconds, whatever the real period.
        </p>
        {geometry.notes.length > 0 && (
          <ul className="list-disc pl-5 text-slate-300">
            {geometry.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
