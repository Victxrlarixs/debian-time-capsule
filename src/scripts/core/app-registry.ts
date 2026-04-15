// src/scripts/core/app-registry.ts

import { logger } from '../utilities/logger';
import type {
  AppManifest,
  AppRegistryEntry,
  IApplication,
  AppCategory,
} from './interfaces/application.interface';

/**
 * Central registry for all applications in the CDE environment.
 * Handles app registration, discovery, and lifecycle management.
 */
export class ApplicationRegistry {
  private apps = new Map<string, AppRegistryEntry>();

  /**
   * Register a new application
   */
  register(manifest: AppManifest, factory: () => Promise<IApplication>): void {
    if (this.apps.has(manifest.id)) {
      logger.warn(`[AppRegistry] Overwriting app registration: ${manifest.id}`);
    }

    this.apps.set(manifest.id, {
      manifest,
      factory,
    });

    logger.log(`[AppRegistry] Registered: ${manifest.name} (${manifest.id})`);
  }

  /**
   * Get all registered manifests
   */
  getAllManifests(): AppManifest[] {
    return Array.from(this.apps.values())
      .map((entry) => entry.manifest)
      .filter((m) => !m.hidden);
  }

  /**
   * Get manifests by category
   */
  getManifestsByCategory(category: AppCategory): AppManifest[] {
    return this.getAllManifests().filter((m) => m.category === category);
  }

  /**
   * Get manifest by ID
   */
  getManifest(id: string): AppManifest | undefined {
    return this.apps.get(id)?.manifest;
  }

  /**
   * Launch an application
   */
  async launch(id: string, args?: any): Promise<void> {
    const entry = this.apps.get(id);
    if (!entry) {
      logger.error(`[AppRegistry] Cannot launch: App '${id}' not found`);
      return;
    }

    try {
      // Load instance if not already cached
      if (!entry.instance) {
        logger.log(`[AppRegistry] Instantiating: ${id}...`);
        entry.instance = await entry.factory();
        if (entry.instance.init) {
          await entry.instance.init();
        }
      }

      // Open the app
      await entry.instance.open(args);
      logger.log(`[AppRegistry] Launched: ${id}`);
    } catch (error) {
      logger.error(`[AppRegistry] Failed to launch ${id}:`, error);
    }
  }

  /**
   * Close an application
   */
  async close(id: string): Promise<void> {
    const entry = this.apps.get(id);
    if (entry?.instance?.close) {
      await entry.instance.close();
    }
  }
}

// Singleton instance
export const appRegistry = new ApplicationRegistry();

// Global access for legacy or inline script support
if (typeof window !== 'undefined') {
  (window as any).appRegistry = appRegistry;
}
