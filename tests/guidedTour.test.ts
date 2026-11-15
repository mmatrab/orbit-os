import { describe, expect, it } from 'vitest';
import { TOUR_END_FOV_DEG, TOUR_START_FOV_DEG, normalizeRa, tourCameraAt, tourStartCamera } from '../src/sky/guidedTour';

describe('guided tour camera for real NASA host-star coordinates', () => {
  it('begins with a wider field and ends exactly at the host star', () => {
    const start = tourStartCamera(346.626, -5.04);
    expect(start.fovDeg).toBe(TOUR_START_FOV_DEG);
    const end = tourCameraAt(start, 346.626, -5.04, 1);
    expect(end.raDeg).toBeCloseTo(346.626, 8);
    expect(end.decDeg).toBeCloseTo(-5.04, 8);
    expect(end.fovDeg).toBeCloseTo(TOUR_END_FOV_DEG, 8);
  });
  it('takes the shortest RA route across the 0/360 degree seam', () => {
    const start = tourStartCamera(359.9, 5);
    const halfway = tourCameraAt(start, 359.9, 5, 0.5);
    const distance = Math.abs(((halfway.raDeg - 359.9 + 540) % 360) - 180);
    expect(distance).toBeLessThan(3);
    expect(normalizeRa(-0.1)).toBeCloseTo(359.9, 8);
  });
  it('clamps fractional animation progress and avoids invalid declinations near poles', () => {
    const start = tourStartCamera(10, 89.9);
    expect(start.decDeg).toBeLessThanOrEqual(89.5);
    expect(tourCameraAt(start, 10, 89.9, -10)).toEqual(start);
    const beyond = tourCameraAt(start, 10, 89.9, 5);
    expect(beyond.raDeg).toBeCloseTo(10, 8);
    expect(beyond.decDeg).toBeCloseTo(89.9, 8);
    expect(beyond.fovDeg).toBeCloseTo(TOUR_END_FOV_DEG, 8);
  });
  it('decreases camera field of view monotonically for a smooth guided zoom', () => {
    const start = tourStartCamera(32, -22);
    let last = start.fovDeg;
    for (const fraction of [0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const next = tourCameraAt(start, 32, -22, fraction);
      expect(next.fovDeg).toBeLessThanOrEqual(last);
      last = next.fovDeg;
    }
  });
});
