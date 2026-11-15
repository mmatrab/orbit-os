/** Shareable section links that work even when ORBIT OS is embedded under a URL prefix. */
export function workspaceHref(currentUrl: string, tab: 'explorer' | 'learn' | 'notebook' | 'provenance'): string {
  const url = new URL(currentUrl);
  if (tab === 'learn') url.searchParams.set('view', 'learn');
  else url.searchParams.delete('view');
  return url.pathname + url.search + url.hash;
}

export function startsOnLearnPage(search: string): boolean {
  return new URLSearchParams(search).get('view') === 'learn';
}
