import type { SnapshotPlanet } from '../stories/planetSnapshot';
import { LIGHT_YEARS_PER_PARSEC, EARTH_YEAR_DAYS } from '../stories/planetSnapshot';

export interface ArchiveWorldFact {
  title: string;
  description: string;
  value: number | null;
  unit: string;
  /** True only when the archive reports a limit; direction remains unverified. */
  isLimit: boolean;
}

/** 
 * Compact question content from the dated NASA pscomppars snapshot.
 * Raw limit values must not be presented as exact comparisons.
 * A zero limit flag does NOT establish whether an unflagged value is directly
 * measured or derived, so neither claim is made.
 */
export function snapshotWorldFacts(planet: SnapshotPlanet): ArchiveWorldFact[] {
  const valid = (value: number | null, limit: boolean) =>
    !limit && value !== null && Number.isFinite(value) && value > 0 ? value : null;
  const radiusLimited = planet.radiusStatus === 'l';
  const periodLimited = planet.orbitalPeriodStatus === 'l';
  const radius = valid(planet.radiusEarth, radiusLimited);
  const distance = valid(planet.distancePc, false);
  const days = valid(planet.orbitalPeriodDays, periodLimited);
  const round = (n: number) => Number(n.toPrecision(3)).toLocaleString('en-US', { maximumFractionDigits: 3 });
  return [
    {
      title: 'How big is it?',
      description: radius === null
        ? radiusLimited ? 'The archive flags the radius as a limit. Its direction is unverified, so no size comparison is shown.' : 'The archive snapshot has no usable radius for this planet.'
        : `The archive reports a radius ${round(radius)} times Earth's radius.`,
      value: radius, unit: 'Earth radii', isLimit: radiusLimited,
    },
    {
      title: 'How far away is it?',
      description: distance === null
        ? 'This dated archive snapshot does not include a usable distance for its host star.'
        : `The host star is approximately ${round(distance * LIGHT_YEARS_PER_PARSEC)} light-years away (converted from parsecs).`,
      value: distance, unit: 'parsecs', isLimit: false,
    },
    {
      title: 'How long is its year?',
      description: days === null
        ? periodLimited ? 'The archive flags the orbital period as a limit; its direction is unverified.' : 'The archive snapshot has no usable orbital period for this planet.'
        : `One orbit takes ${round(days)} Earth days, about ${round(days / EARTH_YEAR_DAYS)} Earth years.`,
      value: days, unit: 'Earth days', isLimit: periodLimited,
    },
  ];
}
