import type { SearchTargetsParams } from '../api/contracts';

/**
 * Clicking an example planet selects it AND puts its name in the search box,
 * so the results list shows the planet that the detail panel is showing.
 * Other filters are left as the user set them.
 */
export function pickExample(
  params: SearchTargetsParams,
  planetName: string
): { params: SearchTargetsParams; selectedId: string } {
  return { params: { ...params, q: planetName }, selectedId: planetName };
}
