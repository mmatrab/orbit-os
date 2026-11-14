import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  CreateNotebookEntryRequest,
  ExportSubmissionRequest,
  ExportSubmissionResponse,
  NotebookEntry,
  UpdateNotebookEntryRequest,
} from '../src/api/contracts.ts';

let DATA_DIR = path.resolve(process.cwd(), 'data');
let NOTEBOOK_FILE = path.join(DATA_DIR, 'notebook.json');
let EXPORTS_FILE = path.join(DATA_DIR, 'exports.json');

/** Points the store at the module's own data directory (ORBIT_DATA_DIR). */
export function configureNotebookStore(dataDir: string): void {
  DATA_DIR = path.resolve(dataDir);
  NOTEBOOK_FILE = path.join(DATA_DIR, 'notebook.json');
  EXPORTS_FILE = path.join(DATA_DIR, 'exports.json');
}

/**
 * All read-modify-write operations run one at a time. Without this, two concurrent
 * requests read the same file and the second write silently drops the first entry.
 */
let writeChain: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.catch(() => undefined);
  return run;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function writeJsonArray<T>(filePath: string, data: T[]): Promise<void> {
  await ensureDataDir();
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmpPath, filePath);
}

export async function listNotebookEntries(targetId?: string): Promise<NotebookEntry[]> {
  const entries = await readJsonArray<NotebookEntry>(NOTEBOOK_FILE);
  if (!targetId) return entries;
  return entries.filter((e) => e.targetId === targetId);
}

export async function createNotebookEntry(
  payload: CreateNotebookEntryRequest
): Promise<NotebookEntry> {
  return serialized(async () => {
    const entries = await readJsonArray<NotebookEntry>(NOTEBOOK_FILE);
    const now = new Date().toISOString();
    const entry: NotebookEntry = {
      id: crypto.randomUUID(),
      targetId: payload.targetId,
      targetName: payload.targetName,
      category: payload.category,
      title: payload.title.trim(),
      body: payload.body.trim(),
      tags: Array.isArray(payload.tags) ? payload.tags.map((t) => t.trim()).filter(Boolean) : [],
      createdAtUtc: now,
      updatedAtUtc: now,
      parameterSnapshot: payload.parameterSnapshot,
      syncState: 'synced',
    };
    await writeJsonArray(NOTEBOOK_FILE, [entry, ...entries]);
    return entry;
  });
}

export async function updateNotebookEntry(
  id: string,
  payload: UpdateNotebookEntryRequest
): Promise<NotebookEntry | null> {
  return serialized(async () => {
    const entries = await readJsonArray<NotebookEntry>(NOTEBOOK_FILE);
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return null;

    const existing = entries[idx];
    const updated: NotebookEntry = {
      ...existing,
      category: payload.category ?? existing.category,
      title: payload.title !== undefined ? payload.title.trim() : existing.title,
      body: payload.body !== undefined ? payload.body.trim() : existing.body,
      tags:
        payload.tags !== undefined
          ? payload.tags.map((t) => t.trim()).filter(Boolean)
          : existing.tags,
      updatedAtUtc: new Date().toISOString(),
      syncState: 'synced',
    };

    const next = [...entries];
    next[idx] = updated;
    await writeJsonArray(NOTEBOOK_FILE, next);
    return updated;
  });
}

export async function deleteNotebookEntry(id: string): Promise<boolean> {
  return serialized(async () => {
    const entries = await readJsonArray<NotebookEntry>(NOTEBOOK_FILE);
    const next = entries.filter((e) => e.id !== id);
    if (next.length === entries.length) return false;
    await writeJsonArray(NOTEBOOK_FILE, next);
    return true;
  });
}

interface ExportAuditRecord extends ExportSubmissionRequest {
  exportId: string;
  archivedAtUtc: string;
  checksumSha256: string;
}

export async function recordExportAudit(
  payload: ExportSubmissionRequest
): Promise<ExportSubmissionResponse> {
  return serialized(async () => {
    const records = await readJsonArray<ExportAuditRecord>(EXPORTS_FILE);
    const exportId = `exp_${crypto.randomUUID().slice(0, 12)}`;
    const archivedAtUtc = new Date().toISOString();
    const checksumSha256 = crypto
      .createHash('sha256')
      .update(JSON.stringify({ ...payload, exportId, archivedAtUtc }))
      .digest('hex');

    const record: ExportAuditRecord = {
      ...payload,
      exportId,
      archivedAtUtc,
      checksumSha256,
    };

    await writeJsonArray(EXPORTS_FILE, [record, ...records]);
    return { exportId, archivedAtUtc, checksumSha256 };
  });
}
