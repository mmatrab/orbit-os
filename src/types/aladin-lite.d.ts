declare module 'aladin-lite' {
  export interface AladinOptions {
    survey?: string;
    fov?: number;
    target?: string;
    projection?: 'SIN' | 'AIT' | 'MOL' | 'TAN' | 'MER' | 'ZEA' | 'ARC' | string;
    cooFrame?: 'ICRS' | 'ICRSd' | 'galactic' | string;
    showReticle?: boolean;
    showCooGrid?: boolean;
    showZoomControl?: boolean;
    showFullscreenControl?: boolean;
    showLayersControl?: boolean;
    showGotoControl?: boolean;
    showFrame?: boolean;
    showCooGridControl?: boolean;
    showSimbadPointerControl?: boolean;
    showCooLocation?: boolean;
    showProjectionControl?: boolean;
    showContextMenu?: boolean;
  }

  export interface AladinCatalogOptions {
    name?: string;
    sourceSize?: number;
    color?: string;
    shape?: 'square' | 'circle' | 'plus' | 'cross' | 'rhomb' | 'triangle' | string;
  }

  export interface AladinSource {
    ra: number;
    dec: number;
    data?: Record<string, unknown>;
  }

  export interface AladinCatalog {
    addSources: (sources: AladinSource[]) => void;
    clear?: () => void;
    removeAll?: () => void;
  }

  export interface AladinInstance {
    gotoRaDec: (ra: number, dec: number) => void;
    setFoV: (fovDeg: number) => void;
    getFoV?: () => [number, number];
    setBaseImageLayer: (surveyIdOrUrl: string) => Promise<unknown> | unknown;
    setProjection: (projection: string) => void;
    setFrame: (cooFrame: string) => void;
    showCooGrid: () => void;
    hideCooGrid: () => void;
    showReticle: (show: boolean) => void;
    addCatalog: (catalog: AladinCatalog) => void;
    getRaDec?: () => [number, number];
    on?: (event: string, callback: (...args: unknown[]) => void) => void;
    /** Renders the current view (survey + overlays) to a data URL. Async in Aladin Lite 3.x. */
    getViewDataURL?: (options?: { format?: string; width?: number; height?: number; logo?: boolean }) => Promise<string>;
  }

  export interface AladinLiteModule {
    init: Promise<void>;
    aladin: (selector: string | HTMLElement, options?: AladinOptions) => AladinInstance;
    catalog: (options?: AladinCatalogOptions) => AladinCatalog;
    source: (ra: number, dec: number, data?: Record<string, unknown>) => AladinSource;
  }

  const A: AladinLiteModule;
  export default A;
}
