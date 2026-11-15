import { describe, expect, it } from 'vitest';
import { startsOnLearnPage, workspaceHref } from '../src/utils/workspaceNavigation';

describe('Science learning navigation', () => {
  it('creates a shareable article URL while preserving deep links and base paths', () => {
    expect(workspaceHref('https://example.org/orbit/space-explorer/?target=TRAPPIST-1%20e', 'learn'))
      .toBe('/orbit/space-explorer/?target=TRAPPIST-1+e&view=learn');
  });
  it('restores the explorer route without losing planet selection', () => {
    expect(workspaceHref('https://example.org/space/?target=51+Peg+b&view=learn', 'explorer'))
      .toBe('/space/?target=51+Peg+b');
  });
  it('recognizes the article only for its explicit view parameter', () => {
    expect(startsOnLearnPage('?view=learn')).toBe(true);
    expect(startsOnLearnPage('?target=TRAPPIST-1+e')).toBe(false);
  });
});
