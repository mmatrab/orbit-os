import React, { useState } from 'react';
import { Check, Copy, ExternalLink, RotateCw } from 'lucide-react';
import { DataSourceMode, DataSourceStatus, ExoplanetDetail } from '../api/contracts';
import { formatUtcTimestamp } from '../utils/coordinates';

interface ProvenancePanelProps {
  mode: DataSourceMode;
  sources: DataSourceStatus[];
  loading: boolean;
  error: string | null;
  activeTarget: ExoplanetDetail | null;
  onRefresh: () => void;
}

export const ProvenancePanel: React.FC<ProvenancePanelProps> = ({
  mode,
  sources,
  loading,
  error,
  activeTarget,
  onRefresh,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const renderStatusLabel = (src: DataSourceStatus) => {
    const latency = src.latencyMs !== null ? ` (${src.latencyMs} ms)` : '';
    if (src.status === 'operational') {
      return <span className="font-mono text-[11px] text-emerald-300">● Operational{latency}</span>;
    }
    if (src.status === 'degraded') {
      return <span className="font-mono text-[11px] text-amber-300">▲ Degraded{latency}</span>;
    }
    if (src.status === 'not_queried') {
      return (
        <span className="font-mono text-[11px] text-amber-300">▲ Not Queried (Offline Mode)</span>
      );
    }
    return <span className="font-mono text-[11px] text-rose-300">✖ Offline{latency}</span>;
  };

  const handleCopyCitation = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      // Clipboard API fallback ignored cleanly
    }
  };

  return (
    <section
      className="bg-[#161e2c] border border-slate-800 rounded"
      aria-labelledby="provenance-title"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-[#1a2332]">
        <h2 id="provenance-title" className="text-sm font-semibold text-slate-100">
          Data sources
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-slate-700 bg-[#0e1420] text-slate-200 hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{loading ? 'Checking…' : 'Refresh Source Status'}</span>
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 text-xs">
        {activeTarget && (
          <div className="p-3.5 rounded border border-slate-800 bg-[#0e1420]">
            <h3 className="text-xs font-semibold text-cyan-300">
              Active Target Provenance — {activeTarget.planetName}
            </h3>
            <div className="font-mono tabular-nums text-[11px] text-slate-300 mt-1.5 space-x-2">
              <span>Mode: {mode}</span>
              <span aria-hidden="true">·</span>
              <span>Table: {activeTarget.archiveRecordTable}</span>
              <span aria-hidden="true">·</span>
              <span>Retrieved: {formatUtcTimestamp(activeTarget.retrievedAtUtc)}</span>
            </div>
            {activeTarget.provenance.notes && (
              <p className="mt-1.5 text-slate-400 leading-relaxed">
                {activeTarget.provenance.notes}
              </p>
            )}
          </div>
        )}

        {error && (
          <div
            className="p-3 rounded border border-rose-500/40 bg-rose-950/30 text-rose-200"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {sources.map((src) => (
            <article
              key={src.id}
              className="p-4 rounded border border-slate-800 bg-[#0e1420] flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-slate-100">{src.name}</h3>
                {renderStatusLabel(src)}
              </div>

              <div className="font-mono text-[11px] text-slate-400 flex flex-wrap gap-x-2 gap-y-1">
                <span>Provider: {src.provider}</span>
                <span aria-hidden="true">·</span>
                <span>Schema: {src.schemaOrVersion}</span>
              </div>

              <div className="font-mono text-[11px] text-slate-500 flex flex-wrap gap-x-2 gap-y-1">
                <span>Endpoint: {src.endpointUrl}</span>
                {src.lastCheckedUtc && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Checked: {formatUtcTimestamp(src.lastCheckedUtc)}</span>
                  </>
                )}
              </div>

              <p className="text-slate-300 leading-relaxed mt-1">{src.citationText}</p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <a
                  href={src.licenseOrTermsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                >
                  <span>Archive acknowledgment &amp; terms</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>

                <button
                  type="button"
                  onClick={() => handleCopyCitation(src.id, src.citationText)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded border border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  {copiedId === src.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                      <span className="text-emerald-300">Citation Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" aria-hidden="true" />
                      <span>Copy Citation</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
