/**
 * SYNTHETIC TEST ROWS. These are not real measurements and must never be shown to users.
 * They imitate the column layout of the NASA Exoplanet Archive `pscomppars` table so the
 * parsing code can be tested without network access. The planet name "TEST-1 b" does not exist.
 */
export const SYNTHETIC_TAP_URL = 'https://tap.invalid/TAP/sync';

export const syntheticSearchRow = {
  pl_name: 'TEST-1 b',
  hostname: 'TEST-1',
  discoverymethod: 'Pulsar Timing',
  disc_year: 2001,
  ra: 10.5,
  dec: -20.25,
  pl_orbper: 3.5,
  pl_rade: null,
  pl_bmasse: 12.0,
  pl_bmassprov: 'M*sini',
  sy_dist: 40.0,
  st_spectype: 'K2 V',
};

const ref = (label: string, bib: string) =>
  `<a refstr=X href=https://ui.adsabs.harvard.edu/abs/${bib}/abstract target=ref>${label}</a>`;

export function syntheticDetailRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    pl_name: 'TEST-1 b',
    hostname: 'TEST-1',
    discoverymethod: 'Radial Velocity',
    disc_year: 2001,
    disc_facility: 'Test Observatory',
    disc_refname: ref('Author et al. 2001', '2001TEST....1....1A'),
    ra: 10.5,
    dec: -20.25,
    gaia_dr3_id: 'Gaia DR3 0000',
    st_spectype: 'K2 V',
    sy_dist: 40.0,
    sy_disterr1: 0.2,
    sy_disterr2: -0.2,
    sy_dist_reflink: ref('Gaia Test 2021', '2021TEST....2....2B'),
    st_teff: 5000,
    st_tefferr1: 50,
    st_tefferr2: -70,
    st_tefflim: 0,
    st_teff_reflink: ref('Star et al. 2010', '2010TEST....3....3C'),
    pl_bmasse: 150.0,
    pl_bmasseerr1: 5,
    pl_bmasseerr2: -5,
    pl_bmasselim: 0,
    pl_bmassprov: 'M*sini',
    pl_bmasse_reflink: ref('Author et al. 2001', '2001TEST....1....1A'),
    pl_orbeccen: 0.05,
    pl_orbeccenerr1: null,
    pl_orbeccenerr2: null,
    pl_orbeccenlim: 1,
    pl_orbeccen_reflink: ref('Author et al. 2001', '2001TEST....1....1A'),
    pl_orbper: 3.5,
    pl_orbpererr1: 0.001,
    pl_orbpererr2: -0.002,
    pl_orbperlim: 0,
    pl_orbper_reflink: ref('Author et al. 2001', '2001TEST....1....1A'),
    ...overrides,
  };
}

/** Builds a fetch stub that answers TAP queries sent to SYNTHETIC_TAP_URL and passes everything else through. */
export function makeTapFetch(
  realFetch: typeof fetch,
  detailRow: Record<string, unknown> | null = syntheticDetailRow(),
  log: string[] = []
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith(SYNTHETIC_TAP_URL)) return realFetch(input, init);
    const adql = new URL(url).searchParams.get('query') ?? '';
    log.push(adql);
    let body: unknown[];
    if (/COUNT\(\*\)/i.test(adql)) body = [{ total: 1 }];
    else if (/pl_name = /.test(adql)) body = detailRow && adql.includes("'TEST-1 b'") ? [detailRow] : [];
    else body = [syntheticSearchRow];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}
