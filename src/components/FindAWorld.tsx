import { useState } from 'react';
import type { ExoplanetDetail } from '../api/contracts';
import { friendlyUnit, formatMeasurementValue } from '../utils/measurementFormat';
import {
  describeEarthYear,
  displayQuantity,
  parsecsToLightYears,
  usableScientificValue,
} from '../utils/storytelling';

interface FindAWorldProps {
  target: ExoplanetDetail | null;
  onExploreSky: () => void;
}

const QUESTIONS = ['How big is it?', 'How far away is it?', 'How long is its year?'] as const;

/**
 * Three short, source-aware explanations of one real NASA planet record.
 * Never use an unverified limit or a missing value for visual comparisons.
 */
export function FindAWorld({ target, onExploreSky }: FindAWorldProps) {
  const [step, setStep] = useState(0);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const copyWorldLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('target', target?.planetName ?? '');
    if (!navigator.clipboard?.writeText) {
      setShareNote('Copy the current page URL from your browser, then add ?target= and the planet name.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareNote('World link copied. Share it to open this planet directly.');
    } catch {
      setShareNote('Link copying is blocked by this browser. You can share this page from the address bar.');
    }
  };

  if (!target) return null;

  const radius = target.planetaryParameters.radiusEarth;
  const distance = target.hostStar.distancePc;
  const period = target.orbitalParameters.periodDays;
  const usableRadius = usableScientificValue(radius);
  const usableDistance = usableScientificValue(distance);
  const usablePeriod = usableScientificValue(period);
  const distanceLy = parsecsToLightYears(usableDistance);
  const stepMeasurement = step === 0 ? radius : step === 1 ? distance : period;
  const hasValue = step === 0 ? usableRadius !== null : step === 1 ? distanceLy !== null : usablePeriod !== null;

  const explanation =
    step === 0
      ? usableRadius === null
        ? 'A reliable radius comparison is not available for this planet.'
        : `The published radius is ${displayQuantity(usableRadius)} times Earth's radius.`
      : step === 1
        ? distanceLy === null
          ? 'A reliable distance is not available for this star.'
          : `Its star is about ${displayQuantity(distanceLy)} light-years from us (converted from the archive's parsecs).`
        : usablePeriod === null
          ? 'A reliable orbital period is not available for this planet.'
          : `One year there lasts ${displayQuantity(usablePeriod)} Earth days. ${describeEarthYear(usablePeriod)}`;

  return (
    <section aria-labelledby="find-world-title" className="rounded border border-slate-700 bg-[#161e2c] p-4 sm:p-5 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs uppercase tracking-wider text-cyan-300">Guided discovery · 3 questions</span>
          <h2 id="find-world-title" className="text-lg font-semibold text-slate-50">
            Find a world: {target.planetName}
          </h2>
        </div>
        <span aria-live="polite" className="text-xs text-slate-300">
          Question {step + 1} of 3
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Progress">
        {QUESTIONS.map((question, index) => (
          <button
            key={question}
            type="button"
            onClick={() => setStep(index)}
            aria-current={step === index ? 'step' : undefined}
            className={`rounded border px-2 py-2 text-left text-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-cyan-400 ${
              index === step
                ? 'border-cyan-400 bg-cyan-400/10 text-cyan-100'
                : 'border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="block text-[10px] opacity-80">{index + 1} / 3</span>
            {question}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-4 items-center">
        <div
          className="relative mx-auto flex h-36 w-36 items-center justify-center rounded-full bg-[#0d1422]"
          role="img"
          aria-label={hasValue && step === 0 ? 'Two circles with radii proportional to Earth and the planet using the published radius' : 'Illustrative astronomy symbol, not a telescope photograph'}
        >
          {step === 0 ? (
            usableRadius !== null ? (
              <svg viewBox="0 0 180 140" className="h-full w-full" aria-hidden="true">
                <circle cx="47" cy="64" r={36 / Math.max(1, usableRadius)} fill="#60a5fa" stroke="#bfdbfe" strokeWidth="1" />
                <circle cx="129" cy="64" r={36 * usableRadius / Math.max(1, usableRadius)} fill="#fcd34d" stroke="#fef3c7" strokeWidth="1" />
                <text x="47" y="122" fill="#e2e8f0" textAnchor="middle" fontSize="12">Earth</text>
                <text x="129" y="122" fill="#e2e8f0" textAnchor="middle" fontSize="12">Planet</text>
              </svg>
            ) : <span className="text-5xl text-slate-400" aria-hidden="true">?</span>
          ) : step === 1 ? (
            <span className="text-5xl text-cyan-300" aria-hidden="true">✦</span>
          ) : (
            <div className="relative h-24 w-24 rounded-full border border-dashed border-cyan-400/70">
              <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300" />
              <div className="absolute -right-2 top-8 h-3 w-3 rounded-full bg-blue-300" />
            </div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-medium text-slate-100">{QUESTIONS[step]}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-200">{explanation}</p>
          {step === 0 && usableRadius !== null && (
            <p className="mt-1 text-xs text-slate-400">The circle radii show the relative sizes; colours are illustrative, not measured.</p>
          )}
          <p className="mt-2 text-xs text-slate-300">
            NASA Exoplanet Archive · pscomppars · {stepMeasurement.status === 'derived' ? 'derived value' : 'archive value'}
            {stepMeasurement.referenceLabel ? ` · ${stepMeasurement.referenceLabel}` : ''}
          </p>
          {!hasValue && stepMeasurement.value !== null && (
            <p className="mt-1 text-xs text-amber-200">
              Reported as {stepMeasurement.status.replaceAll('_', ' ')}: {formatMeasurementValue(stepMeasurement)} {friendlyUnit(stepMeasurement.unit)}.
              Not suitable for a direct comparison.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 pt-3">
        <button
          type="button"
          onClick={() => setStep((n) => Math.max(0, n - 1))}
          disabled={step === 0}
          className="sky-btn"
        >
          Previous
        </button>
        {step < 2 ? (
          <button type="button" onClick={() => setStep((n) => Math.min(2, n + 1))} className="sky-btn">
            Next question
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyWorldLink()} className="sky-btn">
              Share this world
            </button>
            <button type="button" onClick={onExploreSky} className="sky-btn">
              Explore its sky · export image
            </button>
          </div>
        )}
      </div>
      {shareNote && <p role="status" className="mt-2 text-xs text-cyan-200">{shareNote}</p>}
      <p className="mt-2 text-[11px] text-slate-400">
        Real NASA data. The size, distance and orbit measurements can originate in different publications.
        This is not a photograph of the planet.
      </p>
    </section>
  );
}
