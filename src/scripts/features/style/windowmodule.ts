// src/scripts/features/style/windowmodule.ts

import { logger } from '../../utilities/logger';
import { settingsManager } from '../../core/settingsmanager';

/**
 * Window behavior settings for CDE.
 */
export interface WindowSettings {
  pointToFocus: boolean;
  clickToFocus: boolean;
  raiseOnActive: boolean;
  opaqueDragging: boolean;
  useIconBox: boolean;
}

/**
 * Module to manage window behavior and appearance settings.
 */
export class WindowModule {
  public settings: WindowSettings = {
    pointToFocus: false,
    clickToFocus: true,
    raiseOnActive: true,
    opaqueDragging: true,
    useIconBox: false,
  };

  /**
   * Initializes the window module and applies saved settings.
   */
  public load(): void {
    const saved = settingsManager.getSection('theme').windowBehavior;
    if (saved) {
      Object.assign(this.settings, saved);
    }
    this.apply();
    logger.log('[WindowModule] Loaded and applied:', this.settings);
  }

  /**
   * Applies the current window settings to the system.
   */
  public apply(): void {
    document.documentElement.setAttribute(
      'data-focus-mode',
      this.settings.pointToFocus ? 'point' : 'click'
    );
    document.documentElement.setAttribute('data-opaque-drag', String(this.settings.opaqueDragging));

    logger.log('[WindowModule] Applied settings to document attributes');
  }

  /**
   * Updates a specific window setting and persists it.
   */
  public update(key: keyof WindowSettings, value: boolean): void {
    if (key in this.settings) {
      this.settings[key] = value;
      this.apply();
      this.save();
      logger.log(`[WindowModule] "${key}" updated to ${value}`);
    }
  }

  /**
   * Persists the current window settings.
   */
  private save(): void {
    const theme = settingsManager.getSection('theme');
    theme.windowBehavior = this.settings;
    settingsManager.setSection('theme', theme);
  }

  /**
   * Syncs the UI state in StyleManagerWindows.astro.
   */
  public syncUI(): void {
    const panel = document.getElementById('styleManagerWindow');
    if (!panel) return;

    const mapping = {
      'window-point': 'pointToFocus',
      'window-click': 'clickToFocus',
      'window-raise': 'raiseOnActive',
      'window-show': 'opaqueDragging',
      'window-iconbox': 'useIconBox',
    };

    Object.entries(mapping).forEach(([id, settingKey]) => {
      const input = document.getElementById(id) as HTMLInputElement;
      if (input) {
        input.checked = this.settings[settingKey as keyof WindowSettings];
      }
    });

    logger.log('[WindowModule] UI synchronized');
  }
}
