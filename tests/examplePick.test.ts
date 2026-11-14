import { describe, expect, it } from 'vitest';
import { pickExample } from '../src/utils/examplePick.ts';

describe('example planet buttons (regression: selection and results list must agree)', () => {
  it('sets both the selected planet and the search query', () => {
    const result = pickExample({ q: 'kepler', limit: 50 }, '51 Peg b');
    expect(result.selectedId).toBe('51 Peg b');
    expect(result.params.q).toBe('51 Peg b');
  });

  it('keeps the other filters unchanged', () => {
    const before = { q: '', discoveryMethod: 'Transit' as const, requireRadius: true, requireMass: false, limit: 50 };
    const { params } = pickExample(before, 'TRAPPIST-1 e');
    expect(params).toEqual({ ...before, q: 'TRAPPIST-1 e' });
    expect(before.q).toBe('');
  });
});
