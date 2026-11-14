import React from 'react';
import { BookmarkPlus, ExternalLink, RotateCw } from 'lucide-react';
import {
  DataSourceMode,
  ExoplanetDetail,
  ParameterSnapshot,
  ScientificMeasurement,
} from '../api/contracts';
import { formatDecDms, formatDeg, formatRaHms } from '../utils/coordinates';
import { formatMeasurementValue, friendlyUnit } from '../utils/measurementFormat';

interface ExoplanetDetailPanelProps {
  mode: DataSourceMode;
  target: ExoplanetDetail | null;
  loading: boolean;
  error: string | null;
  onPinToNotebook: (snapshot: ParameterSnapshot) => void;
  onRetry: () => void;
}

const MeasurementRow: React.FC<{
  label: string;
  measurement: ScientificMeasurement<number>;
}> = ({ label, measurement }) => {
  const renderValue = () => {
    if (measurement.value === null || measurement.status === 'not_measured') {
      return (
        <div>
          <span className="text-slate-500 italic">Not measured</span>
          {measurement.unavailableReason && (
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              {measurement.unavailableReason}
            </p>
          )}
        </div>
      );
    }

    const valueText = formatMeasurementValue(measurement);

    const statusTag =
      measurement.status === 'derived' ? (
        <span className="ml-1.5 text-[10px] font-sans text-amber-300">(derived)</span>
      ) : null;

    return (
      <div>
        <div className="font-mono tabular-nums text-slate-100">
          <span>{valueText}</span>
          <span className="text-[11px] text-slate-400 ml-1.5">{measurement.unit}</span>
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
        {label}
      </th>
      <td className="py-2 text-left align-top">{renderValue()}</td>
    </tr>
  );
};

/** One of the three headline numbers: big value, plain-language unit, its source underneath. */
const KeyFact: React.FC<{ label: string; measurement: ScientificMeasurement<number> }> = ({
  label,
  measurement,
}) => {
  const valueText = formatMeasurementValue(measurement);
  return (
    <div className="p-3 rounded border border-slate-800 bg-[#07090E]">
      <div className="text-[11px] text-slate-400">{label}</div>
      {valueText === null ? (
        <div className="mt-1 text-sm text-slate-500 italic">Not measured</div>
      ) : (
        <div className="mt-1 font-mono tabular-nums text-slate-100">
          <span className="text-base font-semibold">{valueText}</span>{' '}
          <span className="text-[11px] text-slate-400">{friendlyUnit(measurement.unit)}</span>
        </div>
      )}
      {measurement.referenceLabel && (
        <div className="mt-1 text-[10px] text-slate-500 truncate" title={measurement.referenceLabel}>
          Source: {measurement.referenceLabel}
        </div>
      )}
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
}) => {
  if (error) {
    return (
      <section
        className="bg-[#0F151E] border border-slate-800 rounded"
        aria-labelledby="detail-panel-title"
      >
        <div className="px-4 py-3 border-b border-slate-800 bg-[#121A25]">
          <h2 id="detail-panel-title" className="text-xs font-semibold tracking-wide text-slate-100">
            Target Physical &amp; Orbital Parameters
          </h2>
        </div>
        <div className="p-4">
          <div
            className="p-3 rounded border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs flex flex-col gap-2"
            role="alert"
          >
            <div>
              <strong className="block text-rose-100 mb-0.5">Target Detail Unavailable</strong>
              <span>{error}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-rose-400/50 hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3 h-3" aria-hidden="true" />
                <span>Retry Target Fetch</span>
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
        className="bg-[#0F151E] border border-slate-800 rounded"
        aria-labelledby="detail-panel-title"
      >
        <div className="px-4 py-3 border-b border-slate-800 bg-[#121A25]">
          <h2 id="detail-panel-title" className="text-xs font-semibold tracking-wide text-slate-100">
            Target Physical &amp; Orbital Parameters
          </h2>
        </div>
        <div className="p-4">
          <div
            className="p-6 rounded border border-dashed border-slate-700 text-center text-xs text-slate-400"
            aria-busy="true"
          >
            Loading scientific parameter record…
          </div>
        </div>
      </section>
    );
  }

  if (!target) {
    return (
      <section
        className="bg-[#0F151E] border border-slate-800 rounded"
        aria-labelledby="detail-panel-title"
      >
        <div className="px-4 py-3 border-b border-slate-800 bg-[#121A25]">
          <h2 id="detail-panel-title" className="text-xs font-semibold tracking-wide text-slate-100">
            Target Physical &amp; Orbital Parameters
          </h2>
        </div>
        <div className="p-4">
          <div className="p-6 rounded border border-dashed border-slate-700 text-center text-xs text-slate-400">
            Select a target from the catalog search panel to inspect empirical measurements.
          </div>
        </div>
      </section>
    );
  }

  const handlePin = () => {
    onPinToNotebook({
      planetName: target.planetName,
      hostname: target.hostStar.hostname,
      raDeg: target.hostStar.raDeg,
      decDeg: target.hostStar.decDeg,
      periodDays: target.orbitalParameters.periodDays.value,
      radiusEarth: target.planetaryParameters.radiusEarth.value,
      massEarth: target.planetaryParameters.massEarth.value,
      massIsMsini: target.planetaryParameters.massIsMsini,
      capturedFromMode: 'live',
    });
  };

  return (
    <section
      className="bg-[#0F151E] border border-slate-800 rounded flex flex-col"
      aria-labelledby="detail-panel-title"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-[#121A25]">
        <h2 id="detail-panel-title" className="text-xs font-semibold tracking-wide text-slate-100">
          {target.planetName} — Scientific Record
        </h2>
        <button
          type="button"
          onClick={handlePin}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-slate-700 bg-[#07090E] text-cyan-300 hover:border-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Log to Notebook</span>
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 text-xs">
        {/* Overview: the three numbers a first-time visitor needs */}
        <div>
          <p className="text-slate-300">
            Orbits <span className="text-slate-100 font-medium">{target.hostStar.hostname}</span>
            {target.discoveryMethod !== 'Not recorded' &&
              ` · found by ${target.discoveryMethod.toLowerCase()}`}
            {target.discoveryYear ? ` in ${target.discoveryYear}` : ''}
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <KeyFact label="Radius" measurement={target.planetaryParameters.radiusEarth} />
            <KeyFact
              label={target.planetaryParameters.massIsMsini ? 'Min. mass (M sin i)' : 'Mass'}
              measurement={target.planetaryParameters.massEarth}
            />
            <KeyFact label="Orbital period" measurement={target.orbitalParameters.periodDays} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Values from the NASA Exoplanet Archive; each comes from the publication named under it.
          </p>
        </div>

        <details className="group rounded border border-slate-800">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-cyan-300 hover:text-cyan-200">
            All scientific parameters (discovery, planet, orbit, host star, uncertainties, references)
          </summary>
          <div className="p-3 pt-1 flex flex-col gap-5">
        {/* Discovery Metadata */}
        <div className="pb-3 border-b border-slate-800 space-y-1 text-slate-300">
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
            <span className="text-slate-400">Source Table:</span>{' '}
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
          <h3 className="text-xs font-semibold text-cyan-300 mb-1.5">Planetary Parameters</h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              <MeasurementRow
                label="Planet Radius (Rp)"
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
                measurement={target.planetaryParameters.massEarth}
              />
              <MeasurementRow
                label="Equilibrium Temp (Teq)"
                measurement={target.planetaryParameters.equilibriumTempK}
              />
              <MeasurementRow
                label="Insolation Flux (S)"
                measurement={target.planetaryParameters.insolationFluxEarth}
              />
              <MeasurementRow
                label="Bulk Density (ρp)"
                measurement={target.planetaryParameters.bulkDensityGcm3}
              />
            </tbody>
          </table>
        </div>

        {/* Orbital Parameters */}
        <div>
          <h3 className="text-xs font-semibold text-cyan-300 mb-1.5">Orbital Parameters</h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              <MeasurementRow
                label="Orbital Period (P)"
                measurement={target.orbitalParameters.periodDays}
              />
              <MeasurementRow
                label="Semi-Major Axis (a)"
                measurement={target.orbitalParameters.semiMajorAxisAu}
              />
              <MeasurementRow
                label="Eccentricity (e)"
                measurement={target.orbitalParameters.eccentricity}
              />
              <MeasurementRow
                label="Inclination (i)"
                measurement={target.orbitalParameters.inclinationDeg}
              />
              <MeasurementRow
                label="Transit Duration (T14)"
                measurement={target.orbitalParameters.transitDurationHours}
              />
            </tbody>
          </table>
        </div>

        {/* Host Star Parameters */}
        <div>
          <h3 className="text-xs font-semibold text-cyan-300 mb-1.5">
            Host Star ({target.hostStar.hostname})
          </h3>
          <table className="w-full border-collapse text-xs">
            <tbody>
              <tr className="border-b border-slate-800/80">
                <th
                  scope="row"
                  className="py-2 pr-3 text-left font-normal text-slate-400 align-top w-[44%]"
                >
                  ICRS Coordinates (J2000)
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
              <MeasurementRow label="Distance (d)" measurement={target.hostStar.distancePc} />
              <MeasurementRow label="Effective Temp (Teff)" measurement={target.hostStar.teffK} />
              <MeasurementRow label="Stellar Mass (M★)" measurement={target.hostStar.massSolar} />
              <MeasurementRow
                label="Stellar Radius (R★)"
                measurement={target.hostStar.radiusSolar}
              />
              <MeasurementRow
                label="Metallicity [Fe/H]"
                measurement={target.hostStar.metallicityFeH}
              />
              <MeasurementRow label="V Magnitude (V)" measurement={target.hostStar.vMag} />
            </tbody>
          </table>
        </div>
          </div>
        </details>
      </div>
    </section>
  );
};
