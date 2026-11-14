import React from 'react';
import { BookmarkPlus, ExternalLink, RotateCw } from 'lucide-react';
import {
  DataSourceMode,
  ExoplanetDetail,
  ParameterSnapshot,
  ScientificMeasurement,
} from '../api/contracts';
import { formatDecDms, formatRaHms } from '../utils/coordinates';

interface ExoplanetDetailPanelProps {
  mode: DataSourceMode;
  target: ExoplanetDetail | null;
  loading: boolean;
  error: string | null;
  onPinToNotebook: (snapshot: ParameterSnapshot) => void;
  onRetry: () => void;
  onSwitchToFixture?: () => void;
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

    const prefix =
      measurement.status === 'upper_limit'
        ? '< '
        : measurement.status === 'lower_limit'
        ? '> '
        : '';

    let errDisplay = '';
    if (measurement.errPlus !== null && measurement.errPlus !== undefined) {
      errDisplay = measurement.isSymmetricErr
        ? ` ± ${measurement.errPlus}`
        : ` (+${measurement.errPlus} / -${measurement.errMinus ?? '?'})`;
    }

    const statusTag =
      measurement.status === 'derived' ? (
        <span className="ml-1.5 text-[10px] font-sans text-amber-300">(derived)</span>
      ) : null;

    return (
      <div>
        <div className="font-mono tabular-nums text-slate-100">
          <span>
            {prefix}
            {measurement.value}
            {errDisplay}
          </span>
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

export const ExoplanetDetailPanel: React.FC<ExoplanetDetailPanelProps> = ({
  mode,
  target,
  loading,
  error,
  onPinToNotebook,
  onRetry,
  onSwitchToFixture,
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
              {mode === 'live' && onSwitchToFixture && (
                <button
                  type="button"
                  onClick={onSwitchToFixture}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 transition-colors cursor-pointer"
                >
                  Open Demonstration Fixture
                </button>
              )}
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
      capturedFromMode: target.archiveRecordTable.startsWith('REFERENCE_FIXTURE')
        ? 'reference_fixture'
        : 'live',
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

      <div className="p-4 flex flex-col gap-5 text-xs">
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
                    {target.hostStar.raDeg.toFixed(6)}°, {target.hostStar.decDeg.toFixed(6)}°
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
    </section>
  );
};
