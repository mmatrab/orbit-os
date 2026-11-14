import {
  DataSourceMode,
  DataSourceStatus,
  ExoplanetDetail,
  NotebookEntry,
  ScientificMeasurement,
} from '../api/contracts';
import { formatDecDms, formatDeg, formatRaHms } from './coordinates';
import { exportStatus, formatMeasurementValue } from './measurementFormat';

export interface EvidenceBundle {
  schemaVersion: 'orbit-os.evidence.v1';
  generatedAtUtc: string;
  dataSourceMode: DataSourceMode;
  warningBanner: string | null;
  target: ExoplanetDetail;
  notebookEntries: NotebookEntry[];
  provenanceSources: DataSourceStatus[];
  /** Plain-language meaning of every `status` value used in this file. */
  statusLegend: Record<string, string>;
}

export const STATUS_LEGEND: Record<string, string> = {
  measured: 'Value as published in the cited reference (NASA Exoplanet Archive pscomppars).',
  derived:
    'Value calculated by the NASA Exoplanet Archive from other parameters (reference "Calculated Value", ' +
    'e.g. a radius from a mass-radius relation), or a mass the archive does not report as a direct measurement. Not a measurement.',
  limit_direction_unverified:
    'The archive flags this value as a limit, but whether it is an upper or lower limit has not been verified. ' +
    'raw_limit_flag / rawLimitFlag holds the untouched archive flag and rawLimitFlagColumn names the column it came from.',
  not_measured: 'No value is reported by the archive. Left empty; nothing is estimated.',
};

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Spreadsheet formula injection guard for text cells. Numbers such as "-0.13" are left untouched.
  const isNumeric = str.trim() !== '' && Number.isFinite(Number(str));
  if (!isNumeric && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildEvidenceBundle(
  target: ExoplanetDetail,
  mode: DataSourceMode,
  notebookEntries: NotebookEntry[],
  provenanceSources: DataSourceStatus[]
): EvidenceBundle {
  return {
    schemaVersion: 'orbit-os.evidence.v1',
    generatedAtUtc: new Date().toISOString(),
    dataSourceMode: mode,
    warningBanner: null,
    target,
    notebookEntries,
    provenanceSources,
    statusLegend: STATUS_LEGEND,
  };
}

export const CSV_HEADER = [
  'category',
  'parameter',
  'value',
  'unit',
  'err_plus',
  'err_minus',
  'status',
  'raw_limit_flag',
  'raw_limit_flag_column',
  'reference',
  'reference_bibcode',
  'doi',
  'note',
] as const;

export function serializeBundleToCsv(bundle: EvidenceBundle): string {
  const { target } = bundle;
  type Row = Array<string | number | null | undefined>;
  const rows: Row[] = [[...CSV_HEADER]];

  const info = (category: string, parameter: string, value: string | number | null, unit = '', note = '') =>
    rows.push([category, parameter, value, unit, '', '', 'identifier', '', '', '', '', '', note]);

  const measurement = (category: string, parameter: string, m: ScientificMeasurement<number>, note = '') =>
    rows.push([
      category,
      parameter,
      m.value,
      m.unit,
      m.errPlus ?? null,
      m.errMinus ?? null,
      exportStatus(m),
      m.rawLimitFlag ?? null,
      m.rawLimitFlagColumn ?? null,
      m.referenceLabel ?? null,
      m.referenceBibcode ?? null,
      m.doi ?? null,
      [note, m.value === null ? m.unavailableReason ?? '' : ''].filter(Boolean).join(' '),
    ]);

  info('metadata', 'planet_name', target.planetName);
  info('metadata', 'archive_table', target.archiveRecordTable, '', 'Composite: values may come from different references');
  info('metadata', 'retrieved_at_utc', target.retrievedAtUtc);
  info('metadata', 'exported_at_utc', bundle.generatedAtUtc);
  info('metadata', 'discovery_method', target.discoveryMethod);
  info('metadata', 'discovery_year', target.discoveryYear);
  info('host_star', 'hostname', target.hostStar.hostname);
  info('host_star', 'ra_icrs_deg', target.hostStar.raDeg, 'deg', formatRaHms(target.hostStar.raDeg));
  info('host_star', 'dec_icrs_deg', target.hostStar.decDeg, 'deg', formatDecDms(target.hostStar.decDeg));
  info('host_star', 'spectral_type', target.hostStar.spectralType ?? null);
  measurement('host_star', 'distance', target.hostStar.distancePc);
  measurement('host_star', 'effective_temperature', target.hostStar.teffK);
  measurement('host_star', 'stellar_mass', target.hostStar.massSolar);
  measurement('host_star', 'stellar_radius', target.hostStar.radiusSolar);
  measurement('host_star', 'metallicity_feh', target.hostStar.metallicityFeH);
  measurement('host_star', 'v_magnitude', target.hostStar.vMag);

  measurement('planet', 'radius', target.planetaryParameters.radiusEarth);
  measurement(
    'planet',
    target.planetaryParameters.massIsMsini ? 'minimum_mass_msini' : 'mass',
    target.planetaryParameters.massEarth,
    `archive pl_bmassprov: ${target.planetaryParameters.massProvenance ?? 'not reported'}.`
  );
  measurement('planet', 'equilibrium_temperature', target.planetaryParameters.equilibriumTempK);
  measurement('planet', 'insolation_flux', target.planetaryParameters.insolationFluxEarth);
  measurement('planet', 'bulk_density', target.planetaryParameters.bulkDensityGcm3);

  measurement('orbit', 'orbital_period', target.orbitalParameters.periodDays);
  measurement('orbit', 'semi_major_axis', target.orbitalParameters.semiMajorAxisAu);
  measurement('orbit', 'eccentricity', target.orbitalParameters.eccentricity);
  measurement('orbit', 'inclination', target.orbitalParameters.inclinationDeg);
  measurement('orbit', 'transit_duration', target.orbitalParameters.transitDurationHours);

  return rows.map((row) => row.map((c) => escapeCsvCell(c)).join(',')).join('\r\n') + '\r\n';
}

export function serializeBundleToMarkdown(bundle: EvidenceBundle): string {
  const { target } = bundle;
  const formatVal = (m: ScientificMeasurement<number>) => {
    const text = formatMeasurementValue(m);
    if (text === null) return `Not measured (${m.unavailableReason ?? 'unavailable'})`;
    const kind = m.status === 'derived' ? ' **(derived)**' : '';
    const ref = m.referenceBibcode ? ` — ref. ${m.referenceBibcode}` : m.referenceLabel ? ` — ${m.referenceLabel}` : '';
    return `${text} ${m.unit}${kind}${ref}`;
  };

  const lines: string[] = [
    `# ORBIT OS Evidence Brief: ${target.planetName}`,
    '',
    `- **Generated (UTC):** ${bundle.generatedAtUtc}`,
    `- **Source Mode:** \`${bundle.dataSourceMode}\`${
      bundle.warningBanner ? ` — **${bundle.warningBanner}**` : ''
    }`,
    `- **Archive Table:** ${target.archiveRecordTable}`,
    `- **Discovery:** ${target.discoveryMethod} (${target.discoveryYear ?? 'year not recorded'}), ${target.discoveryFacility}`,
    `- **Primary Reference:** ${target.discoveryReference}${
      target.discoveryDoi ? ` (DOI: ${target.discoveryDoi})` : ''
    }`,
    '',
    '## Host Star Astrometry & Properties',
    `- **Host Star:** ${target.hostStar.hostname} (${
      target.hostStar.spectralType ?? 'Spectral type unrecorded'
    })`,
    `- **Coordinates (ICRS J2000):** \`${formatRaHms(
      target.hostStar.raDeg
    )}\` / \`${formatDecDms(target.hostStar.decDeg)}\` (${formatDeg(
      target.hostStar.raDeg
    )}, ${formatDeg(target.hostStar.decDeg)})`,
    `- **Distance:** ${formatVal(target.hostStar.distancePc)}`,
    `- **Effective Temperature:** ${formatVal(target.hostStar.teffK)}`,
    `- **Mass / Radius:** ${formatVal(target.hostStar.massSolar)} / ${formatVal(
      target.hostStar.radiusSolar
    )}`,
    `- **Metallicity [Fe/H]:** ${formatVal(target.hostStar.metallicityFeH)}`,
    `- **V Magnitude:** ${formatVal(target.hostStar.vMag)}`,
    '',
    '## Planetary & Orbital Parameters',
    `- **Radius:** ${formatVal(target.planetaryParameters.radiusEarth)}`,
    `- **Mass${target.planetaryParameters.massIsMsini ? ' (M sin i)' : ''}:** ${formatVal(
      target.planetaryParameters.massEarth
    )}`,
    `- **Equilibrium Temp:** ${formatVal(target.planetaryParameters.equilibriumTempK)}`,
    `- **Insolation Flux:** ${formatVal(target.planetaryParameters.insolationFluxEarth)}`,
    `- **Bulk Density:** ${formatVal(target.planetaryParameters.bulkDensityGcm3)}`,
    `- **Orbital Period:** ${formatVal(target.orbitalParameters.periodDays)}`,
    `- **Semi-Major Axis:** ${formatVal(target.orbitalParameters.semiMajorAxisAu)}`,
    `- **Eccentricity:** ${formatVal(target.orbitalParameters.eccentricity)}`,
    `- **Inclination:** ${formatVal(target.orbitalParameters.inclinationDeg)}`,
    `- **Transit Duration:** ${formatVal(target.orbitalParameters.transitDurationHours)}`,
    '',
    `## Observation Notebook Entries (${bundle.notebookEntries.length})`,
    ...bundle.notebookEntries.flatMap((entry) => [
      `### [${entry.category}] ${entry.title}`,
      `- **UTC:** ${entry.createdAtUtc} | **Tags:** ${entry.tags.join(', ') || 'none'}`,
      '',
      entry.body,
      '',
    ]),
    '## How to read these values',
    '- Values are as published in the cited reference unless marked **(derived)**, which means the archive computed them from other parameters.',
    '- **Limit — direction unverified**: the archive flags the value as a limit, but whether it is an upper or lower bound has not been verified. See the JSON/CSV export for the raw archive flag.',
    '- **Not measured**: the archive reports no value; nothing has been estimated.',
    '- Units: Earth radii (R⊕), Earth masses (M⊕), days (d), parsecs (pc, 1 pc ≈ 3.26 light-years).',
    `- This is a composite record (${target.archiveRecordTable}): different parameters can come from different papers.`,
    '',
    '## Data Provenance & Acknowledgments',
    ...bundle.provenanceSources.map(
      (s) => `- **${s.name}** (${s.status}): ${s.citationText}`
    ),
  ];

  return lines.join('\n');
}

export function triggerTextDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
