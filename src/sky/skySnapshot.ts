/**
 * Metadata, footer text and links that accompany an exported sky view. Everything here is
 * derived from the selected archive record and the survey that was actually displayed;
 * nothing is invented if a value is missing.
 */

export interface SkyViewMetadata {
  schemaVersion: 'orbit-os.sky-view.v1';
  planetName: string;
  hostName: string;
  raDeg: number | null;
  decDeg: number | null;
  fieldOfViewDeg: number;
  survey: { id: string; title: string; tileBaseUrl: string | null; credit: string };
  capturedAtUtc: string;
  imageryConfirmed: boolean;
  aladinLitePermalink: string | null;
  notes: string[];
}

export const SKY_VIEW_NOTES = [
  'The image shows the sky around the host star at its catalogue position. ' +
    'It is not a photograph of the planet, which is far too faint and close to its star to appear in survey images.',
  'Survey images were taken at older epochs; stars with high proper motion can appear offset from the marker.',
  'Coordinates are the NASA Exoplanet Archive pscomppars values (ICRS, J2000, decimal degrees).',
];

export function aladinPermalink(
  raDeg: number | null,
  decDeg: number | null,
  fovDeg: number,
  surveyId: string
): string | null {
  if (raDeg === null || decDeg === null) return null;
  const params = new URLSearchParams({
    target: `${raDeg.toFixed(6)} ${decDeg >= 0 ? '+' : ''}${decDeg.toFixed(6)}`,
    fov: String(fovDeg),
    survey: surveyId,
  });
  return `https://aladin.cds.unistra.fr/AladinLite/?${params.toString()}`;
}

export function buildSkyViewMetadata(input: {
  planetName: string;
  hostName: string;
  raDeg: number | null;
  decDeg: number | null;
  fieldOfViewDeg: number;
  surveyId: string;
  surveyTitle: string;
  tileBaseUrl: string | null;
  credit: string;
  imageryConfirmed: boolean;
  now?: Date;
}): SkyViewMetadata {
  return {
    schemaVersion: 'orbit-os.sky-view.v1',
    planetName: input.planetName,
    hostName: input.hostName,
    raDeg: input.raDeg,
    decDeg: input.decDeg,
    fieldOfViewDeg: input.fieldOfViewDeg,
    survey: {
      id: input.surveyId,
      title: input.surveyTitle,
      tileBaseUrl: input.tileBaseUrl,
      credit: input.credit,
    },
    capturedAtUtc: (input.now ?? new Date()).toISOString(),
    imageryConfirmed: input.imageryConfirmed,
    aladinLitePermalink: aladinPermalink(
      input.raDeg,
      input.decDeg,
      input.fieldOfViewDeg,
      input.surveyId
    ),
    notes: SKY_VIEW_NOTES,
  };
}

/** Lines printed under the image in the PNG export. */
export function skyFooterLines(meta: SkyViewMetadata): string[] {
  const coord =
    meta.raDeg === null || meta.decDeg === null
      ? 'Coordinates not reported'
      : `RA ${meta.raDeg.toFixed(5)}°  Dec ${meta.decDeg >= 0 ? '+' : ''}${meta.decDeg.toFixed(5)}° (ICRS J2000)`;
  return [
    `${meta.planetName} — host star ${meta.hostName}`,
    `${coord}  ·  field of view ${meta.fieldOfViewDeg}°`,
    `Survey: ${meta.survey.title} (${meta.survey.id})  ·  ${meta.survey.credit}`,
    `Captured ${meta.capturedAtUtc} · Aladin Lite (CDS) · coordinates: NASA Exoplanet Archive`,
    'Marker = host star position. The planet itself is not visible in this image.',
  ];
}

export function skyFileStem(planetName: string): string {
  const slug = planetName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'target';
  return `orbit-os_${slug}_sky`;
}
