import React, { useEffect, useState } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import {
  CreateNotebookEntryRequest,
  DataSourceMode,
  ExoplanetDetail,
  NotebookCategory,
  NotebookEntry,
  ParameterSnapshot,
  UpdateNotebookEntryRequest,
} from '../api/contracts';
import { formatUtcTimestamp } from '../utils/coordinates';

interface ResearchNotebookPanelProps {
  mode: DataSourceMode;
  /** Where notes are persisted: this browser only (default) or the deployment's shared server notebook. */
  storage: 'browser' | 'server';
  activeTarget: ExoplanetDetail | null;
  entries: NotebookEntry[];
  pendingSnapshot: ParameterSnapshot | null;
  onClearPendingSnapshot: () => void;
  onCreateEntry: (req: CreateNotebookEntryRequest) => Promise<void>;
  onUpdateEntry: (id: string, req: UpdateNotebookEntryRequest) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}

const CATEGORIES: NotebookCategory[] = [
  'Target Screening',
  'Sky Inspection',
  'Data Anomaly',
  'Follow-up Candidate',
  'Literature Cross-Check',
];

export const ResearchNotebookPanel: React.FC<ResearchNotebookPanelProps> = ({
  mode,
  storage,
  activeTarget,
  entries,
  pendingSnapshot,
  onClearPendingSnapshot,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
}) => {
  const [category, setCategory] = useState<NotebookCategory>('Target Screening');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [filterTargetOnly, setFilterTargetOnly] = useState(false);
  const [filterCategory, setFilterCategory] = useState<NotebookCategory | 'ALL'>('ALL');
  const [filterQuery, setFilterQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingSnapshot && !editingId) {
      setTitle(`Parameter review: ${pendingSnapshot.planetName}`);
      setCategory('Target Screening');
    }
  }, [pendingSnapshot, editingId]);

  const startEditing = (entry: NotebookEntry) => {
    setEditingId(entry.id);
    setCategory(entry.category);
    setTitle(entry.title);
    setBody(entry.body);
    setTagsRaw(entry.tags.join(', '));
    setFormError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setTagsRaw('');
    setFormError(null);
  };

  const visibleEntries = entries.filter((entry) => {
    if (filterTargetOnly && activeTarget && entry.targetId !== activeTarget.id) {
      return false;
    }
    if (filterCategory !== 'ALL' && entry.category !== filterCategory) {
      return false;
    }
    if (filterQuery.trim()) {
      const q = filterQuery.trim().toLowerCase();
      const haystack = `${entry.title} ${entry.body} ${entry.targetName} ${entry.tags.join(
        ' '
      )}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim() || !body.trim()) {
      setFormError('Both entry title and scientific notes are required.');
      return;
    }

    const parsedTags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      if (editingId) {
        await onUpdateEntry(editingId, {
          category,
          title: title.trim(),
          body: body.trim(),
          tags: parsedTags,
        });
        setEditingId(null);
      } else {
        const targetId = activeTarget?.id ?? pendingSnapshot?.planetName ?? 'general';
        const targetName = activeTarget?.planetName ?? pendingSnapshot?.planetName ?? 'General Log';
        await onCreateEntry({
          targetId,
          targetName,
          category,
          title: title.trim(),
          body: body.trim(),
          tags: parsedTags,
          parameterSnapshot: pendingSnapshot ?? undefined,
        });
        onClearPendingSnapshot();
      }
      setTitle('');
      setBody('');
      setTagsRaw('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save notebook entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="bg-[#0F151E] border border-slate-800 rounded"
      aria-labelledby="notebook-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-[#121A25]">
        <h2 id="notebook-title" className="text-sm font-semibold text-slate-100">
          My notes
        </h2>
        <span className="text-[11px] text-slate-400" title={
          storage === 'server'
            ? 'This deployment stores notes on its server for every signed-in user of the host platform.'
            : 'Notes are saved only in this browser on this device. Nobody else can see them; clearing site data deletes them. Export them to keep a copy.'
        }>
          {storage === 'server'
            ? 'Saved on this deployment’s shared server notebook'
            : 'Saved privately in this browser only — export to keep a copy'}
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Entry Editor Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-cyan-300">
              {editingId
                ? 'Edit note'
                : `New note${activeTarget ? ` on ${activeTarget.planetName}` : ''}`}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={cancelEditing}
                className="text-[11px] text-slate-400 hover:text-slate-100 underline underline-offset-2 cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          {!editingId && pendingSnapshot && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded border border-emerald-500/40 bg-emerald-950/25 text-xs text-emerald-200">
              <span>Planet values attached: {pendingSnapshot.planetName}</span>
              <button
                type="button"
                onClick={onClearPendingSnapshot}
                className="text-[11px] text-emerald-300 hover:text-emerald-100 underline cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}

          <label className="text-xs text-slate-300">
            <span className="block mb-1">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NotebookCategory)}
              className="w-full px-2.5 py-2 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-300">
            <span className="block mb-1">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Compare mass with the newer paper"
              required
              className="w-full px-2.5 py-2 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
            />
          </label>

          <label className="text-xs text-slate-300">
            <span className="block mb-1">Note</span>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What did you notice? What should be checked next?"
              required
              className="w-full px-2.5 py-2 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
            />
          </label>

          <label className="text-xs text-slate-300">
            <span className="block mb-1">Tags <span className="text-slate-500">(optional, separated by commas)</span></span>
            <input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="follow-up, radius"
              className="w-full px-2.5 py-2 text-xs font-mono bg-[#07090E] border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
            />
          </label>

          {formError && (
            <div
              className="p-2.5 rounded border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs"
              role="alert"
            >
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting
              ? 'Saving…'
              : editingId
              ? 'Save changes'
              : 'Save note'}
          </button>
        </form>

        {/* Recorded Entries Column */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <h3 className="text-xs font-semibold text-cyan-300">
              Your notes ({visibleEntries.length})
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Filter notebook entries"
                  placeholder="Filter notes…"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="pl-8 pr-2.5 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <select
                aria-label="Filter by category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as NotebookCategory | 'ALL')}
                className="px-2 py-1.5 text-xs bg-[#07090E] border border-slate-700 rounded text-slate-100 focus:border-cyan-400 focus:outline-none"
              >
                <option value="ALL">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {activeTarget && (
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterTargetOnly}
                    onChange={(e) => setFilterTargetOnly(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  <span>{activeTarget.planetName} only</span>
                </label>
              )}
            </div>
          </div>

          {visibleEntries.length === 0 ? (
            <div className="p-6 rounded border border-dashed border-slate-700 text-center text-xs text-slate-400">
              {entries.length === 0
                ? 'No notes yet. Open a planet and click “Save to notes” to start one.'
                : 'No notes match this filter.'}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="p-3.5 rounded border border-slate-800 bg-[#07090E]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] text-slate-400 mb-0.5">
                        <span>{entry.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{entry.targetName}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">{formatUtcTimestamp(entry.createdAtUtc)}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono">
                          {entry.syncState === 'synced'
                            ? 'Synced'
                            : entry.syncState === 'sync_error'
                            ? 'Not yet saved to server'
                            : 'This browser'}
                        </span>
                      </div>
                      <h4 className="text-[13px] font-semibold text-slate-100">{entry.title}</h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditing(entry)}
                        aria-label={`Edit notebook entry ${entry.title}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" aria-hidden="true" />
                        <span>Edit</span>
                      </button>

                      {confirmDeleteId === entry.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteEntry(entry.id);
                              setConfirmDeleteId(null);
                              if (editingId === entry.id) cancelEditing();
                            }}
                            className="px-2 py-1 text-[11px] font-medium rounded border border-rose-500/60 bg-rose-950/50 text-rose-200 hover:bg-rose-900/60 cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-[11px] rounded border border-slate-700 text-slate-300 hover:text-slate-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(entry.id)}
                          aria-label={`Delete notebook entry ${entry.title}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-rose-500/40 text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" aria-hidden="true" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {entry.body}
                  </p>

                  {entry.parameterSnapshot && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 font-mono tabular-nums text-[11px] text-slate-400">
                      Snapshot ({entry.parameterSnapshot.capturedFromMode}): P=
                      {entry.parameterSnapshot.periodDays ?? 'null'} d · Rp=
                      {entry.parameterSnapshot.radiusEarth ?? 'null'} R⊕ · {entry.parameterSnapshot.massIsMsini ? 'Mp sin i' : 'Mp'}=
                      {entry.parameterSnapshot.massEarth ?? 'null'} M⊕
                    </div>
                  )}

                  {entry.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 font-mono text-[11px] text-slate-400">
                      {entry.tags.map((t) => (
                        <span key={t}>#{t}</span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
