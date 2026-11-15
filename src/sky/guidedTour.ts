/**
 * Small, deterministic camera journey through real Aladin HiPS sky imagery.
 * This is a camera animation, never a generated/reconstructed photograph.
 * Coordinates come exclusively from the NASA Exoplanet Archive.
 */

export const TOUR_START_FOV_DEG = 2.5;
export const TOUR_END_FOV_DEG = 0.25;
export const TOUR_DURATION_MS = 4200;

export interface SkyCamera {
  raDeg: number;
  decDeg: number;
  fovDeg: number;
}

export function normalizeRa(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** A slight offset lets the visitor see the camera find the host star, even at the RA seam. */
export function tourStartCamera(raDeg: number, decDeg: number): SkyCamera {
  const cosDec = Math.max(0.2, Math.cos((decDeg * Math.PI) / 180));
  return {
    raDeg: normalizeRa(raDeg + Math.min(1.4, 0.65 / cosDec)),
    decDeg: Math.max(-89.5, Math.min(89.5, decDeg + (decDeg > 85 ? -0.4 : 0.4))),
    fovDeg: TOUR_START_FOV_DEG,
  };
}

export function tourCameraAt(
  start: SkyCamera,
  targetRaDeg: number,
  targetDecDeg: number,
  fraction: number
): SkyCamera {
  const progress = Math.max(0, Math.min(1, fraction));
  const eased = progress < 0.5
    ? 4 * progress ** 3
    : 1 - ((-2 * progress + 2) ** 3) / 2;
  // Follow the shortest angular route: a target at 0° is next to 359°, not across the sky.
  const deltaRa = ((normalizeRa(targetRaDeg) - start.raDeg + 540) % 360) - 180;
  return {
    raDeg: normalizeRa(start.raDeg + deltaRa * eased),
    decDeg: start.decDeg + (targetDecDeg - start.decDeg) * eased,
    // Log-space zoom looks continuous over a 10x range.
    fovDeg: Math.exp(
      Math.log(start.fovDeg) * (1 - eased) + Math.log(TOUR_END_FOV_DEG) * eased
    ),
  };
}
