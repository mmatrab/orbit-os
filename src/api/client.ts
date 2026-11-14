import {
  CreateNotebookEntryRequest,
  DataSourceMode,
  ExoplanetDetail,
  ExportSubmissionRequest,
  ExportSubmissionResponse,
  HealthResponse,
  NotebookEntry,
  SearchTargetsParams,
  SearchTargetsResponse,
  SourcesResponse,
  UpdateNotebookEntryRequest,
} from './contracts';

export class ApiError extends Error {
  public readonly status: number;
  public readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

export interface OrbitClientConfig {
  /**
   * Base URL of the module, ending with "/". Defaults to the directory of the current page,
   * so the UI works unchanged when the module is served under a prefix such as /space-explorer/.
   */
  baseUrl?: string;
  timeoutMs?: number;
}

export class OrbitApiClient {
  private mode: DataSourceMode = 'live';
  private timeoutMs: number;
  private baseUrl: string;

  constructor(config: OrbitClientConfig = {}) {
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.baseUrl = config.baseUrl ?? new URL('./', document.baseURI).toString();
  }

  /** Resolves an API path such as "api/v1/health" against the module base URL. */
  private url(relativePath: string): string {
    return new URL(relativePath, this.baseUrl).toString();
  }

  public getMode(): DataSourceMode {
    return this.mode;
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url(path), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init?.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        let parsedMessage = '';
        const text = await response.text().catch(() => '');
        if (text) {
          try {
            const parsed = JSON.parse(text) as { error?: string; detail?: string };
            parsedMessage = parsed.error
              ? parsed.detail
                ? `${parsed.error} (${parsed.detail})`
                : parsed.error
              : text;
          } catch {
            parsedMessage = text;
          }
        }
        throw new ApiError(
          parsedMessage || `HTTP ${response.status} ${response.statusText}`,
          response.status,
          path
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError(`Request timed out after ${this.timeoutMs} ms`, 408, path);
      }
      throw new ApiError(
        err instanceof Error ? err.message : 'Network error communicating with ORBIT OS API',
        0,
        path
      );
    } finally {
      window.clearTimeout(timer);
    }
  }

  public async checkHealth(): Promise<HealthResponse> {
    return this.requestJson<HealthResponse>('api/v1/health');
  }

  public async searchTargets(params: SearchTargetsParams): Promise<SearchTargetsResponse> {

    const sp = new URLSearchParams();
    if (params.q?.trim()) sp.set('q', params.q.trim());
    if (params.discoveryMethod && params.discoveryMethod !== 'ALL') {
      sp.set('discoveryMethod', params.discoveryMethod);
    }
    if (params.requireRadius) sp.set('requireRadius', 'true');
    if (params.requireMass) sp.set('requireMass', 'true');
    if (params.limit !== undefined) sp.set('limit', String(params.limit));
    if (params.offset !== undefined) sp.set('offset', String(params.offset));

    const qs = sp.toString();
    return this.requestJson<SearchTargetsResponse>(
      `api/v1/targets/search${qs ? `?${qs}` : ''}`
    );
  }

  public async getExoplanetDetail(id: string): Promise<ExoplanetDetail> {

    return this.requestJson<ExoplanetDetail>(`api/v1/exoplanets/${encodeURIComponent(id)}`);
  }

  public async getSources(): Promise<SourcesResponse> {

    return this.requestJson<SourcesResponse>('api/v1/sources');
  }

  public async listNotebookEntries(targetId?: string): Promise<NotebookEntry[]> {
    const qs = targetId ? `?targetId=${encodeURIComponent(targetId)}` : '';
    return this.requestJson<NotebookEntry[]>(`api/v1/notebook/entries${qs}`);
  }

  public async createNotebookEntry(payload: CreateNotebookEntryRequest): Promise<NotebookEntry> {
    return this.requestJson<NotebookEntry>('api/v1/notebook/entries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateNotebookEntry(
    id: string,
    payload: UpdateNotebookEntryRequest
  ): Promise<NotebookEntry> {
    return this.requestJson<NotebookEntry>(`api/v1/notebook/entries/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  public async deleteNotebookEntry(id: string): Promise<void> {
    await this.requestJson<void>(`api/v1/notebook/entries/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  public async submitExportRecord(
    payload: ExportSubmissionRequest
  ): Promise<ExportSubmissionResponse> {
    return this.requestJson<ExportSubmissionResponse>('api/v1/exports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
