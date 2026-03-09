// src/scripts/core/adapters/settingsmanager.adapter.ts

import { settingsManager } from '../settingsmanager';
import type { ISettingsManager } from '../interfaces/settings-manager.interface';
import type { ISessionStorage } from '../interfaces/window-manager.interface';

/**
 * Adapter for SettingsManager
 * Since SettingsManager now implements the interfaces directly,
 * this adapter simply re-exports it for DI container compatibility
 */
export class SettingsManagerAdapter implements ISettingsManager, ISessionStorage {
  // Delegate all calls to the singleton instance
  save(): void {
    settingsManager.save();
  }

  getSection<K extends keyof import('../settingsmanager').SystemSettings>(
    section: K
  ): import('../settingsmanager').SystemSettings[K] {
    return settingsManager.getSection(section);
  }

  setSection<K extends keyof import('../settingsmanager').SystemSettings>(
    section: K,
    data: import('../settingsmanager').SystemSettings[K]
  ): void {
    settingsManager.setSection(section, data);
  }

  updateWindowSession(id: string, data: any): void {
    settingsManager.updateWindowSession(id, data);
  }

  getAll(): import('../settingsmanager').SystemSettings {
    return settingsManager.getAll();
  }

  saveWindowState(
    id: string,
    state: import('../interfaces/window-manager.interface').WindowState
  ): void {
    settingsManager.saveWindowState(id, state);
  }

  loadWindowState(id: string): import('../interfaces/window-manager.interface').WindowState | null {
    return settingsManager.loadWindowState(id);
  }
}
