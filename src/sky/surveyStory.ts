/**
 * Science-backed, captioned walkthrough of one real Aladin sky field.
 * This is an interactive educational sequence, NOT a prerecorded NASA video.
 * A step only claims to show a survey once its actual HiPS imagery has loaded.
 */
export const SURVEY_STORY = [
  {
    id: 'arrival',
    label: 'Find the host star',
    title: 'Where is this planet in the sky?',
    explanation: 'We travel through real telescope images toward the position of the star that this exoplanet orbits. The cyan circle marks the star’s catalogue position — not the planet itself.',
    benefit: 'Start wide, then zoom in to locate the host star.',
    surveyId: 'P/DSS2/color',
    durationMs: 4200,
    sourceUrl: 'https://irsa.ipac.caltech.edu/data/DSS/overview.html',
  },
  {
    id: 'visible',
    label: 'Visible light: DSS2',
    title: 'DSS2 — the familiar, visible-light sky',
    explanation: 'DSS2 uses digitized photographic sky-survey plates. This optical view is useful for seeing stars and their surroundings in light similar to what our eyes detect.',
    benefit: 'Best first view for recognising the star field.',
    surveyId: 'P/DSS2/color',
    durationMs: 5500,
    sourceUrl: 'https://irsa.ipac.caltech.edu/data/DSS/overview.html',
  },
  {
    id: 'near-infrared',
    label: 'Near-infrared: 2MASS',
    title: '2MASS — look beyond visible light',
    explanation: '2MASS observes near-infrared light in three bands. Compared with visible light, these images can reveal cooler, redder stars and look through some intervening dust.',
    benefit: 'Useful for comparing stellar populations and dusty regions.',
    surveyId: 'P/2MASS/color',
    durationMs: 6500,
    sourceUrl: 'https://irsa.ipac.caltech.edu/data/2MASS/docs/outreach/optircomp.html',
  },
  {
    id: 'mid-infrared',
    label: 'Infrared: WISE',
    title: 'WISE — a different infrared perspective',
    explanation: 'NASA’s WISE telescope observed at longer infrared wavelengths. Its data can highlight relatively cool objects and warm dust, with different detail and resolution than DSS2 or 2MASS.',
    benefit: 'Useful for exploring infrared-bright objects and dust.',
    surveyId: 'P/allWISE/color',
    durationMs: 6500,
    sourceUrl: 'https://irsa.ipac.caltech.edu/onlinehelp/wise/wise/overview.html',
  },
  {
    id: 'sharp-optical',
    label: 'Sharper visible sky: Pan-STARRS',
    title: 'Pan-STARRS — sharper optical detail',
    explanation: 'This visible-light survey can offer finer detail than DSS2 in its coverage area. It covers declinations north of about −30°, so it is not available everywhere.',
    benefit: 'Useful for inspecting a star’s close optical neighbourhood.',
    surveyId: 'P/PanSTARRS/DR1/color-z-zg-g',
    durationMs: 5500,
    sourceUrl: 'https://archive.stsci.edu/panstarrs/',
  },
  {
    id: 'controls',
    label: 'Zoom, grid and navigation',
    title: 'You are in control of the sky',
    explanation: 'Close / Field / Wide / Region change how much sky you see. Recenter returns to the host star; Grid shows sky coordinates; Full screen gives you more room.',
    benefit: 'Use the same tools after the walkthrough to explore freely.',
    surveyId: null,
    durationMs: 6500,
    sourceUrl: null,
  },
] as const;

export type SurveyStoryStep = (typeof SURVEY_STORY)[number];

export function storyStepsForDec(decDeg: number | null): SurveyStoryStep[] {
  // The coverage limit is given by the configured Pan-STARRS survey.
  return SURVEY_STORY.filter((step) =>
    step.id !== 'sharp-optical' || (decDeg !== null && decDeg >= -30)
  );
}
