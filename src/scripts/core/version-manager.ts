// src/scripts/core/version-manager.ts
import { logger } from '../utilities/logger';
import { indexedDBManager, STORES } from '../utilities/indexeddb-manager';

/**
 * Version Manager - Handles cache busting and version migrations
 *
 * IMPORTANT: Update APP_VERSION in package.json when deploying breaking changes
 */

const VERSION_KEY = 'cde-app-version';

export class VersionManager {
  private static instance: VersionManager;
  private currentVersion: string;

  private constructor() {
    // Get version from package.json (injected at build time)
    // @ts-ignore - Vite injects this at build time
    this.currentVersion = import.meta.env.PUBLIC_APP_VERSION || '1.0.0';
  }

  public static getInstance(): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager();
    }
    return VersionManager.instance;
  }

  /**
   * Checks if the app version has changed and performs cleanup if needed
   */
  public async checkVersion(): Promise<void> {
    const storedVersion = localStorage.getItem(VERSION_KEY);

    if (!storedVersion) {
      // First time user
      logger.log(`[VersionManager] First time user, setting version: ${this.currentVersion}`);
      localStorage.setItem(VERSION_KEY, this.currentVersion);
      return;
    }

    if (storedVersion !== this.currentVersion) {
      logger.warn(
        `[VersionManager] Version mismatch! Stored: ${storedVersion}, Current: ${this.currentVersion}`
      );
      await this.performVersionUpdate(storedVersion, this.currentVersion);
    } else {
      logger.log(`[VersionManager] Version check passed: ${this.currentVersion}`);
    }
  }

  /**
   * Performs cleanup and migration when version changes
   */
  private async performVersionUpdate(oldVersion: string, newVersion: string): Promise<void> {
    logger.log(`[VersionManager] Updating from ${oldVersion} to ${newVersion}`);

    try {
      // 1. Clear all localStorage except critical data
      await this.clearCache();

      // 2. Clear service worker cache if exists
      await this.clearServiceWorkerCache();

      // 3. Update version
      localStorage.setItem(VERSION_KEY, newVersion);

      // 4. Mark that we need to show update sequence on next boot
      localStorage.setItem('cde-pending-update', 'true');

      // 5. Force reload to show update sequence
      logger.log('[VersionManager] Forcing page reload to show update sequence...');
      window.location.reload();
    } catch (error) {
      logger.error('[VersionManager] Error during version update:', error);
    }
  }

  /**
   * Clears storage cache while preserving critical data
   */
  private async clearCache(): Promise<void> {
    logger.log('[VersionManager] Clearing storage cache...');

    // Keys that should survive version updates
    const preserveKeys: string[] = [
      'cde-system-settings', 
      'cde-session', 
      'cde-indexeddb-migrated',
      'dtmail-mailboxes',
      'cde-workspace-config'
    ];

    // Get all keys from localStorage
    const allKeys = Object.keys(localStorage);

    // Remove all except preserved
    allKeys.forEach((key) => {
      if (!preserveKeys.includes(key) && key !== VERSION_KEY) {
        localStorage.removeItem(key);
        logger.log(`[VersionManager] Removed: ${key}`);
      }
    });

    // Also clear IndexedDB cache, not settings! Settings and filesystem should survive updates.
    try {
      await indexedDBManager.clear(STORES.CACHE);
      logger.log('[VersionManager] Cleared IndexedDB cached data');
    } catch (error) {
      logger.warn('[VersionManager] Could not clear IndexedDB:', error);
    }
  }

  /**
   * Clears service worker cache if available
   */
  private async clearServiceWorkerCache(): Promise<void> {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => {
            logger.log(`[VersionManager] Deleting cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
        logger.log('[VersionManager] All caches cleared');
      } catch (error) {
        logger.error('[VersionManager] Error clearing caches:', error);
      }
    }
  }

  /**
   * Checks if there's a pending update to show
   */
  public hasPendingUpdate(): boolean {
    return localStorage.getItem('cde-pending-update') === 'true';
  }

  /**
   * Clears the pending update flag
   */
  public clearPendingUpdate(): void {
    localStorage.removeItem('cde-pending-update');
  }

  /**
   * Gets the current app version
   */
  public getVersion(): string {
    return this.currentVersion;
  }

  /**
   * Forces a cache clear and reload (for manual use)
   */
  public async forceUpdate(): Promise<void> {
    logger.log('[VersionManager] Force update requested');
    await this.clearCache();
    await this.clearServiceWorkerCache();
    window.location.reload();
  }
}

// Global exposure for debugging
if (typeof window !== 'undefined') {
  (window as any).VersionManager = VersionManager.getInstance();
}

export default VersionManager.getInstance();
