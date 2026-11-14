import React, { useEffect, useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import {
  DataSourceMode,
  DataSourceStatus,
  ExoplanetDetail,
  NotebookEntry,
} from '../api/contracts';
import {
  buildEvidenceBundle,
  serializeBundleToCsv,
  serializeBundleToMarkdown,
  triggerTextDownload,
} from '../utils/exportBundle';

interface EvidenceExportModalProps {
  open: boolean;
  target: ExoplanetDetail | null;
  mode: DataSourceMode;
  notebookEntries: NotebookEntry[];
  sources: DataSourceStatus[];
  onSubmitServerExport?: (
    format: 'json' | 'csv' | 'markdown',
    entryIds: string[]
  ) => Promise<string | null>;
  onClose: () => void;
}

export const EvidenceExportModal: React.FC<EvidenceExportModalProps> = ({
  open,
  target,
  mode,
  notebookEntries,
  sources,
  onSubmitServerExport,
  onClose,
}) => {
  const [format, setFormat] = useState<'json' | 'csv' | 'markdown'>('json');
  const [includeAllNotes, setIncludeAllNotes] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const selectedNotes = useMemo(() => {
    if (!target) return [];
    return includeAllNotes
      ? notebookEntries
      : notebookEntries.filter((n) => n.targetId === target.id);
  }, [includeAllNotes, notebookEntries, target]);

  const previewText = useMemo(() => {
    if (!target) return '';
    const bundle = buildEvidenceBundle(target, mode, selectedNotes, sources);
    if (format === 'json') return JSON.stringify(bundle, null, 2);
    if (format === 'csv') return serializeBundleToCsv(bundle);
    return serializeBundleToMarkdown(bundle);
  }, [format, mode, selectedNotes, sources, target]);

  if (!open || !target) return null;

  const targetNoteCount = notebookEntries.filter((n) => n.targetId === target.id).length;

  const handleDownload = async () => {
    setArchiveStatus(null);
    setSubmitting(true);
    try {
      const safeSlug = target.id.replace(/[^a-z0-9-_]/gi, '_');
      const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'md';
      const mime =
        format === 'json'
          ? 'application/json'
          : format === 'csv'
          ? 'text/csv;charset=utf-8'
          : 'text/markdown;charset=utf-8';

      triggerTextDownload(`orbit-os_${safeSlug}_evidence.${ext}`, previewText, mime);

      if (mode === 'live' && onSubmitServerExport) {
        const receipt = await onSubmitServerExport(
          format,
          selectedNotes.map((n) => n.id)
        );
        if (receipt) {
          setArchiveStatus(`Export audit ID recorded on backend: ${receipt}`);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0F151E] border border-slate-700 rounded overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-[#121A25]">
          <h2 id="export-modal-title" className="text-xs font-semibold tracking-wide text-slate-100">
            Evidence Bundle Export — {target.planetName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="p-1 rounded text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex flex-col gap-3 text-xs">
          {mode === 'reference_fixture' && (
            <div className="p-2.5 rounded border border-amber-500/35 bg-amber-950/30 text-amber-200">
              ▲ Export is generated from the static reference fixture and includes an explicit
              demonstration-mode watermark.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-slate-300">
              <span>Format</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as 'json' | 'csv' | 'markdown')}
                className="px-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
              >
                <option value="json">JSON (Full Provenance Schema v1)</option>
                <option value="csv">CSV (Parameter Table, RFC 4180)</option>
                <option value="markdown">Markdown (Observatory Brief &amp; Citations)</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAllNotes}
                onChange={(e) => setIncludeAllNotes(e.target.checked)}
                className="accent-cyan-400"
              />
              <span>
                Include all notebook entries ({notebookEntries.length}) instead of target-only (
                {targetNoteCount})
              </span>
            </label>
          </div>

          <pre className="m-0 p-3 max-h-80 overflow-auto rounded border border-slate-800 bg-[#07090E] font-mono text-[11px] text-slate-200 leading-relaxed">
            {previewText}
          </pre>

          {archiveStatus && (
            <div className="p-2.5 rounded border border-emerald-500/35 bg-emerald-950/25 font-mono text-[11px] text-emerald-200">
              {archiveStatus}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium rounded border border-slate-700 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Download .{format === 'markdown' ? 'md' : format} Bundle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
