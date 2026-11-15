import { decodeSnapshot, type PlanetSnapshot, type SnapshotFile } from './planetSnapshot';

/**
 * Snapshots written by `npm run snapshot`. Vite turns each file into its own lazy chunk, so the
 * ~600 KB of planet data is only downloaded when a chart or the guided path needs it.
 * The newest file (by date in its name) wins, so a data refresh is: run the script, commit, deploy.
 */
const SNAPSHOT_FILES = import.meta.glob<SnapshotFile>('../../data/snapshots/planets-*.json', { import: 'default' });

export function latestSnapshotFileName(paths: string[]): string | null {
  const sorted = paths.filter((p) => /planets-\d{4}-\d{2}-\d{2}\.json$/.test(p)).sort();
  return sorted.length ? sorted[sorted.length - 1] : null;
}

let cached: Promise<PlanetSnapshot & { fileName: string }> | null = null;

export function loadLatestSnapshot(): Promise<PlanetSnapshot & { fileName: string }> {
  cached ??= (async () => {
    const path = latestSnapshotFileName(Object.keys(SNAPSHOT_FILES));
    if (!path) throw new Error('No planet snapshot found. Run `npm run snapshot` to create one.');
    const file = await SNAPSHOT_FILES[path]();
    return { ...decodeSnapshot(file), fileName: path.split('/').pop() ?? path };
  })();
  cached.catch(() => {
    cached = null;
  });
  return cached;
}
