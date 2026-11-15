import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Image as ImageIcon, Link2, RotateCcw, Telescope } from 'lucide-react';
import type { ExoplanetDetail, ScientificMeasurement } from '../api/contracts';
import { formatMeasurementValue, isLimit } from '../utils/measurementFormat';
import {
  EARTH_YEAR_DAYS,
  LIGHT_YEARS_PER_PARSEC,
  parsecsToLightYears,
  periodInEarthYears,
} from '../stories/planetSnapshot';

interface FindAWorldProps {
  target: ExoplanetDetail | null;
  loading: boolean;
  /** Saves the captioned sky PNG (the existing export); resolves with the message to show. */
  onShare: () => Promise<string>;
  /** Moves the visitor to the sky image of this planet's star. */
  onExploreSky: () => void;
}

const STEPS = ['How big is it?', 'How far is it?', 'How long is its year?'] as const;

/** Rounds for a plain-language sentence only; the exact archive value is always shown next to it. */
export function plainNumber(n: number): string {
  if (n >= 100) return Math.round(n).toLocaleString('en-US');
  if (n >= 10) return n.toFixed(0);
  if (n >= 1) return n.toFixed(1).replace(/\.0$/, '');
  return n.toPrecision(2);
}

/** Derived values are said to be estimates in the sentence itself, not only in the small print. */
export function estimatedPrefix(m: ScientificMeasurement<number>): string {
  return m.status === 'derived' ? 'Not measured, but estimated by the archive from other values: ' : '';
}

/** A short status note under every number: measured, derived or limit, as in the detail panel. */
const StatusNote: React.FC<{ m: ScientificMeasurement<number>; unitLabel: string }> = ({ m, unitLabel }) => {
  const exact = formatMeasurementValue(m);
  if (exact === null) return null;
  return (
    <p className="mt-1 text-xs text-slate-400">
      Archive value: <span className="font-mono text-slate-200">{exact}</span> {unitLabel}
      {m.status === 'derived' && (
        <span className="ml-1.5 text-amber-300" title="Calculated by the NASA Exoplanet Archive from other values, not measured directly.">
          (derived: calculated by the archive, not measured)
        </span>
      )}
      {m.status === 'measured' && m.referenceLabel && <span> · Source: {m.referenceLabel}</span>}
    </p>
  );
};

/** Earth and the planet drawn to the same scale. */
const SizePicture: React.FC<{ radiusEarth: number; planetName: string }> = ({ radiusEarth, planetName }) => {
  const maxR = 46;
  const scale = maxR / Math.max(1, radiusEarth);
  const earthR = Math.max(1.5, scale);
  const planetR = Math.max(1.5, radiusEarth * scale);
  const width = 2 * earthR + 2 * planetR + 90;
  return (
    <svg
      viewBox={`0 0 ${width} 120`}
      className="w-full max-w-xs h-28"
      role="img"
      aria-label={`Earth and ${planetName} drawn to the same scale`}
    >
      <circle cx={20 + earthR} cy={56} r={earthR} fill="#3987e5" />
      <text x={20 + earthR} y={114} textAnchor="middle" className="fill-slate-300 text-[13px]">
        Earth
      </text>
      <circle cx={70 + 2 * earthR + planetR} cy={56} r={planetR} fill="#c98500" />
      <text x={70 + 2 * earthR + planetR} y={114} textAnchor="middle" className="fill-slate-300 text-[13px]">
        {planetName}
      </text>
    </svg>
  );
};

/** A ruler where each mark is ten times farther than the previous one. */
const DistancePicture: React.FC<{ lightYears: number }> = ({ lightYears }) => {
  const marks = [1, 10, 100, 1000, 10000];
  const lo = Math.log10(0.5);
  const hi = Math.log10(30000);
  const x = (ly: number) => 20 + ((Math.log10(Math.min(Math.max(ly, 0.5), 30000)) - lo) / (hi - lo)) * 300;
  return (
    <svg viewBox="0 0 340 94" className="w-full max-w-md h-28" role="img" aria-label={`A ruler from 1 to 10,000 light-years with the star at about ${plainNumber(lightYears)} light-years`}>
      <line x1={20} x2={320} y1={50} y2={50} stroke="#475569" strokeWidth={2} />
      {marks.map((m) => (
        <g key={m}>
          <line x1={x(m)} x2={x(m)} y1={45} y2={55} stroke="#64748b" strokeWidth={1} />
          <text x={x(m)} y={72} textAnchor="middle" className="fill-slate-300 text-[12px]">
            {m.toLocaleString('en-US')}
          </text>
        </g>
      ))}
      <text x={20} y={88} className="fill-slate-400 text-[11px]">
        light-years (each mark is 10× farther)
      </text>
      <circle cx={x(lightYears)} cy={50} r={6} fill="#c98500" stroke="#161e2c" strokeWidth={2} />
      <text x={x(lightYears)} y={30} textAnchor="middle" className="fill-slate-100 text-[13px]">
        this star
      </text>
    </svg>
  );
};

