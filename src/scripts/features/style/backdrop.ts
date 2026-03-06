// src/scripts/features/style/backdrop.ts

import { logger } from '../../utilities/logger';
import { container } from '../../core/container';
import type { ISettingsManager } from '../../core/interfaces/settings-manager.interface';
import { CONFIG } from '../../core/config';
import {
  loadXpmBackdropCached,
  clearXpmCache as clearGlobalXpmCache,
} from '../../shared/xpm-renderer';

/**
 * Backdrop options for CDE.
 */
export interface BackdropSettings {
  type: 'xpm';
  value: string;
}

/**
 * Module to manage desktop wallpapers.
 * Supports both static image files (.png, .jpg) and
 * authentic CDE XPM pattern files (.pm).
 */
export class BackdropModule {
  private settings: BackdropSettings = {
    type: 'xpm',
    value: CONFIG.BACKDROP.DEFAULT_BACKDROP,
  };
  private settingsManager: ISettingsManager;

  constructor() {
    this.settingsManager = container.get<ISettingsManager>('settings');
  }

  /**
   * Initializes the backdrop module and applies saved settings.
   */
  public load(): void {
    const saved = this.settingsManager.getSection('theme').backdrop;
    if (saved && typeof saved === 'object' && 'type' in saved && saved.type === 'xpm') {
      this.settings = saved as BackdropSettings;
    }
    this.apply();
    logger.log('[BackdropModule] Loaded and applied:', this.settings);
  }

  /**
   * Applies the current backdrop settings to the document body.
   * For .pm files, fetches, parses and renders the XPM pattern.
   */
  public async apply(): Promise<void> {
    const body = document.body;

    // Clear previous dynamic body styles
    body.classList.forEach((cls) => {
      if (cls.startsWith('backdrop-')) body.classList.remove(cls);
    });
    body.style.backgroundColor = '';

    await this.applyXpm(body);
  }

  /** Render and apply an XPM pattern file */
  private async applyXpm(body: HTMLElement): Promise<void> {
    const path = this.settings.value;

    // Check if this is the default backdrop and preload is available
    if (path === CONFIG.BACKDROP.DEFAULT_BACKDROP) {
      const { getPreloadedBackdrop } = await import('../../boot/backdrop-preloader');
      const preloadedDataUrl = await getPreloadedBackdrop();

      if (preloadedDataUrl) {
        body.style.backgroundImage = `url('${preloadedDataUrl}')`;
        body.style.backgroundRepeat = 'repeat';
        body.style.backgroundSize = 'auto';
        body.style.backgroundPosition = 'top left';
        body.style.backgroundAttachment = 'scroll';
        logger.log('[BackdropModule] Applied default backdrop from preload cache');
        return;
      }
    }

    // Fallback to normal XPM loading for non-default or if preload failed
    const dataUrl = await loadXpmBackdropCached(path, true);

    if (dataUrl) {
      body.style.backgroundImage = `url('${dataUrl}')`;
      body.style.backgroundRepeat = 'repeat';
      // Use a minimum size to make small patterns less repetitive
      // This scales up small patterns while keeping large ones at their natural size
      body.style.backgroundSize = 'auto';
      body.style.backgroundPosition = 'top left';
      body.style.backgroundAttachment = 'scroll';
      logger.log('[BackdropModule] XPM backdrop applied');
    } else {
      // If XPM parsing fails, try a fallback XPM or use solid color
      logger.warn(`[BackdropModule] XPM parse failed for ${path}, trying fallback`);
      await this.applyFallbackBackdrop(body);
    }
  }

  /** Apply fallback backdrop when XPM parsing fails */
  private async applyFallbackBackdrop(body: HTMLElement): Promise<void> {
    // Try a simple fallback XPM first
    const fallbackPath = '/backdrops/CyberTile.pm';
    if (this.settings.value !== fallbackPath) {
      logger.log(`[BackdropModule] Trying fallback XPM: ${fallbackPath}`);
      const fallbackDataUrl = await loadXpmBackdropCached(fallbackPath, true);
      if (fallbackDataUrl) {
        body.style.backgroundImage = `url('${fallbackDataUrl}')`;
        body.style.backgroundRepeat = 'repeat';
        body.style.backgroundSize = 'auto';
        body.style.backgroundPosition = 'top left';
        body.style.backgroundAttachment = 'scroll';
        logger.log('[BackdropModule] Fallback XPM backdrop applied');
        return;
      }
    }

    // Ultimate fallback: solid color with subtle pattern
    body.style.backgroundImage = 'none';
    body.style.backgroundColor = 'var(--window-color)';
    // Add a subtle CSS pattern as backup
    body.style.backgroundImage = `
      radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 1px, transparent 1px),
      radial-gradient(circle at 75% 75%, rgba(0,0,0,0.1) 1px, transparent 1px)
    `;
    body.style.backgroundSize = '20px 20px';
    body.style.backgroundPosition = '0 0, 10px 10px';
    logger.warn('[BackdropModule] Using CSS pattern fallback');
  }

  /**
   * Updates the backdrop settings and persists them.
   */
  public update(type: BackdropSettings['type'], value: string): void {
    this.settings = { type: 'xpm', value };
    this.apply();
    this.save();
    logger.log(`[BackdropModule] Updated to xpm: ${value}`);
  }

  /**
   * Clears the XPM render cache (call after theme color changes).
   */
  public clearCache(): void {
    clearGlobalXpmCache();
    logger.log('[BackdropModule] XPM cache cleared');
  }

  /**
   * Force re-apply current backdrop (useful after theme changes or failures).
   */
  public async reapply(): Promise<void> {
    logger.log('[BackdropModule] Force re-applying backdrop');
    await this.apply();
  }

  /**
   * Returns the current backdrop settings.
   */
  public getSettings(): BackdropSettings {
    return { ...this.settings };
  }

  /**
   * Persists the current backdrop settings to logical storage.
   */
  private save(): void {
    const theme = this.settingsManager.getSection('theme');
    theme.backdrop = this.settings;
    this.settingsManager.setSection('theme', theme);
  }

  /**
   * Syncs the UI state with the current module settings.
   */
  public syncUI(): void {
    const status = document.getElementById('backdropStatus');
    if (status) {
      status.textContent = `${this.settings.type}: ${this.settings.value.split('/').pop()}`;
    }

    document.querySelectorAll('.backdrop-preset').forEach((btn) => {
      const bValue = (btn as HTMLElement).dataset.value;
      if (bValue === this.settings.value) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}
