// src/scripts/shared/style-module-base.ts
// Base class for Style Manager modules to eliminate duplication

import { logger } from '../utilities/logger';
import { container } from '../core/container';
import type { ISettingsManager } from '../core/interfaces/settings-manager.interface';

/**
 * Configuration for a Style Module
 */
export interface StyleModuleConfig<T> {
  /** Module name for logging */
  name: string;
  /** Settings manager section key */
  settingsKey: string;
  /** Default settings */
  defaultSettings: T;
  /** Optional panel ID for syncUI */
  panelId?: string;
}

/**
 * Base class for Style Manager modules
 * Eliminates duplicated load/save/apply patterns
 * Uses Dependency Injection via container
 */
export abstract class StyleModuleBase<T extends Record<string, any>> {
  protected config: StyleModuleConfig<T>;
  public settings: T;
  protected settingsManager: ISettingsManager;

  constructor(config: StyleModuleConfig<T>, injectedSettings?: ISettingsManager) {
    this.config = config;
    this.settings = { ...config.defaultSettings };
    // Use injected settings manager or get from container
    this.settingsManager = injectedSettings || container.get<ISettingsManager>('settings');
  }

  /**
   * Loads settings from SettingsManager
   * Override to add custom loading logic
   */
  public load(): void {
    const saved = this.settingsManager.getSection(this.config.settingsKey as any);
    if (saved && Object.keys(saved).length > 0) {
      Object.assign(this.settings, saved);
      logger.log(`[${this.config.name}] Loaded from SettingsManager:`, this.settings);
    }
    this.apply();
  }

  /**
   * Saves settings to SettingsManager
   * Override to add custom saving logic
   */
  public save(): void {
    this.settingsManager.setSection(this.config.settingsKey as any, this.settings);
    logger.log(`[${this.config.name}] Saved to SettingsManager:`, this.settings);
  }

  /**
   * Applies current settings
   * Must be implemented by subclasses
   */
  public abstract apply(): void;

  /**
   * Updates a specific setting
   * Override to add custom update logic
   */
  public update(key: keyof T, value: any): void {
    if (key in this.settings) {
      this.settings[key] = value;
      this.apply();
      this.save();
      logger.log(`[${this.config.name}] "${String(key)}" updated to ${value}`);
    } else {
      console.warn(`[${this.config.name}] Unknown key: "${String(key)}"`);
    }
  }

  /**
   * Synchronizes UI with current settings
   * Override to implement module-specific UI sync
   */
  public syncUI(): void {
    if (!this.config.panelId) return;

    const panel = document.getElementById(this.config.panelId);
    if (!panel) {
      logger.warn(`[${this.config.name}] Panel not found: ${this.config.panelId}`);
      return;
    }

    this.syncUIImpl(panel);
    logger.log(`[${this.config.name}] UI synchronized`);
  }

  /**
   * Implementation of UI synchronization
   * Override to provide module-specific UI sync logic
   */
  protected syncUIImpl(panel: HTMLElement): void {
    // Default implementation: sync all inputs with data-key attributes
    Object.entries(this.settings).forEach(([key, value]) => {
      const input = panel.querySelector(`input[data-key="${key}"]`) as HTMLInputElement;
      if (input) {
        if (input.type === 'checkbox' || input.type === 'radio') {
          input.checked = input.value === String(value);
        } else {
          input.value = String(value);
        }
      }
    });
  }

  /**
   * Helper to sync a slider with its value display
   */
  protected syncSlider(
    panel: HTMLElement,
    key: string,
    value: number,
    transform?: (val: number) => string
  ): void {
    const slider = panel.querySelector(`input[data-key="${key}"]`) as HTMLInputElement;
    if (slider) {
      slider.value = String(value);

      // Update associated value display if it exists
      const valueDisplay =
        slider.nextElementSibling ||
        slider.parentElement?.querySelector('.slider-value, .cde-slidervalue, span:last-child');

      if (valueDisplay) {
        valueDisplay.textContent = transform ? transform(value) : String(value);
      }
    }
  }

  /**
   * Helper to sync radio buttons
   */
  protected syncRadio(panel: HTMLElement, name: string, value: string): void {
    const radio = panel.querySelector(
      `input[name="${name}"][value="${value}"]`
    ) as HTMLInputElement;
    if (radio) {
      radio.checked = true;
    }
  }

  /**
   * Helper to get panel element
   */
  protected getPanel(): HTMLElement | null {
    if (!this.config.panelId) return null;
    return document.getElementById(this.config.panelId);
  }
}
