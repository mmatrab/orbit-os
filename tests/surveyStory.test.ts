import { describe, expect, it } from 'vitest';
import { SURVEY_STORY, storyStepsForDec } from '../src/sky/surveyStory';

describe('Sky tour uses real survey sources and honest coverage', () => {
  it('explains DSS2 visible light, 2MASS near infrared, and WISE longer infrared', () => {
    const steps = storyStepsForDec(-5);
    expect(steps.map((s) => s.surveyId)).toContain('P/DSS2/color');
    expect(steps.map((s) => s.surveyId)).toContain('P/2MASS/color');
    expect(steps.map((s) => s.surveyId)).toContain('P/allWISE/color');
    expect(steps.find((s) => s.id === 'near-infrared')?.explanation).toMatch(/near-infrared/i);
    expect(steps.find((s) => s.id === 'mid-infrared')?.explanation).toMatch(/WISE/);
  });
  it('keeps Pan-STARRS out of the automatic lesson at every declination', () => {
    for (const dec of [-40, -5, 45, null]) {
      expect(storyStepsForDec(dec).some((step) => step.id === 'sharp-optical')).toBe(false);
      expect(storyStepsForDec(dec).map((step) => step.id)).toEqual([
        'arrival', 'visible', 'near-infrared', 'mid-infrared', 'controls',
      ]);
    }
  });
  it('keeps every explanatory chapter bounded and sourced', () => {
    for (const step of SURVEY_STORY) {
      expect(step.durationMs).toBeGreaterThan(1000);
      expect(step.durationMs).toBeLessThan(15000);
      expect(step.explanation.length).toBeGreaterThan(25);
      if (step.surveyId) {
        expect(step.sourceUrl).toMatch(/^https:\/\//);
      }
    }
  });
});
