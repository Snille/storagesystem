import { randomUUID } from "node:crypto";
import { promises as fs, statSync } from "node:fs";
import path from "node:path";

// Shared helpers for the JSON files in data/. The app runs as one Node process,
// so an in-process lock is enough to keep read-modify-write cycles from overlapping.

export function getDataDir() {
  return process.env.LAGERSYSTEM_DATA_DIR?.trim() || path.join(process.cwd(), "data");
}

export function dataFilePath(...parts: string[]) {
  return path.join(getDataDir(), ...parts);
}

const locks = new Map<string, Promise<unknown>>();

/** Runs `task` after every earlier task with the same key has finished. */
export function withFileLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const settled = run.catch(() => undefined);
  locks.set(key, settled);
  void settled.then(() => {
    if (locks.get(key) === settled) {
      locks.delete(key);
    }
  });
  return run;
}

async function renameWithRetry(from: string, to: string) {
  // Windows can briefly refuse to replace a file that another handle is reading.
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 4 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

/** Writes to a temp file, flushes it, then renames it over the target. Readers never see half a file. */
export async function writeFileAtomic(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    const handle = await fs.open(tempPath, "w");
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await renameWithRetry(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
}

/** Identifies one version of a file on disk; null when the file is missing. */
export function fileStampSync(filePath: string) {
  try {
    const stats = statSync(filePath);
    return `${stats.mtimeMs}:${stats.size}`;
  } catch {
    return null;
  }
}

export async function fileStamp(filePath: string) {
  try {
    const stats = await fs.stat(filePath);
    return `${stats.mtimeMs}:${stats.size}`;
  } catch {
    return null;
  }
}

/**
 * Remembers the parsed value of a file until the file changes on disk.
 * Callers get a deep copy, so mutating a result never changes the cache.
 */
export function createFileCache<T>() {
  const entries = new Map<string, { stamp: string; value: T }>();

  return {
    get(filePath: string, stamp: string | null): T | undefined {
      const entry = entries.get(filePath);
      return stamp && entry?.stamp === stamp ? structuredClone(entry.value) : undefined;
    },
    set(filePath: string, stamp: string | null, value: T) {
      if (stamp) {
        entries.set(filePath, { stamp, value: structuredClone(value) });
      } else {
        entries.delete(filePath);
      }
    },
    clear() {
      entries.clear();
    }
  };
}
