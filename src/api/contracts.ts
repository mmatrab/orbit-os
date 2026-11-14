/**
 * ORBIT OS — Frontend/Backend API Contracts (v1)
 * Owned by Claude (Architecture & Backend); consumed strictly by Frontend.
 */

export type DataSourceMode = 'live' | 'reference_fixture';

export type MeasurementStatus =
  | 'measured'
  | 'upper_limit'
  | 'lower_limit'
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
  unavailableReason?: string;
  referenceBibcode?: string;
  referenceLabel?: string;
  doi?: string;
}

export interface HostStarSummary {
  hostname: string;
  raDeg: number; // ICRS J2000 decimal degrees
  decDeg: number; // ICRS J2000 decimal degrees
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
  id: string; // Canonical URL-safe slug or archive row ID (e.g., "trappist-1-e")
  planetName: string;
  hostname: string;
  discoveryMethod: DiscoveryMethod;
  discoveryYear: number;
  raDeg: number;
  decDeg: number;
  orbitalPeriodDays: number | null;
  radiusEarth: number | null;
  massEarth: number | null;
  distancePc: number | null;
  spectralType: string | null;
  isDefaultParameterSet: boolean;
}

export interface ExoplanetDetail {
  id: string;
  planetName: string;
  archiveRecordTable: string; // e.g., "pscomppars" or "ps"
  retrievedAtUtc: string; // ISO-8601
  discoveryMethod: DiscoveryMethod;
  discoveryYear: number;
  discoveryFacility: string;
  discoveryReference: string;
  discoveryDoi?: string | null;
  hostStar: HostStarSummary;
  planetaryParameters: {
    radiusEarth: ScientificMeasurement<number>;
    massEarth: ScientificMeasurement<number>;
    massIsMsini: boolean; // True if radial velocity minimum mass (M sin i)
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
  raDeg: number;
  decDeg: number;
  periodDays: number | null;
  radiusEarth: number | null;
  massEarth: number | null;
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
