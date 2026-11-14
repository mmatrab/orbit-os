/**
 * Converts decimal degrees Right Ascension [0, 360) to sexagesimal HMS string.
 */
export function formatRaHms(raDeg: number): string {
  const normalized = ((raDeg % 360) + 360) % 360;
  const totalHours = normalized / 15;
  const hours = Math.floor(totalHours);
  const remMin = (totalHours - hours) * 60;
  const minutes = Math.floor(remMin);
  const seconds = (remMin - minutes) * 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${seconds
    .toFixed(2)
    .padStart(5, '0')}s`;
}

/**
 * Converts decimal degrees Declination [-90, +90] to sexagesimal DMS string.
 */
export function formatDecDms(decDeg: number): string {
  const sign = decDeg >= 0 ? '+' : '-';
  const abs = Math.abs(decDeg);
  const deg = Math.floor(abs);
  const remArcmin = (abs - deg) * 60;
  const arcmin = Math.floor(remArcmin);
  const arcsec = (remArcmin - arcmin) * 60;
  return `${sign}${String(deg).padStart(2, '0')}° ${String(arcmin).padStart(
    2,
    '0'
  )}′ ${arcsec.toFixed(2).padStart(5, '0')}″`;
}

/**
 * Formats UTC ISO timestamp cleanly for observatory log display.
 */
export function formatUtcTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}
