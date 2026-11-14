import {
  DataSourceMode,
  DataSourceStatus,
  ExoplanetDetail,
  NotebookEntry,
  ScientificMeasurement,
} from '../api/contracts';
import { formatDecDms, formatRaHms } from './coordinates';

export interface EvidenceBundle {
  schemaVersion: 'orbit-os.evidence.v1';
  generatedAtUtc: string;
  dataSourceMode: DataSourceMode;
  warningBanner: string | null;
  target: ExoplanetDetail;
  notebookEntries: NotebookEntry[];
  provenanceSources: DataSourceStatus[];
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
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
    warningBanner:
      mode === 'reference_fixture'
        ? 'DEMONSTRATION MODE: Generated from static reference fixture, not a live backend archive query.'
        : null,
    target,
    notebookEntries,
    provenanceSources,
  };
}

export function serializeBundleToCsv(bundle: EvidenceBundle): string {
  const { target } = bundle;
  const rows: Array<[string, string, string, string, string, string, string, string]> = [
    [
      'category',
      'parameter',
      'value',
      'unit',
      'err_plus',
      'err_minus',
      'status',
      'reference_or_note',
    ],
  ];

  const pushMeasurement = (
    category: string,
    label: string,
    m: ScientificMeasurement<number>
  ) => {
    rows.push([
      category,
      label,
      m.value !== null ? String(m.value) : '',
      m.unit,
      m.errPlus !== null && m.errPlus !== undefined ? String(m.errPlus) : '',
      m.errMinus !== null && m.errMinus !== undefined ? String(m.errMinus) : '',
      m.status,
      m.referenceLabel ?? m.unavailableReason ?? '',
    ]);
  };

  rows.push([
    'metadata',
    'planet_name',
    target.planetName,
    '',
    '',
    '',
    'measured',
    target.archiveRecordTable,
  ]);
  rows.push([
    'metadata',
    'data_source_mode',
    bundle.dataSourceMode,
    '',
    '',
    '',
    'derived',
    bundle.generatedAtUtc,
  ]);
  rows.push(['host_star', 'hostname', target.hostStar.hostname, '', '', '', 'measured', '']);
  rows.push([
    'host_star',
    'ra_icrs_deg',
    String(target.hostStar.raDeg),
    'deg',
    '',
    '',
    'measured',
    formatRaHms(target.hostStar.raDeg),
  ]);
  rows.push([
    'host_star',
    'dec_icrs_deg',
    String(target.hostStar.decDeg),
    'deg',
    '',
    '',
    'measured',
    formatDecDms(target.hostStar.decDeg),
  ]);
  pushMeasurement('host_star', 'distance', target.hostStar.distancePc);
  pushMeasurement('host_star', 'effective_temperature', target.hostStar.teffK);
  pushMeasurement('host_star', 'stellar_mass', target.hostStar.massSolar);
  pushMeasurement('host_star', 'stellar_radius', target.hostStar.radiusSolar);
  pushMeasurement('host_star', 'metallicity_feh', target.hostStar.metallicityFeH);
  pushMeasurement('host_star', 'v_magnitude', target.hostStar.vMag);

  pushMeasurement('planet', 'radius_earth', target.planetaryParameters.radiusEarth);
  pushMeasurement(
    'planet',
    target.planetaryParameters.massIsMsini ? 'mass_sin_i_earth' : 'mass_earth',
    target.planetaryParameters.massEarth
  );
  pushMeasurement('planet', 'equilibrium_temp', target.planetaryParameters.equilibriumTempK);
  pushMeasurement('planet', 'insolation_flux', target.planetaryParameters.insolationFluxEarth);
  pushMeasurement('planet', 'bulk_density', target.planetaryParameters.bulkDensityGcm3);

  pushMeasurement('orbit', 'orbital_period', target.orbitalParameters.periodDays);
  pushMeasurement('orbit', 'semi_major_axis', target.orbitalParameters.semiMajorAxisAu);
  pushMeasurement('orbit', 'eccentricity', target.orbitalParameters.eccentricity);
  pushMeasurement('orbit', 'inclination', target.orbitalParameters.inclinationDeg);
  pushMeasurement('orbit', 'transit_duration', target.orbitalParameters.transitDurationHours);

  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

export function serializeBundleToMarkdown(bundle: EvidenceBundle): string {
  const { target } = bundle;
  const formatVal = (m: ScientificMeasurement<number>) => {
    if (m.value === null) return `Not measured (${m.unavailableReason ?? 'unavailable'})`;
    const err =
      m.errPlus !== null && m.errPlus !== undefined
        ? m.isSymmetricErr
          ? ` ± ${m.errPlus}`
          : ` (+${m.errPlus} / -${m.errMinus ?? '?'})`
        : '';
    return `${m.value}${err} ${m.unit}`;
  };

  const lines: string[] = [
    `# ORBIT OS Evidence Brief: ${target.planetName}`,
    '',
    `- **Generated (UTC):** ${bundle.generatedAtUtc}`,
    `- **Source Mode:** \`${bundle.dataSourceMode}\`${
      bundle.warningBanner ? ` — **${bundle.warningBanner}**` : ''
    }`,
    `- **Archive Table:** ${target.archiveRecordTable}`,
    `- **Discovery:** ${target.discoveryMethod} (${target.discoveryYear}), ${target.discoveryFacility}`,
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
    )}\` / \`${formatDecDms(target.hostStar.decDeg)}\` (${target.hostStar.raDeg.toFixed(
      6
    )}°, ${target.hostStar.decDeg.toFixed(6)}°)`,
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
  URL.revokeObjectURL(url);
}
