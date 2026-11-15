import { useEffect, useState, type ReactNode } from 'react';
import { Image as ImageIcon, Orbit } from 'lucide-react';

export type StageView = 'sky' | 'system';

interface SpaceStageProps {
  /** Sky viewer. Kept mounted while hidden so the sky renderer does not restart on every tab switch. */
  sky: ReactNode;
  /** 3D system view. Mounted only while selected, so its WebGL context is released when not in use. */
  system: ReactNode;
  /** Incremented by the page to bring the sky view back to the front (e.g. "Explore its sky"). */
  showSkyRequest?: number;
}

export const SpaceStage: React.FC<SpaceStageProps> = ({ sky, system, showSkyRequest = 0 }) => {
  const [view, setView] = useState<StageView>('sky');
  useEffect(() => {
    if (showSkyRequest > 0) setView('sky');
  }, [showSkyRequest]);

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
      active ? 'border-cyan-400 text-cyan-100' : 'border-transparent text-slate-300 hover:text-slate-100'
    }`;

  return (
    <section id="space-stage" aria-label="Explore the planet" className="bg-[#161e2c] border border-slate-800 rounded">
      <div role="tablist" aria-label="Choose a view" className="flex items-center gap-1 px-3 border-b border-slate-800 bg-[#1a2332]">
        <button
          type="button"
          role="tab"
          id="stage-tab-sky"
          aria-selected={view === 'sky'}
          aria-controls="stage-panel-sky"
          onClick={() => setView('sky')}
          className={tabClass(view === 'sky')}
        >
          <ImageIcon className="w-4 h-4" aria-hidden="true" />
          Sky image
        </button>
        <button
          type="button"
          role="tab"
          id="stage-tab-system"
          aria-selected={view === 'system'}
          aria-controls="stage-panel-system"
          onClick={() => setView('system')}
          className={tabClass(view === 'system')}
        >
          <Orbit className="w-4 h-4" aria-hidden="true" />
          3D system
        </button>
      </div>

      <div id="stage-panel-sky" role="tabpanel" aria-labelledby="stage-tab-sky" hidden={view !== 'sky'} className="p-3 lg:p-4">
        {sky}
      </div>
      {view === 'system' && (
        <div id="stage-panel-system" role="tabpanel" aria-labelledby="stage-tab-system" className="p-3 lg:p-4">
          {system}
        </div>
      )}
    </section>
  );
};
