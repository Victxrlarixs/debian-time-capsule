// src/scripts/utilities/storage-adapter.ts
// Unified storage adapter that uses IndexedDB with localStorage fallback

import { indexedDBManager, STORES } from './indexeddb-manager';
import { logger } from './logger';

/**
 * Storage adapter that transparently uses IndexedDB with localStorage fallback
 */
class StorageAdapter {
  private useIndexedDB = true;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the storage adapter
   */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await indexedDBManager.init();
        this.useIndexedDB = true;
        logger.log('[StorageAdapter] Using IndexedDB');
      } catch (error) {
        logger.warn('[StorageAdapter] IndexedDB unavailable, falling back to localStorage:', error);
        this.useIndexedDB = false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Get a value from storage
   */
  async getItem(key: string): Promise<string | null> {
    await this.init();

    if (this.useIndexedDB) {
      try {
        const value = await indexedDBManager.get<string>(STORES.SETTINGS, key);
        return value;
      } catch (error) {
        logger.warn(
          `[StorageAdapter] IndexedDB get failed for ${key}, trying localStorage:`,
          error
        );
        return localStorage.getItem(key);
      }
    }

    return localStorage.getItem(key);
  }

  /**
   * Set a value in storage
   */
  async setItem(key: string, value: string): Promise<void> {
    await this.init();

    if (this.useIndexedDB) {
      try {
        await indexedDBManager.set(STORES.SETTINGS, key, value);
        // Explicitly clear legacy duplicate from LocalStorage to reclaim the 5MB browser quota
        localStorage.removeItem(key);
      } catch (error) {
        logger.warn(`[StorageAdapter] IndexedDB set failed for ${key}, using localStorage:`, error);
        localStorage.setItem(key, value);
      }
    } else {
      localStorage.setItem(key, value);
    }
  }

  /**
   * Remove a value from storage
   */
  async removeItem(key: string): Promise<void> {
    await this.init();

    if (this.useIndexedDB) {
      try {
        await indexedDBManager.delete(STORES.SETTINGS, key);
        // Explicitly clear from LocalStorage to prevent ghost data resurrecting on fallback
        localStorage.removeItem(key);
      } catch (error) {
        logger.warn(
          `[StorageAdapter] IndexedDB delete failed for ${key}, using localStorage:`,
          error
        );
        localStorage.removeItem(key);
      }
    } else {
      localStorage.removeItem(key);
    }
  }

  /**
   * Get all keys from storage
   */
  async getAllKeys(): Promise<string[]> {
    await this.init();

    if (this.useIndexedDB) {
      try {
        return await indexedDBManager.getAllKeys(STORES.SETTINGS);
      } catch (error) {
        logger.warn('[StorageAdapter] IndexedDB getAllKeys failed, using localStorage:', error);
        return Object.keys(localStorage);
      }
    }

    return Object.keys(localStorage);
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    await this.init();

    if (this.useIndexedDB) {
      try {
        await indexedDBManager.clear(STORES.SETTINGS);
        localStorage.clear();
      } catch (error) {
        logger.warn('[StorageAdapter] IndexedDB clear failed, using localStorage:', error);
        localStorage.clear();
      }
    } else {
      localStorage.clear();
    }
  }

  /**
   * Synchronous get (uses localStorage only, for compatibility)
   */
  getItemSync(key: string): string | null {
    return localStorage.getItem(key);
  }

  /**
   * Synchronous set (uses localStorage only, for compatibility)
   */
  setItemSync(key: string, value: string): void {
    localStorage.setItem(key, value);

    // Async update to IndexedDB in background
    if (this.useIndexedDB) {
      this.setItem(key, value).catch((error) => {
        logger.warn(`[StorageAdapter] Background IndexedDB update failed for ${key}:`, error);
      });
    }
  }

  /**
   * Synchronous remove (uses localStorage only, for compatibility)
   */
  removeItemSync(key: string): void {
    localStorage.removeItem(key);

    // Async delete from IndexedDB in background
    if (this.useIndexedDB) {
      this.removeItem(key).catch((error) => {
        logger.warn(`[StorageAdapter] Background IndexedDB delete failed for ${key}:`, error);
      });
    }
  }

  /**
   * Check if using IndexedDB
   */
  isUsingIndexedDB(): boolean {
    return this.useIndexedDB;
  }
}

// Singleton instance
export const storageAdapter = new StorageAdapter();

// Export for backward compatibility
export const storage = {
  getItem: (key: string) => storageAdapter.getItemSync(key),
  setItem: (key: string, value: string) => storageAdapter.setItemSync(key, value),
  removeItem: (key: string) => storageAdapter.removeItemSync(key),
  clear: () => localStorage.clear(),
  key: (index: number) => localStorage.key(index),
  get length() {
    return localStorage.length;
  },
};
