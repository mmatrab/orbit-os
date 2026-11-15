import React from 'react';
import { BookmarkPlus, Download, ExternalLink, RotateCw } from 'lucide-react';
import {
  DataSourceMode,
  ExoplanetDetail,
  ParameterSnapshot,
  ScientificMeasurement,
} from '../api/contracts';
import { formatDecDms, formatDeg, formatRaHms } from '../utils/coordinates';
import { formatMeasurementValue, friendlyUnit } from '../utils/measurementFormat';
import { snapshotOf } from '../utils/snapshot';

interface ExoplanetDetailPanelProps {
  mode: DataSourceMode;
  target: ExoplanetDetail | null;
  loading: boolean;
  error: string | null;
  onPinToNotebook: (snapshot: ParameterSnapshot) => void;
  onRetry: () => void;
  /** 'overview' = headline facts + actions; 'advanced' = full parameter tables (collapsed). */
  view?: 'overview' | 'advanced';
  onOpenExport?: () => void;
  /** Which planet tab is open; the overview card shows the tab bar and, on 'overview', the key facts. */
  planetTab?: PlanetTab;
  onPlanetTabChange?: (tab: PlanetTab) => void;
}

export type PlanetTab = 'overview' | 'data';

/** Plain-language explanations shown under each parameter name. Standard reference values only. */
export const PARAMETER_HINTS = {
  radius: "Size compared with Earth (1 = Earth's radius, about 6,371 km).",
  mass: "Amount of matter compared with Earth (1 = Earth's mass).",
  msini:
    'Minimum mass. The radial-velocity method cannot see how the orbit is tilted, so the true mass is this value or larger.',
  teq: 'Temperature the planet would have from starlight alone, ignoring its atmosphere. Kelvin: 273 K = 0 °C.',
  insolation: 'Starlight reaching the planet compared with what Earth receives from the Sun (1 = Earth).',
  density: 'Mass divided by volume. Earth is about 5.5 g/cm³; water is 1.',
  period: "Time for one full orbit (the planet's year), in Earth days.",
  sma: 'Average distance from the star in astronomical units (1 AU = Earth–Sun distance).',
  ecc: 'How stretched the orbit is: 0 is a circle, values near 1 are very elongated.',
  incl: 'Tilt of the orbit seen from Earth; 90° is edge-on, which is what allows transits.',
  t14: 'How long the planet takes to cross in front of its star, in hours.',
  coords: 'Position on the sky: right ascension and declination (ICRS frame, epoch J2000).',
  distance: 'Distance from the Sun in parsecs (1 pc ≈ 3.26 light-years).',
  teff: 'Surface temperature of the star in kelvin. The Sun is about 5,772 K.',
  mstar: 'Mass of the star compared with the Sun (1 = one solar mass).',
  rstar: 'Radius of the star compared with the Sun (1 = one solar radius).',
  feh: 'Heavy-element content relative to the Sun, in dex: 0 = solar, +0.3 ≈ twice solar.',
  vmag: 'Apparent brightness in visible light. Larger numbers are fainter; the naked-eye limit is about 6.',
} as const;

