/**
 * Host <-> module messaging when Space Explorer runs inside an iframe.
 *
 * The host passes its own origin as the `parentOrigin` query parameter (the
 * <orbit-space-explorer> element does this automatically). Messages are only
 * posted to, and accepted from, that exact origin. Which hosts may embed the
 * module at all is enforced server-side by CSP frame-ancestors.
 *
 * Message envelope: { source: 'orbit-space-explorer', type, payload }
 *   module -> host: 'ready'             { version }
 *   module -> host: 'target-selected'   { planetName }
 *   host -> module: 'select-target'     { planetName }
 */

export const MESSAGE_SOURCE = 'orbit-space-explorer';
export const BRIDGE_VERSION = 1;

export interface BridgeMessage {
  source: typeof MESSAGE_SOURCE;
  type: 'ready' | 'target-selected' | 'select-target';
  payload: Record<string, unknown>;
}

/** Returns a normalized origin ("https://host:port") or null if the input is not a plain http(s) origin. */
export function parseOrigin(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.origin !== raw.replace(/\/$/, '')) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export interface LaunchOptions {
  /** Planet to open first (archive pl_name), from ?target= */
  initialTarget: string | null;
  /** Origin of the embedding page, from ?parentOrigin=, when framed */
  parentOrigin: string | null;
}

export function readLaunchOptions(search: string = window.location.search): LaunchOptions {
  const params = new URLSearchParams(search);
  const target = params.get('target')?.trim() || null;
  const framed = typeof window !== 'undefined' && window.parent !== window;
  return {
    initialTarget: target && target.length <= 128 ? target : null,
    parentOrigin: framed ? parseOrigin(params.get('parentOrigin')) : null,
  };
}

export function postToHost(
  parentOrigin: string | null,
  type: 'ready' | 'target-selected',
  payload: Record<string, unknown>
): void {
  if (!parentOrigin) return;
  const message: BridgeMessage = { source: MESSAGE_SOURCE, type, payload };
  window.parent.postMessage(message, parentOrigin);
}

/** Subscribes to 'select-target' commands from the host. Returns an unsubscribe function. */
export function onHostSelectTarget(
  parentOrigin: string | null,
  handler: (planetName: string) => void
): () => void {
  if (!parentOrigin) return () => undefined;
  const listener = (event: MessageEvent) => {
    if (event.origin !== parentOrigin || event.source !== window.parent) return;
    const data = event.data as Partial<BridgeMessage> | null;
    if (!data || data.source !== MESSAGE_SOURCE || data.type !== 'select-target') return;
    const name = data.payload?.planetName;
    if (typeof name === 'string' && name.trim() && name.length <= 128) {
      handler(name.trim());
    }
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
