// src/scripts/utilities/indexeddb-manager.ts
// IndexedDB manager for robust persistence (replaces localStorage for large data)

import { logger } from './logger';

const DB_NAME = 'cde-desktop';
const DB_VERSION = 1;
const STORES = {
  SETTINGS: 'settings',
  SESSION: 'session',
  FILESYSTEM: 'filesystem',
  CACHE: 'cache',
} as const;

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB connection
   */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('[IndexedDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        logger.log('[IndexedDB] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        logger.log('[IndexedDB] Upgrading database schema...');

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.SESSION)) {
          db.createObjectStore(STORES.SESSION, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORES.FILESYSTEM)) {
          const fsStore = db.createObjectStore(STORES.FILESYSTEM, { keyPath: 'path' });
          fsStore.createIndex('type', 'type', { unique: false });
          fsStore.createIndex('mtime', 'metadata.mtime', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.CACHE)) {
          const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        logger.log('[IndexedDB] Database schema upgraded');
      };
    });

    return this.initPromise;
  }

  /**
   * Get a value from a store
   */
  async get<T>(storeName: string, key: string): Promise<T | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result?.value ?? null);
      };

      request.onerror = () => {
        logger.error(`[IndexedDB] Failed to get ${key} from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Set a value in a store
   */
  async set(storeName: string, key: string, value: any): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put({ key, value, timestamp: Date.now() });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        logger.error(`[IndexedDB] Failed to set ${key} in ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a value from a store
   */
  async delete(storeName: string, key: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        logger.error(`[IndexedDB] Failed to delete ${key} from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all keys from a store
   */
  async getAllKeys(storeName: string): Promise<string[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };

      request.onerror = () => {
        logger.error(`[IndexedDB] Failed to get all keys from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all data from a store
   */
  async clear(storeName: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        logger.log(`[IndexedDB] Cleared store: ${storeName}`);
        resolve();
      };

      request.onerror = () => {
        logger.error(`[IndexedDB] Failed to clear ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Migrate data from localStorage to IndexedDB
   */
  async migrateFromLocalStorage(): Promise<void> {
    logger.log('[IndexedDB] Starting migration from localStorage...');

    try {
      // Migrate settings
      const settingsKey = 'cde-system-settings';
      const settingsData = localStorage.getItem(settingsKey);
      if (settingsData) {
        await this.set(STORES.SETTINGS, 'system', JSON.parse(settingsData));
        logger.log('[IndexedDB] Migrated settings');
      }

      // Migrate session
      const sessionKey = 'cde-session';
      const sessionData = localStorage.getItem(sessionKey);
      if (sessionData) {
        await this.set(STORES.SESSION, 'windows', JSON.parse(sessionData));
        logger.log('[IndexedDB] Migrated session');
      }

      logger.log('[IndexedDB] Migration completed');
    } catch (error) {
      logger.error('[IndexedDB] Migration failed:', error);
    }
  }

  /**
   * Get database size estimate
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  }

  /**
   * Clean up old cache entries
   */
  async cleanupCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    await this.init();
    if (!this.db) return;

    const cutoff = Date.now() - maxAge;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.CACHE, 'readwrite');
      const store = transaction.objectStore(STORES.CACHE);
      const index = store.index('timestamp');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoff));

      let deletedCount = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          logger.log(`[IndexedDB] Cleaned up ${deletedCount} old cache entries`);
          resolve();
        }
      };

      request.onerror = () => {
        logger.error('[IndexedDB] Failed to cleanup cache:', request.error);
        reject(request.error);
      };
    });
  }
}

// Singleton instance
export const indexedDBManager = new IndexedDBManager();

// Store names export
export { STORES };