const MeasurementRow: React.FC<{
  label: string;
  hint?: string;
  measurement: ScientificMeasurement<number>;
}> = ({ label, hint, measurement }) => {
  const renderValue = () => {
    if (measurement.value === null || measurement.status === 'not_measured') {
      return (
        <span className="text-slate-500 italic" title={measurement.unavailableReason ?? undefined}>
          Not measured
        </span>
      );
    }

    const valueText = formatMeasurementValue(measurement);

    const statusTag =
      measurement.status === 'derived' ? (
        <span
          className="ml-1.5 text-[10px] font-sans text-amber-300"
          title="Calculated by the NASA Exoplanet Archive from other values, not measured directly."
        >
          (derived)
        </span>
      ) : null;

    return (
      <div>
        <div className="font-mono tabular-nums text-slate-100">
          <span>{valueText}</span>
          <span className="text-[11px] text-slate-400 ml-1.5">{friendlyUnit(measurement.unit)}</span>
          {statusTag}
        </div>
        {measurement.referenceLabel && (
          <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>Ref: {measurement.referenceLabel}</span>
            {measurement.referenceBibcode && (
              <a
                href={`https://ui.adsabs.harvard.edu/abs/${encodeURIComponent(
                  measurement.referenceBibcode
                )}/abstract`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-mono text-[10px] text-cyan-400 hover:text-cyan-300"
              >
                <span>ADS</span>
                <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <tr className="border-b border-slate-800/80 last:border-b-0">
      <th
        scope="row"
        className="py-2 pr-3 text-left font-normal text-slate-400 align-top w-[44%]"
      >
        <span className="text-slate-300">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{hint}</span>}
      </th>
      <td className="py-2 text-left align-top">{renderValue()}</td>
    </tr>
  );
};

/** One of the three headline numbers: big value, plain-language unit, its source underneath. */
const KeyFact: React.FC<{ label: string; hint: string; measurement: ScientificMeasurement<number> }> = ({
  label,
  hint,
  measurement,
}) => {
  const valueText = formatMeasurementValue(measurement);
  return (
    <div className="p-3 rounded border border-slate-800 bg-[#0e1420]">
      <div className="text-xs font-medium text-slate-300">{label}</div>
      {valueText === null ? (
        <div className="mt-1 text-sm text-slate-500 italic">Not measured</div>
      ) : (
        <div className="mt-1 font-mono tabular-nums text-slate-100">
          <span className="text-lg font-semibold">{valueText}</span>{' '}
          <span className="text-[11px] text-slate-400">{friendlyUnit(measurement.unit)}</span>
          {measurement.status === 'derived' && (
            <span
              className="ml-1 text-[10px] font-sans text-amber-300"
              title="Calculated by the NASA Exoplanet Archive from other values, not measured directly."
            >
              (derived)
            </span>
          )}
        </div>
      )}
      <p className="mt-1 text-[11px] text-slate-400 leading-snug">{hint}</p>
      {measurement.status === 'derived' ? (
        <div className="mt-1 text-[10px] text-amber-200/80">
          Estimated by the archive from other values, not measured.
        </div>
      ) : measurement.referenceLabel ? (
        <div className="mt-1 text-[10px] text-slate-500 truncate" title={measurement.referenceLabel}>
          Source: {measurement.referenceLabel}
        </div>
      ) : null}
    </div>
  );
};

export const ExoplanetDetailPanel: React.FC<ExoplanetDetailPanelProps> = ({
  mode,
  target,
  loading,
  error,
  onPinToNotebook,
  onRetry,
  view = 'overview',
  onOpenExport,
  planetTab = 'overview',
  onPlanetTabChange,
}) => {
  if (view === 'advanced' && (error || loading || !target)) return null;
  if (error) {
    return (
      <section
        className="bg-[#161e2c] border border-slate-800 rounded"
        aria-labelledby="detail-panel-title"
      >
        <div className="px-4 py-3 border-b border-slate-800 bg-[#1a2332]">
          <h2 id="detail-panel-title" className="text-xs font-semibold tracking-wide text-slate-100">
            Planet overview
          </h2>
        </div>
        <div className="p-4">
          <div
            className="p-3 rounded border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs flex flex-col gap-2"
            role="alert"
          >
            <div>
              <strong className="block text-rose-100 mb-0.5">Could not load this planet</strong>
              <span>{error}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-rose-400/50 hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3 h-3" aria-hidden="true" />
                <span>Try again</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section
        className="bg-[#161e2c] border border-slate-800 rounded"
        aria-labelledby="detail-panel-title"
      >
        <div className="px-4 py-3 border-b border-slate-800 bg-[#1a2332]">
          <h2 id="detail-panel-title" className="text-xs font-semibold tracking-wide text-slate-100">
            Planet overview
          </h2>
        </div>
        <div className="p-4">
          <div
            className="p-6 rounded border border-dashed border-slate-700 text-center text-xs text-slate-400"
            aria-busy="true"
          >
            Loading planet data from the NASA Exoplanet Archive…
          </div>
        </div>
      </section>
    );
  }

  if (!target) {
    return (
      <section
        className="bg-[#161e2c] border border-slate-800 rounded"
        aria-labelledby="detail-panel-title"
      >
        <div className="px-4 py-3 border-b border-slate-800 bg-[#1a2332]">
          <h2 id="detail-panel-title" className="text-xs font-semibold tracking-wide text-slate-100">
            Planet overview
          </h2>
        </div>
        <div className="p-4">
          <div className="p-6 rounded border border-dashed border-slate-700 text-center text-xs text-slate-400">
            Pick a planet from the results to see its size, mass, orbit and where its star is in the sky.
          </div>
        </div>
      </section>
    );
  }

  const handlePin = () => onPinToNotebook(snapshotOf(target));

  const massLabel = target.planetaryParameters.massIsMsini ? 'Minimum mass (M sin i)' : 'Mass';

  if (view === 'advanced') {
    return (
      <section
        id="planet-panel-data"
        role="tabpanel"
        aria-labelledby="planet-tab-data"
        className="bg-[#161e2c] border border-slate-800 rounded"
      >
        <div className="p-4 text-xs">
          <p className="mb-4 text-[11px] text-slate-400 max-w-3xl">
            Every value the archive holds for {target.planetName}, with its uncertainty and the paper it comes from.
            Values marked <span className="text-amber-300">(derived)</span> were calculated by the archive, not measured.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
        {/* Discovery Metadata */}
        <div className="lg:col-span-2 pb-3 border-b border-slate-800 space-y-1 text-slate-300">
          <h3 className="text-xs font-semibold text-cyan-300 mb-1.5">Discovery &amp; sources</h3>
          <div>
            <span className="text-slate-400">Discovery:</span>{' '}
            <span>
              {target.discoveryMethod} ({target.discoveryYear || '—'}) · {target.discoveryFacility}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="text-slate-400">Publication:</span>
            <span>{target.discoveryReference}</span>
            {target.discoveryDoi && (
              <a
                href={`https://doi.org/${target.discoveryDoi}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-400 hover:text-cyan-300"
              >
                <span>DOI:{target.discoveryDoi}</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </div>
          <div>
            <span className="text-slate-400">Archive table:</span>{' '}
            <span className="font-mono text-[11px] text-slate-300">
              {target.archiveRecordTable}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Composite values: each parameter may come from a different publication (see its
            reference). Do not combine them as one self-consistent solution.
          </p>
        </div>

        {/* Planetary Parameters */}
        <div>
          <h3 className="text-xs font-semibold text-cyan-300 mb-1.5">The planet</h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              <MeasurementRow
                label="Planet Radius (Rp)"
                hint={PARAMETER_HINTS.radius}
                measurement={target.planetaryParameters.radiusEarth}
              />
              <MeasurementRow
                label={
                  target.planetaryParameters.massIsMsini
                    ? 'Minimum Mass (Mp sin i)'
                    : target.planetaryParameters.massProvenance
                    ? `Planet Mass (${target.planetaryParameters.massProvenance})`
                    : 'Planet Mass (Mp)'
                }
                hint={target.planetaryParameters.massIsMsini ? PARAMETER_HINTS.msini : PARAMETER_HINTS.mass}
                measurement={target.planetaryParameters.massEarth}
              />
              <MeasurementRow
                label="Equilibrium Temp (Teq)"
                hint={PARAMETER_HINTS.teq}
                measurement={target.planetaryParameters.equilibriumTempK}
              />
              <MeasurementRow
                label="Insolation Flux (S)"
                hint={PARAMETER_HINTS.insolation}
                measurement={target.planetaryParameters.insolationFluxEarth}
              />
              <MeasurementRow
                label="Bulk Density (ρp)"
                hint={PARAMETER_HINTS.density}
                measurement={target.planetaryParameters.bulkDensityGcm3}
              />
            </tbody>
          </table>
        </div>

        {/* Orbital Parameters */}
        <div>
          <h3 className="text-xs font-semibold text-cyan-300 mb-1.5">Its orbit</h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              <MeasurementRow
                label="Orbital Period (P)"
                hint={PARAMETER_HINTS.period}
                measurement={target.orbitalParameters.periodDays}
              />
              <MeasurementRow
                label="Semi-Major Axis (a)"
                hint={PARAMETER_HINTS.sma}
                measurement={target.orbitalParameters.semiMajorAxisAu}
              />
              <MeasurementRow
                label="Eccentricity (e)"
                hint={PARAMETER_HINTS.ecc}
                measurement={target.orbitalParameters.eccentricity}
              />
              <MeasurementRow
                label="Inclination (i)"
                hint={PARAMETER_HINTS.incl}
                measurement={target.orbitalParameters.inclinationDeg}
              />
              <MeasurementRow
                label="Transit Duration (T14)"
                hint={PARAMETER_HINTS.t14}
                measurement={target.orbitalParameters.transitDurationHours}
              />
            </tbody>
          </table>
        </div>

        {/* Host Star Parameters */}
        <div>
          <h3 className="text-xs font-semibold text-cyan-300 mb-1.5">
            The host star ({target.hostStar.hostname})
          </h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr className="border-b border-slate-800/80">
                <th
                  scope="row"
                  className="py-2 pr-3 text-left font-normal text-slate-400 align-top w-[44%]"
                >
                  <span className="text-slate-300">Sky position</span>
                  <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{PARAMETER_HINTS.coords}</span>
                </th>
                <td className="py-2 font-mono tabular-nums text-slate-100">
                  <div>
                    {formatRaHms(target.hostStar.raDeg)} / {formatDecDms(target.hostStar.decDeg)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {formatDeg(target.hostStar.raDeg)}, {formatDeg(target.hostStar.decDeg)}
                  </div>
                </td>
              </tr>
              <tr className="border-b border-slate-800/80">
                <th
                  scope="row"
                  className="py-2 pr-3 text-left font-normal text-slate-400 align-top w-[44%]"
                >
                  Spectral Type
                </th>
                <td className="py-2 font-mono text-slate-100">
                  {target.hostStar.spectralType ?? (
                    <span className="text-slate-500 italic font-sans">Not recorded</span>
                  )}
                </td>
              </tr>
              {target.hostStar.gaiaDr3Id && (
                <tr className="border-b border-slate-800/80">
                  <th
                    scope="row"
                    className="py-2 pr-3 text-left font-normal text-slate-400 align-top w-[44%]"
                  >
                    Gaia DR3 ID
                  </th>
                  <td className="py-2 font-mono text-slate-100">{target.hostStar.gaiaDr3Id}</td>
                </tr>
              )}
              <MeasurementRow label="Distance (d)"
                hint={PARAMETER_HINTS.distance} measurement={target.hostStar.distancePc} />
              <MeasurementRow label="Effective Temp (Teff)"
                hint={PARAMETER_HINTS.teff} measurement={target.hostStar.teffK} />
              <MeasurementRow label="Stellar Mass (M★)"
                hint={PARAMETER_HINTS.mstar} measurement={target.hostStar.massSolar} />
              <MeasurementRow
                label="Stellar Radius (R★)"
                hint={PARAMETER_HINTS.rstar}
                measurement={target.hostStar.radiusSolar}
              />
              <MeasurementRow
                label="Metallicity [Fe/H]"
                hint={PARAMETER_HINTS.feh}
                measurement={target.hostStar.metallicityFeH}
              />
              <MeasurementRow label="V Magnitude (V)"
                hint={PARAMETER_HINTS.vmag} measurement={target.hostStar.vMag} />
            </tbody>
          </table>
        </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="bg-[#161e2c] border border-slate-800 rounded flex flex-col"
      aria-labelledby="detail-panel-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-[#1a2332]">
        <div>
          <h2 id="detail-panel-title" className="text-lg font-semibold text-slate-50">
            {target.planetName}
          </h2>
          <p className="text-xs text-slate-400">
            Orbits the star <span className="text-slate-200">{target.hostStar.hostname}</span>
            {target.hostStar.distancePc.value !== null &&
              ` · ${Math.round(target.hostStar.distancePc.value * 3.2616).toLocaleString('en-US')} light-years away`}
            {target.discoveryMethod !== 'Not recorded' && ` · found by ${target.discoveryMethod.toLowerCase()}`}
            {target.discoveryYear ? ` in ${target.discoveryYear}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handlePin} className="sky-btn" title="Save these values with a note in your research notebook">
            <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Save to notes</span>
          </button>
          {onOpenExport && (
            <button type="button" onClick={onOpenExport} className="sky-btn" title="Download JSON, CSV or a Markdown report">
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export data</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 px-3 border-b border-slate-800 bg-[#161e2c]" role="tablist" aria-label={`${target.planetName} views`}>
        {(
          [
            ['overview', 'Overview & sky'],
            ['data', 'All data & references'],
          ] as [PlanetTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            id={`planet-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={planetTab === id}
            aria-controls={`planet-panel-${id}`}
            onClick={() => onPlanetTabChange?.(id)}
            className={`px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              planetTab === id
                ? 'border-cyan-400 text-cyan-200'
                : 'border-transparent text-slate-400 hover:text-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {planetTab === 'overview' && (
      <div className="p-4 flex flex-col gap-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <KeyFact label="Radius" hint={PARAMETER_HINTS.radius} measurement={target.planetaryParameters.radiusEarth} />
          <KeyFact
            label={massLabel}
            hint={target.planetaryParameters.massIsMsini ? PARAMETER_HINTS.msini : PARAMETER_HINTS.mass}
            measurement={target.planetaryParameters.massEarth}
          />
          <KeyFact label="Orbital period" hint={PARAMETER_HINTS.period} measurement={target.orbitalParameters.periodDays} />
        </div>
        <p className="text-[11px] text-slate-500">
          Numbers after ± are the published uncertainties. Every other value is under{' '}
          <button
            type="button"
            className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200 cursor-pointer"
            onClick={() => onPlanetTabChange?.('data')}
          >
            All data &amp; references
          </button>
          .
        </p>
      </div>
      )}
    </section>
  );
};
