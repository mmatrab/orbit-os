import { useSnapshot } from '../stories/useSnapshot';
import { DiscoveryTimeline } from './DiscoveryTimeline';
import { RadiusPeriodChart } from './RadiusPeriodChart';

/** Charts only render from a real, dated NASA snapshot; nothing is substituted if it is missing. */
export function StoryCharts() {
  const state = useSnapshot();
  return (
    <section id="story-charts" className="mt-6 space-y-4" aria-labelledby="story-charts-heading">
      <h2 id="story-charts-heading" className="text-xl font-semibold text-slate-50">
        Discoveries across the galaxy
      </h2>
      {state.phase === 'loading' ? (
        <p className="text-sm text-slate-300" role="status">
          Loading the dated NASA snapshot…
        </p>
      ) : null}
      {state.phase === 'error' ? (
        <div role="status" className="rounded border border-amber-700 bg-amber-950/20 p-4 text-sm text-slate-200">
          <p>The charts are unavailable: {state.message}</p>
          <p className="mt-1">
            A real archive snapshot is needed (<code>npm run snapshot</code>). No example data are substituted.
          </p>
        </div>
      ) : null}
      {state.phase === 'ready' ? (
        <>
          <DiscoveryTimeline snapshot={state.snapshot} />
          <RadiusPeriodChart snapshot={state.snapshot} />
        </>
      ) : null}
    </section>
  );
}
