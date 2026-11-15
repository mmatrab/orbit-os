import { useState } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import type { SnapshotPlanet } from '../stories/planetSnapshot';
import { snapshotWorldFacts } from '../utils/snapshotWorld';

interface SnapshotFallbackProps {
  planet: SnapshotPlanet | null;
  planetName: string | null;
  snapshotDate: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** This is explicitly a dated catalogue preview, never a fake live NASA detail. */
export function SnapshotWorldGuide({ planet, planetName, snapshotDate, loading, error, onRetry }: SnapshotFallbackProps) {
  const [step, setStep] = useState(0);
  const facts = planet ? snapshotWorldFacts(planet) : [];

  return (
    <section aria-labelledby="snapshot-world-title" className="h-full rounded border border-slate-700 bg-[#161e2c] p-4 sm:p-5">
      <span className="text-xs uppercase tracking-wider text-cyan-300">Guided discovery · 3 questions</span>
      <h2 id="snapshot-world-title" className="mt-1 text-lg font-semibold text-slate-50">
        Find a world: {planetName ?? 'Choose a planet'}
      </h2>
      {planet ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Three discovery questions">
            {facts.map((fact, index) => (
              <button key={fact.title} type="button" onClick={() => setStep(index)} aria-current={step === index ? 'step' : undefined}
                className={`rounded border px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-cyan-400 cursor-pointer ${
                  index === step ? 'border-cyan-400 bg-cyan-400/10 text-cyan-100' : 'border-slate-600 text-slate-300'
                }`}>
                {index + 1}/3 · {fact.title}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-700/70 bg-[#0e1420] p-4">
            <h3 className="text-base font-semibold text-slate-100">{facts[step].title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-200">{facts[step].description}</p>
          </div>
          <p className="mt-3 text-xs leading-5 text-amber-200">
            Archive snapshot · {snapshotDate ?? 'date unavailable'} · NASA Exoplanet Archive, pscomppars.
            This is a dated catalogue summary, not a live response. Per-value paper references and uncertainties are only available when the live record loads.
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-300">
          {loading ? 'Loading published NASA measurements…' :
            'There is no dated catalogue record for this selection. You can try again or choose another planet.'}
        </p>
      )}
      {error ? (
        <div className="mt-4 rounded border border-amber-700/60 p-3 text-sm text-amber-100" role="status">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Live NASA data is temporarily unavailable. {planet ? 'The dated summary above remains available.' : 'The guide will return when the service responds.'}</span>
          </div>
          <button type="button" className="sky-btn mt-3" onClick={onRetry}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry live data
          </button>
        </div>
      ) : loading && planet ? <p className="mt-3 text-xs text-slate-300" role="status">Checking live NASA record…</p> : null}
    </section>
  );
}

export function SnapshotOverview({ planet, snapshotDate, error, loading, onRetry }: Omit<SnapshotFallbackProps, 'planetName'>) {
  if (!planet) return null;
  const facts = snapshotWorldFacts(planet);
  return (
    <section className="rounded border border-slate-700 bg-[#161e2c] p-4" aria-labelledby="archive-summary-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="archive-summary-title" className="text-base font-semibold text-slate-100">{planet.planetName}</h2>
        <span className="rounded border border-amber-700/60 px-2 py-1 text-xs text-amber-200">Dated NASA snapshot</span>
      </div>
      <p className="mt-2 text-xs text-slate-300">
        NASA Exoplanet Archive · pscomppars · {snapshotDate ?? 'date unavailable'}.
        These values have no per-parameter paper references or uncertainties in the snapshot.
      </p>
      <div className="mt-3 space-y-3">
        {facts.map((fact) => (
          <div key={fact.title} className="rounded border border-slate-700 bg-[#0e1420] p-3">
            <p className="text-xs font-medium text-slate-300">{fact.title}</p>
            <p className="mt-1 text-sm leading-5 text-slate-100">{fact.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-300">
          {error ? 'Live NASA query failed.' : loading ? 'Checking the live NASA record…' : 'Live data not yet available.'}
        </p>
        {error ? <button type="button" onClick={onRetry} className="sky-btn">
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
        </button> : null}
      </div>
    </section>
  );
}
