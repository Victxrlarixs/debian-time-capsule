// src/scripts/core/interfaces/settings-manager.interface.ts

import type { SystemSettings } from '../settingsmanager';

/**
 * Interface for Settings Management operations
 * Defines the contract for loading, saving, and managing system settings
 */
export interface ISettingsManager {
  /**
   * Save all settings to persistent storage
   */
  save(): void;

  /**
   * Get a specific settings section
   * @param section - The section key
   * @returns The section data
   */
  getSection<K extends keyof SystemSettings>(section: K): SystemSettings[K];

  /**
   * Update a specific settings section
   * @param section - The section key
   * @param data - The new section data
   */
  setSection<K extends keyof SystemSettings>(section: K, data: SystemSettings[K]): void;

  /**
   * Update window session state
   * @param id - Window ID
   * @param data - Window state data
   */
  updateWindowSession(id: string, data: any): void;

  /**
   * Get all settings
   * @returns Complete settings object
   */
  getAll(): SystemSettings;
}
