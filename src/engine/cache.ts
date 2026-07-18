const DB_NAME = 'sfEngineCache';
const STORE = 'engines';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, VERSION);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

export async function cacheGet<T = any>(key: string): Promise<T | null> {
    try {
        const db = await openDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch { return null; }
}

export async function cachePut(key: string, value: any): Promise<void> {
    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch { /* noop */ }
}

export async function cacheDelete(key: string): Promise<void> {
    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch { /* noop */ }
}
