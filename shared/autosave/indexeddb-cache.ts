/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Thin wrapper over IndexedDB for client-side draft autosave per
 * D072 §8. Promise-based key/value API, single object store, no
 * versioning beyond the initial schema. Falls back to an in-memory
 * Map when IndexedDB is unavailable (Safari private mode, very old
 * browsers, SSR) so the calling code never has to branch.
 *
 * Phase 1 ships only this client-side layer. The three-stage gradient
 * (server-promote-after-inactivity → server-only-autosave-thereafter)
 * is `bu-drafts-inbox` (Phase 2). Until then the form's submit handler
 * is the sole server-promote trigger; this cache prevents tab-refresh
 * data loss but never reaches the server on its own.
 */

const DB_NAME = 'gps-action-autosave';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;

type CacheRecord = {
  key: string;
  value: unknown;
  updatedAt: number;
};

let cachedDb: IDBDatabase | null = null;
let cachedDbPromise: Promise<IDBDatabase | null> | null = null;
const memoryFallback = new Map<string, CacheRecord>();

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

async function openDb(): Promise<IDBDatabase | null> {
  if (cachedDb) return cachedDb;
  if (!isIndexedDbAvailable()) return null;
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      cachedDb = req.result;
      resolve(cachedDb);
    };
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });

  return cachedDbPromise;
}

export async function autosaveCacheGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) {
    const record = memoryFallback.get(key);
    return (record?.value as T | undefined) ?? null;
  }
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const record = req.result as CacheRecord | undefined;
        resolve((record?.value as T | undefined) ?? null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function autosaveCacheSet(key: string, value: unknown): Promise<boolean> {
  const record: CacheRecord = { key, value, updatedAt: Date.now() };
  const db = await openDb();
  if (!db) {
    memoryFallback.set(key, record);
    return true;
  }
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function autosaveCacheDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    memoryFallback.delete(key);
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Test-only — drops the in-memory fallback + closes any cached DB
 * handle so a fresh test can start clean.
 */
export function __resetAutosaveCacheForTests(): void {
  memoryFallback.clear();
  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
  }
  cachedDbPromise = null;
}
