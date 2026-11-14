/**
 * HiPS survey catalogue and mirror resolution for the sky viewer.
 *
 * Why this exists: given a bare CDS identifier such as "P/DSS2/color", Aladin Lite resolves it
 * through the CDS MocServer and its first-choice tile host. When that host or the MocServer is
 * unreachable from the viewer's network, Aladin rejects internally and the canvas stays gray
 * with "… loading" forever (reproduced in Chrome, Nov 2026). We therefore probe each mirror's
 * `properties` file ourselves and hand Aladin a verified HiPS base URL, or report a clear error.
 */

export interface HipsSurvey {
  /** CDS HiPS identifier (stable name, used in permalinks). */
  id: string;
  label: string;
  /** Plain-language description shown under the survey selector. */
  description: string;
  /** Tile base URLs in order of preference. All serve the same HiPS. */
  mirrors: string[];
  /** Default image credit if the mirror's properties file does not provide one. */
  credit: string;
}

export const HIPS_SURVEYS: HipsSurvey[] = [
  {
    id: 'P/DSS2/color',
    label: 'DSS2 colour (visible light)',
    description: 'Digitized Sky Survey photographic plates, whole sky. Best default.',
    mirrors: [
      'https://alasky.cds.unistra.fr/DSS/DSSColor',
      'https://alaskybis.cds.unistra.fr/DSS/DSSColor',
      'https://skies.esac.esa.int/DSSColor',
    ],
    credit: 'DSS2 colour HiPS: STScI/NASA, colored & healpixed by CDS',
  },
  {
    id: 'P/2MASS/color',
    label: '2MASS colour (near-infrared)',
    description: 'Two Micron All Sky Survey. Cool and dust-obscured stars stand out.',
    mirrors: [
      'https://alasky.cds.unistra.fr/2MASS/Color',
      'https://alaskybis.cds.unistra.fr/2MASS/Color',
      'https://skies.esac.esa.int/2MASSColor',
    ],
    credit: '2MASS colour HiPS: University of Massachusetts / IPAC-Caltech, healpixed by CDS',
  },
  {
    id: 'P/allWISE/color',
    label: 'AllWISE colour (mid-infrared)',
    description: 'NASA WISE mission, whole sky at lower resolution.',
    mirrors: [
      'https://alasky.cds.unistra.fr/AllWISE/RGB-W4-W2-W1',
      'https://alaskybis.cds.unistra.fr/AllWISE/RGB-W4-W2-W1',
      'https://skies.esac.esa.int/AllWISEColor',
    ],
    credit: 'AllWISE colour HiPS: NASA/JPL-Caltech/UCLA, healpixed by CDS',
  },
  {
    id: 'P/PanSTARRS/DR1/color-z-zg-g',
    label: 'Pan-STARRS colour (visible, sharper)',
    description: 'Higher resolution, but only covers the sky north of declination −30°.',
    mirrors: [
      'https://alasky.cds.unistra.fr/Pan-STARRS/DR1/color-z-zg-g',
      'https://alaskybis.cds.unistra.fr/Pan-STARRS/DR1/color-z-zg-g',
    ],
    credit: 'Pan-STARRS DR1 colour HiPS: PS1 Science Consortium, healpixed by CDS',
  },
];

export const DEFAULT_SURVEY_ID = HIPS_SURVEYS[0].id;

export function findSurvey(id: string): HipsSurvey {
  return HIPS_SURVEYS.find((s) => s.id === id) ?? HIPS_SURVEYS[0];
}

export interface ResolvedHips {
  surveyId: string;
  baseUrl: string;
  title: string;
  credit: string;
}

export class HipsUnavailableError extends Error {
  readonly attempts: string[];
  constructor(survey: HipsSurvey, attempts: string[]) {
    super(
      `Could not reach any image server for "${survey.label}". ` +
        'The sky survey tile servers (CDS Strasbourg / ESA) did not respond from this network.'
    );
    this.name = 'HipsUnavailableError';
    this.attempts = attempts;
  }
}

/** Parses a HiPS `properties` file (key = value lines). */
export function parseHipsProperties(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trimStart().startsWith('#')) out[m[1]] = m[2];
  }
  return out;
}

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

/**
 * Probes every mirror's `properties` file at once and returns the first one that answers with a
 * valid HiPS description, so one dead or slow mirror never delays the viewer. Each probe is bounded
 * by `timeoutMs`; when all fail, the error lists every attempt in mirror order.
 */
export async function resolveHipsMirror(
  survey: HipsSurvey,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
  timeoutMs = 6000
): Promise<ResolvedHips> {
  const attempts: string[] = new Array(survey.mirrors.length).fill('');
  const controllers = survey.mirrors.map(() => new AbortController());

  const probe = async (baseUrl: string, index: number): Promise<ResolvedHips> => {
    const controller = controllers[index];
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${baseUrl}/properties`, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const props = parseHipsProperties(await res.text());
      if (!props.hips_tile_format && !props.hips_order) throw new Error('not a HiPS properties file');
      return {
        surveyId: survey.id,
        baseUrl,
        title: props.obs_title || survey.label,
        credit: props.obs_copyright || survey.credit,
      };
    } catch (err) {
      const reason =
        err instanceof Error && err.name === 'AbortError'
          ? `no response within ${Math.round(timeoutMs / 1000)} s`
          : err instanceof Error && /^(HTTP|not a HiPS)/.test(err.message)
          ? err.message
          : 'network error';
      attempts[index] = `${baseUrl}: ${reason}`;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const winner = await Promise.any(survey.mirrors.map(probe));
    // Stop the slower probes; their results are no longer needed.
    controllers.forEach((c) => c.abort());
    return winner;
  } catch {
    throw new HipsUnavailableError(survey, attempts);
  }
}

/** True for HiPS image tile URLs (any host): .../NorderK/DirD/NpixN.ext or .../NorderK/Allsky.ext */
export function isHipsTileUrl(url: string, baseUrl?: string): boolean {
  if (baseUrl && !url.startsWith(baseUrl)) return false;
  return /\/Norder\d+\/(Dir\d+\/Npix\d+|Allsky)\.(jpg|jpeg|png|webp|fits)(\?|$)/i.test(url);
}
