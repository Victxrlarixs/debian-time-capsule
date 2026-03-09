// src/scripts/core/settingsmanager.ts

import { logger } from '../utilities/logger';
import { storageAdapter } from '../utilities/storage-adapter';
import type { ISettingsManager } from './interfaces/settings-manager.interface';
import type { ISessionStorage, WindowState } from './interfaces/window-manager.interface';

export interface SystemSettings {
  theme: {
    colors: Record<string, string>;
    fonts: Record<string, string>;
    paletteId?: string;
    backdrop?: Record<string, any>;
    screen?: Record<string, any>;
    startup?: Record<string, any>;
    windowBehavior?: Record<string, any>;
  };
  mouse: Record<string, any>;
  keyboard: Record<string, any>;
  beep: Record<string, any>;
  session: {
    windows: Record<
      string,
      {
        top: string;
        left: string;
        display: string;
        maximized: boolean;
      }
    >;
  };
  desktop: Record<string, any>;
}

const STORAGE_KEY = 'cde-system-settings';

/**
 * SettingsManager - Manages system-wide settings with persistence
 * Now implements ISettingsManager and ISessionStorage for DI compatibility
 */
class SettingsManager implements ISettingsManager, ISessionStorage {
  private static instance: SettingsManager;
  private settings: SystemSettings;
  private readonly CURRENT_VERSION = '1.1.1';

  private constructor() {
    this.settings = this.getDefaultSettings();
    this.load();
    this.checkVersion();
  }

  private checkVersion(): void {
    const lastVersion = storageAdapter.getItemSync(`${STORAGE_KEY}-version`);
    if (lastVersion !== this.CURRENT_VERSION) {
      logger.log(
        `[SettingsManager] Version mismatch (${lastVersion} vs ${this.CURRENT_VERSION}). Resetting cache...`
      );
      this.resetToDefaults();
      storageAdapter.setItemSync(`${STORAGE_KEY}-version`, this.CURRENT_VERSION);
    }
  }

  private resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
    this.save();
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  private getDefaultSettings(): SystemSettings {
    return {
      theme: {
        colors: {},
        fonts: {},
        paletteId: undefined,
        backdrop: undefined,
        screen: undefined,
        startup: undefined,
        windowBehavior: undefined,
      },
      mouse: {},
      keyboard: {},
      beep: {},
      session: { windows: {} },
      desktop: {},
    };
  }

  /**
   * Loads settings from storage (IndexedDB with localStorage fallback).
   */
  private load(): void {
    try {
      const saved = storageAdapter.getItemSync(STORAGE_KEY);
      if (saved) {
        this.settings = JSON.parse(saved);
        logger.log('[SettingsManager] Unified settings loaded.');
      } else {
        this.migrateLegacySettings();
      }
    } catch (e) {
      console.error('[SettingsManager] Failed to load settings:', e);
    }
  }

  /**
   * Migrates settings from fragmented legacy keys to the new unified key.
   */
  private migrateLegacySettings(): void {
    logger.log('[SettingsManager] Attempting migration from legacy settings...');

    // Migration for Style/Theme (cde-styles)
    const oldStyles = storageAdapter.getItemSync('cde-styles');
    if (oldStyles) {
      const parsed = JSON.parse(oldStyles);
      this.settings.theme.colors = parsed.colors || {};
      this.settings.theme.fonts = parsed.fonts || {};
    }

    // Migration for Mouse
    const oldMouse = storageAdapter.getItemSync('cde-mouse-settings');
    if (oldMouse) this.settings.mouse = JSON.parse(oldMouse);

    // Migration for Keyboard
    const oldKeyboard = storageAdapter.getItemSync('cde-keyboard-settings');
    if (oldKeyboard) this.settings.keyboard = JSON.parse(oldKeyboard);

    // Migration for Beep
    const oldBeep = storageAdapter.getItemSync('cde-beep-settings');
    if (oldBeep) this.settings.beep = JSON.parse(oldBeep);

    this.save();
    logger.log('[SettingsManager] Migration completed.');
  }

  public save(): void {
    try {
      storageAdapter.setItemSync(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.error('[SettingsManager] Failed to save settings:', e);
    }
  }

  public setSection(section: keyof SystemSettings, data: any): void {
    (this.settings as any)[section] = data;
    this.save();
  }

  public getSection(section: keyof SystemSettings): any {
    return this.settings[section];
  }

  public updateWindowSession(id: string, data: any): void {
    this.settings.session.windows[id] = { ...this.settings.session.windows[id], ...data };
    this.save();
  }

  public getAll(): SystemSettings {
    return this.settings;
  }

  // ISessionStorage implementation
  saveWindowState(id: string, state: WindowState): void {
    this.updateWindowSession(id, state);
  }

  loadWindowState(id: string): WindowState | null {
    return this.settings.session.windows[id] || null;
  }
}

export const settingsManager = SettingsManager.getInstance();
