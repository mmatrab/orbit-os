/**
 * ORBIT OS — Frontend/Backend API Contracts (v1)
 * Owned by Claude (Architecture & Backend); consumed strictly by Frontend.
 */

/** All data is queried live from the NASA Exoplanet Archive; there is no offline or demo dataset. */
export type DataSourceMode = 'live';

/**
 * 'limit_direction_unverified': the archive flags the value as a limit, but its documentation does
 * not reliably say which flag value means upper or lower for pscomppars. The raw flag is kept in
 * ScientificMeasurement.rawLimitFlag. 'upper_limit' / 'lower_limit' are reserved for when the
 * convention is verified; the API does not emit them today.
 */
export type MeasurementStatus =
  | 'measured'
  | 'upper_limit'
  | 'lower_limit'
  | 'limit_direction_unverified'
  | 'derived'
  | 'not_measured';

export type DiscoveryMethod =
  | 'Transit'
  | 'Radial Velocity'
  | 'Imaging'
  | 'Microlensing'
  | 'Transit Timing Variations'
  | 'Astrometry'
  | 'Other';

export interface ScientificMeasurement<T = number> {
  value: T | null;
  unit: string;
  errPlus?: number | null;
  errMinus?: number | null;
  isSymmetricErr?: boolean;
  status: MeasurementStatus;
  /** Raw NASA archive limit-flag value exactly as returned (e.g. 1 or -1); null when not reported. */
  rawLimitFlag?: number | null;
  /** Archive column the raw flag came from, e.g. "pl_orbeccenlim". */
  rawLimitFlagColumn?: string;
  unavailableReason?: string;
  referenceBibcode?: string;
  referenceLabel?: string;
  doi?: string;
}

export interface HostStarSummary {
  hostname: string;
  raDeg: number | null; // archive `ra`, decimal degrees (ICRS); null when not reported
  decDeg: number | null; // archive `dec`, decimal degrees (ICRS); null when not reported
  spectralType: string | null;
  distancePc: ScientificMeasurement<number>;
  teffK: ScientificMeasurement<number>;
  massSolar: ScientificMeasurement<number>;
  radiusSolar: ScientificMeasurement<number>;
  metallicityFeH: ScientificMeasurement<number>;
  vMag: ScientificMeasurement<number>;
  gaiaDr3Id?: string | null;
}

export interface ExoplanetSearchItem {
  id: string; // Exact archive planet name (pl_name), e.g. "TRAPPIST-1 e"
  planetName: string;
  hostname: string;
  discoveryMethod: string; // as published by the archive
  discoveryYear: number | null;
  raDeg: number | null;
  decDeg: number | null;
  orbitalPeriodDays: number | null;
  radiusEarth: number | null;
  massEarth: number | null; // archive best mass (pl_bmasse)
  massIsMsini: boolean; // true when massEarth is a minimum mass (M sin i)
  distancePc: number | null;
  spectralType: string | null;
}

export interface ExoplanetDetail {
  id: string;
  planetName: string;
  archiveRecordTable: string; // "pscomppars": composite values, each with its own reference
  retrievedAtUtc: string; // ISO-8601
  discoveryMethod: string; // as published by the archive
  discoveryYear: number | null;
  discoveryFacility: string;
  discoveryReference: string;
  discoveryDoi?: string | null;
  hostStar: HostStarSummary;
  planetaryParameters: {
    radiusEarth: ScientificMeasurement<number>;
    massEarth: ScientificMeasurement<number>;
    massIsMsini: boolean; // True if the value is a minimum mass (M sin i)
    massProvenance: string | null; // archive pl_bmassprov, verbatim (e.g. "Mass", "M*sini")
    equilibriumTempK: ScientificMeasurement<number>;
    insolationFluxEarth: ScientificMeasurement<number>;
    bulkDensityGcm3: ScientificMeasurement<number>;
  };
  orbitalParameters: {
    periodDays: ScientificMeasurement<number>;
    semiMajorAxisAu: ScientificMeasurement<number>;
    eccentricity: ScientificMeasurement<number>;
    inclinationDeg: ScientificMeasurement<number>;
    transitDurationHours: ScientificMeasurement<number>;
  };
  provenance: {
    primarySourceId: string;
    upstreamQueryUrl?: string;
    notes?: string;
  };
}

export interface SearchTargetsParams {
  q?: string;
  discoveryMethod?: DiscoveryMethod | 'ALL';
  requireRadius?: boolean;
  requireMass?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchTargetsResponse {
  mode: DataSourceMode;
  totalCount: number;
  returnedCount: number;
  queryTimestampUtc: string;
  items: ExoplanetSearchItem[];
}

export interface DataSourceStatus {
  id: string;
  name: string;
  provider: string;
  endpointUrl: string;
  schemaOrVersion: string;
  status: 'operational' | 'degraded' | 'offline' | 'not_queried';
  latencyMs: number | null;
  lastCheckedUtc: string | null;
  citationText: string;
  licenseOrTermsUrl: string;
}

export interface SourcesResponse {
  mode: DataSourceMode;
  sources: DataSourceStatus[];
}

export type NotebookCategory =
  | 'Target Screening'
  | 'Sky Inspection'
  | 'Data Anomaly'
  | 'Follow-up Candidate'
  | 'Literature Cross-Check';

export interface ParameterSnapshot {
  planetName: string;
  hostname: string;
  raDeg: number | null;
  decDeg: number | null;
  periodDays: number | null;
  radiusEarth: number | null;
  massEarth: number | null;
  massIsMsini?: boolean; // true when massEarth is a minimum mass (M sin i)
  capturedFromMode: DataSourceMode;
}

export interface NotebookEntry {
  id: string;
  targetId: string;
  targetName: string;
  category: NotebookCategory;
  title: string;
  body: string;
  tags: string[];
  createdAtUtc: string;
  updatedAtUtc: string;
  parameterSnapshot?: ParameterSnapshot;
  syncState: 'local_only' | 'synced' | 'sync_error';
}

export interface CreateNotebookEntryRequest {
  targetId: string;
  targetName: string;
  category: NotebookCategory;
  title: string;
  body: string;
  tags: string[];
  parameterSnapshot?: ParameterSnapshot;
}

export interface UpdateNotebookEntryRequest {
  category?: NotebookCategory;
  title?: string;
  body?: string;
  tags?: string[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestampUtc: string;
}

export interface ExportSubmissionRequest {
  targetId: string;
  format: 'json' | 'csv' | 'markdown';
  generatedAtUtc: string;
  includedNotebookEntryIds: string[];
}

export interface ExportSubmissionResponse {
  exportId: string;
  archivedAtUtc: string;
  checksumSha256?: string;
}
