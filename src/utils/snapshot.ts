import type { ExoplanetDetail, ParameterSnapshot } from '../api/contracts';

/** The values copied into a notebook entry when a planet is saved to notes. */
export function snapshotOf(target: ExoplanetDetail): ParameterSnapshot {
  return {
    planetName: target.planetName,
    hostname: target.hostStar.hostname,
    raDeg: target.hostStar.raDeg,
    decDeg: target.hostStar.decDeg,
    periodDays: target.orbitalParameters.periodDays.value,
    radiusEarth: target.planetaryParameters.radiusEarth.value,
    massEarth: target.planetaryParameters.massEarth.value,
    massIsMsini: target.planetaryParameters.massIsMsini,
    capturedFromMode: 'live',
  };
}