/** Earth's year and the planet's year as two bars on the same time scale. */
const YearPicture: React.FC<{ periodDays: number }> = ({ periodDays }) => {
  const longest = Math.max(EARTH_YEAR_DAYS, periodDays);
  const w = (d: number) => Math.max(3, (d / longest) * 200);
  return (
    <svg viewBox="0 0 360 74" className="w-full max-w-md h-20" role="img" aria-label="Earth's year and this planet's year drawn as bars on the same time scale">
      <text x={0} y={22} className="fill-slate-300 text-[13px]">
        Earth
      </text>
      <rect x={84} y={10} width={w(EARTH_YEAR_DAYS)} height={16} rx={3} fill="#3987e5" />
      <text x={92 + w(EARTH_YEAR_DAYS)} y={23} className="fill-slate-300 text-[12px]">
        {EARTH_YEAR_DAYS} days
      </text>
      <text x={0} y={56} className="fill-slate-300 text-[13px]">
        This planet
      </text>
      <rect x={84} y={44} width={w(periodDays)} height={16} rx={3} fill="#c98500" />
      <text x={92 + w(periodDays)} y={57} className="fill-slate-300 text-[12px]">
        {plainNumber(periodDays)} days
      </text>
    </svg>
  );
};

export const FindAWorld: React.FC<FindAWorldProps> = ({ target, loading, onShare, onExploreSky }) => {
  const [step, setStep] = useState(0);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const firstRender = useRef(true);

  // A new planet starts the path again.
  const planetName = target?.planetName ?? null;
  useEffect(() => {
    setStep(0);
    setShareNote(null);
  }, [planetName]);

  // Move keyboard and screen-reader focus to the new question after "Next" / "Back".
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  if (!target) {
    return (
      <section aria-labelledby="find-world-title" className="mb-4 px-5 py-4 rounded border border-slate-800 bg-[#161e2c]">
        <h2 id="find-world-title" className="text-sm font-semibold text-slate-100">
          Find a world
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {loading ? 'Loading the planet…' : 'Search a planet above, or pick one of the examples, to start.'}
        </p>
      </section>
    );
  }

  const radius = target.planetaryParameters.radiusEarth;
  const distance = target.hostStar.distancePc;
  const period = target.orbitalParameters.periodDays;
  const name = target.planetName;
  const done = step >= STEPS.length;

  const share = async () => {
    setSharing(true);
    try {
      setShareNote(await onShare());
    } finally {
      setSharing(false);
    }
  };

  // Deep link (?target=) read by src/embed/bridge.ts, so the planet opens directly.
  const copyLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('target', name);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url.toString());
      setShareNote('Link copied. Opening it shows this planet directly.');
    } catch {
      setShareNote(`Copying is blocked in this browser. Share this address instead: ${url.toString()}`);
    }
  };

  const notMeasured = (what: string) => (
    <p className="text-base text-slate-200">
      The archive has no measured {what} for {name}, so there is nothing to show here. We never fill in a missing value.
    </p>
  );
  const limitOnly = (m: ScientificMeasurement<number>, unit: string) => (
    <p className="text-base text-slate-200">
      Only a limit is known for this value ({formatMeasurementValue(m)} {unit}), so it is not drawn as a single number.
    </p>
  );

  let body: React.ReactNode;
  if (step === 0) {
    if (radius.value === null || radius.status === 'not_measured') body = notMeasured('size');
    else if (isLimit(radius)) body = limitOnly(radius, 'Earth radii');
    else {
      const r = radius.value;
      const sentence =
        r >= 1.05
          ? `${name} is about ${plainNumber(r)} times as wide as Earth.`
          : r <= 0.95
          ? `${name} is a little smaller than Earth: about ${Math.round(r * 100)}% of Earth's width.`
          : `${name} is about the same width as Earth.`;
      body = (
        <>
          <SizePicture radiusEarth={r} planetName={name} />
          <p className="mt-2 text-base text-slate-100">{estimatedPrefix(radius)}{sentence}</p>
          <StatusNote m={radius} unitLabel="Earth radii" />
        </>
      );
    }
  } else if (step === 1) {
    const ly = parsecsToLightYears(distance.value);
    if (ly === null || distance.status === 'not_measured') body = notMeasured('distance');
    else if (isLimit(distance)) body = limitOnly(distance, 'parsecs');
    else {
      body = (
        <>
          <DistancePicture lightYears={ly} />
          <p className="mt-2 text-base text-slate-100">
            {estimatedPrefix(distance)}Its star, {target.hostStar.hostname}, is about {plainNumber(ly)} light-years away. Its light takes about{' '}
            {plainNumber(ly)} years to reach us.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Converted from the archive distance of <span className="font-mono text-slate-200">{distance.value}</span> parsecs
            (1 parsec = {LIGHT_YEARS_PER_PARSEC} light-years).
            {distance.status === 'derived' && <span className="ml-1.5 text-amber-300">(derived)</span>}
          </p>
        </>
      );
    }
  } else if (step === 2) {
    const years = periodInEarthYears(period.value);
    if (years === null || period.status === 'not_measured') body = notMeasured('orbital period');
    else if (isLimit(period)) body = limitOnly(period, 'days');
    else {
      const d = period.value!;
      const sentence =
        years < 0.95
          ? `One year on ${name} lasts ${plainNumber(d)} Earth days. It goes round its star about ${plainNumber(1 / years)} times while Earth goes round the Sun once.`
          : years > 1.05
          ? `One year on ${name} lasts ${plainNumber(d)} Earth days, about ${plainNumber(years)} of our years.`
          : `One year on ${name} lasts ${plainNumber(d)} Earth days, close to Earth's ${EARTH_YEAR_DAYS}.`;
      body = (
        <>
          <YearPicture periodDays={d} />
          <p className="mt-2 text-base text-slate-100">{estimatedPrefix(period)}{sentence}</p>
          <StatusNote m={period} unitLabel="days (orbital period)" />
        </>
      );
    }
  } else {
    body = (
      <>
        <p className="text-base text-slate-100">
          You have met {name}. Share it with its real sky image, or look around its star.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void share()} disabled={sharing} className="sky-btn" title="Saves the captioned sky image (PNG) of this planet's star">
            <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {sharing ? 'Capturing…' : 'Share this world'}
          </button>
          <button type="button" onClick={() => void copyLink()} className="sky-btn" title="Copies a link that opens this planet directly">
            <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
            Copy link
          </button>
          <button type="button" onClick={onExploreSky} className="sky-btn">
            <Telescope className="w-3.5 h-3.5" aria-hidden="true" />
            Explore its sky
          </button>
        </div>
        {shareNote && (
          <p className="mt-2 text-xs text-slate-300" role="status">
            {shareNote}
          </p>
        )}
      </>
    );
  }

  return (
    <section
      aria-labelledby="find-world-title"
      className="mb-4 px-5 py-4 rounded border border-slate-800 bg-[#161e2c]"
      data-testid="find-a-world"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="find-world-title" className="text-sm font-semibold text-cyan-200">
          Find a world · {name}
        </h2>
        <ol className="flex gap-1.5 text-[11px] text-slate-400" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={`px-2 py-0.5 rounded border ${
                i === step ? 'border-cyan-400 text-cyan-100' : i < step ? 'border-slate-600 text-slate-300' : 'border-slate-800'
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-3" aria-live="polite">
        <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-slate-50 focus:outline-none">
          {done ? 'Share this world' : STEPS[step]}
        </h3>
        <div className="mt-2">{body}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="sky-btn">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back
          </button>
        )}
        {!done ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="sky-btn" data-testid="find-world-next">
            Next <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={() => setStep(0)} className="sky-btn">
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Start again
          </button>
        )}
      </div>
    </section>
  );
};
