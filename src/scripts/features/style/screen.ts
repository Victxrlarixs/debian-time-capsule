// src/scripts/features/style/screen.ts

import { logger } from '../../utilities/logger';
import { container } from '../../core/container';
import type { ISettingsManager } from '../../core/interfaces/settings-manager.interface';

/**
 * Screen and screensaver settings.
 */
export interface ScreenSettings {
  saverTimeout: number; // minutes, 0 means disabled
  saverType: 'none' | 'black';
  iconStyle: 'standard' | 'classic';
}

/**
 * Module to handle screensaver and screen timeout logic.
 */
export class ScreenModule {
  public settings: ScreenSettings = {
    saverTimeout: 0,
    saverType: 'none',
    iconStyle: 'standard',
  };

  private idleTimer: any = null;
  private overlay: HTMLElement | null = null;
  private settingsManager: ISettingsManager;

  constructor() {
    this.settingsManager = container.get<ISettingsManager>('settings');
  }

  /**
   * Initializes the screen module.
   */
  public load(): void {
    const saved = this.settingsManager.getSection('theme').screen;
    if (saved) {
      Object.assign(this.settings, saved);
    }
    this.setupListeners();
    this.resetTimer();
    this.applyIconStyle();
    logger.log('[ScreenModule] Loaded:', this.settings);
  }

  /**
   * Sets up global activity listeners.
   */
  private setupListeners(): void {
    const reset = () => this.resetTimer();
    document.addEventListener('mousemove', reset);
    document.addEventListener('keydown', reset);
    document.addEventListener('pointerdown', reset);
    document.addEventListener('wheel', reset);
  }

  /**
   * Resets the inactivity timer.
   */
  private resetTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.hideSaver();

    if (this.settings.saverTimeout > 0) {
      const ms = this.settings.saverTimeout * 60 * 1000;
      this.idleTimer = setTimeout(() => this.showSaver(), ms);
    }
  }

  /**
   * Shows the screensaver overlay.
   */
  private showSaver(): void {
    if (this.settings.saverType === 'none') return;

    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.id = 'cde-screensaver';
      this.overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: black; z-index: 1000000; cursor: none;
        display: none;
      `;
      document.body.appendChild(this.overlay);
    }

    this.overlay.style.display = 'block';
    logger.log('[ScreenModule] Screensaver activated');
  }

  /**
   * Hides the screensaver overlay.
   */
  private hideSaver(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }

  /**
   * Updates settings and persists them.
   */
  public update(key: keyof ScreenSettings, value: any): void {
    (this.settings as any)[key] = value;
    this.save();

    if (key === 'iconStyle') {
      this.applyIconStyle();
    } else {
      this.resetTimer();
    }

    logger.log(`[ScreenModule] "${key}" updated to ${value}`);
  }

  private applyIconStyle(): void {
    const root = document.documentElement;
    if (this.settings.iconStyle === 'classic') {
      root.classList.add('cde-icon-style-classic');
    } else {
      root.classList.remove('cde-icon-style-classic');
    }
  }

  private save(): void {
    const theme = this.settingsManager.getSection('theme');
    theme.screen = this.settings;
    this.settingsManager.setSection('theme', theme);
  }

  /**
   * Syncs UI in StyleManagerScreen.astro.
   */
  public syncUI(): void {
    const panel = document.getElementById('styleManagerScreen');
    if (!panel) return;

    const timeoutSelect = panel.querySelector(
      'select[data-key="saverTimeout"]'
    ) as HTMLSelectElement;
    if (timeoutSelect) {
      timeoutSelect.value = String(this.settings.saverTimeout);
    }

    const typeSelect = panel.querySelector('select[data-key="saverType"]') as HTMLSelectElement;
    if (typeSelect) {
      typeSelect.value = this.settings.saverType;
    }

    const status = document.getElementById('screenStatus');
    if (status) {
      status.textContent =
        this.settings.saverTimeout > 0
          ? `Active (${this.settings.saverTimeout}m)`
          : 'Settings Loaded';
    }

    const styleSelect = panel.querySelector('select[data-key="iconStyle"]') as HTMLSelectElement;
    if (styleSelect) {
      styleSelect.value = this.settings.iconStyle;
    }
  }
}
