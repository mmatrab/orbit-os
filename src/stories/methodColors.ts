import type { DiscoveryMethod } from '../api/contracts';

/**
 * One colour per discovery method, in METHOD_ORDER. Checked with the dataviz palette validator against
 * the app's dark panel (#161e2c): every colour >= 3:1 contrast, adjacent pairs separable for the three
 * common colour-vision deficiencies (worst CVD ΔE 8.4) and for normal vision (worst ΔE 19.3).
 * Identity never relies on colour alone: legends carry names and every chart has a table view.
 */
export const METHOD_COLOURS: Record<DiscoveryMethod, string> = {
  Transit: '#3987e5',
  'Radial Velocity': '#d95926',
  Imaging: '#199e70',
  Microlensing: '#c98500',
  'Transit Timing Variations': '#d55181',
  Astrometry: '#0ca30c',
  Other: '#9085e9',
};
