import { useEffect, useState } from 'react';
import type { PlanetSnapshot } from './planetSnapshot';
import { loadLatestSnapshot } from './loadSnapshot';

export type SnapshotState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; snapshot: PlanetSnapshot & { fileName: string } };

export function useSnapshot(): SnapshotState {
  const [state, setState] = useState<SnapshotState>({ phase: 'loading' });
  useEffect(() => {
    let cancelled = false;
    loadLatestSnapshot()
      .then((snapshot) => !cancelled && setState({ phase: 'ready', snapshot }))
      .catch((err) => !cancelled && setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) }));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
