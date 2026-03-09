// src/scripts/utilities/share-config.ts
// Share and load CDE theme configurations via URL

import { container } from '../core/container';
import type { ISettingsManager } from '../core/interfaces/settings-manager.interface';
import { logger } from './logger';
import { errorHandler, ErrorSeverity } from '../core/error-handler';

interface SharedConfig {
  p?: string; // palette
  b?: string; // backdrop
  f?: any; // font
  m?: any; // mouse
  k?: any; // keyboard
  w?: any; // window
  v?: string; // version
}

/**
 * Encode current theme configuration to URL parameter
 * Uses compact format: ?t=palette.backdrop for minimal URL length
 */
export function encodeConfigToURL(): string {
  return errorHandler.wrapSync(() => {
    const settingsManager = container.get<ISettingsManager>('settings');
    const themeSettings = settingsManager.getSection('theme');
    const paletteId = window.styleManager?.theme?.currentPaletteId;
    const backdropPath = themeSettings.backdrop?.value;

    logger.log('[ShareConfig] Encoding - paletteId:', paletteId);
    logger.log('[ShareConfig] Encoding - backdrop:', backdropPath);

    if (!paletteId && !backdropPath) {
      return window.location.href;
    }

    const backdropName = backdropPath ? backdropPath.split('/').pop()?.replace('.pm', '') : '';
    const compactValue = `${paletteId || ''}.${backdropName || ''}`;

    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('t', compactValue);

    logger.log('[ShareConfig] Compact theme encoded:', compactValue);
    logger.log('[ShareConfig] Full URL:', url.toString());
    return url.toString();
  }, {
    module: 'ShareConfig',
    action: 'encodeConfigToURL',
    severity: ErrorSeverity.LOW
  }) ?? window.location.href;
}

/**
 * Decode and apply theme configuration from URL parameter
 * Supports both compact format (palette.backdrop) and legacy JSON format
 */
export async function loadSharedConfig(): Promise<boolean> {
  return errorHandler.wrapAsync(async () => {
    const params = new URLSearchParams(window.location.search);
    const themeParam = params.get('t') || params.get('theme');

    if (!themeParam) {
      return false;
    }

    let paletteId: string | undefined;
    let backdropPath: string | undefined;

    if (!themeParam.includes('%') && !themeParam.includes('{')) {
      const parts = themeParam.split('.');
      paletteId = parts[0] || undefined;
      const backdropName = parts[1] || undefined;
      if (backdropName) {
        backdropPath = `/backdrops/${backdropName}.pm`;
      }
      logger.log('[ShareConfig] Decoded compact format:', { paletteId, backdropPath });
    } else {
      const result = errorHandler.wrapSync(() => {
        const json = decodeURIComponent(atob(themeParam));
        const config: SharedConfig = JSON.parse(json);
        return {
          paletteId: config.p || (config as any).palette,
          backdropPath: config.b || (config as any).backdrop
        };
      }, {
        module: 'ShareConfig',
        action: 'decodeLegacyFormat',
        severity: ErrorSeverity.LOW
      });

      if (!result) return false;
      paletteId = result.paletteId;
      backdropPath = result.backdropPath;
      logger.log('[ShareConfig] Decoded legacy format:', result);
    }

    if (!window.styleManager) {
      logger.warn('[ShareConfig] StyleManager not ready yet');
      return false;
    }

    if (paletteId) {
      logger.log('[ShareConfig] Applying palette:', paletteId);

      if (window.styleManager?.theme?.applyCdePalette) {
        window.styleManager.theme.applyCdePalette(paletteId);
        window.styleManager.theme.applyColor();
        window.styleManager.theme.updateUI();
        window.styleManager.saveColor();

        if (window.styleManager?.backdrop) {
          window.styleManager.backdrop.clearCache();
          window.styleManager.backdrop.apply();
        }
        if ((window as any).clearBackdropThumbnailCache) {
          (window as any).clearBackdropThumbnailCache();
        }
        logger.log('[ShareConfig] Palette applied successfully');
      } else {
        logger.error('[ShareConfig] StyleManager or theme not available');
      }
    }

    if (backdropPath) {
      logger.log('[ShareConfig] Applying backdrop:', backdropPath);
      if (window.styleManager?.backdrop?.update) {
        window.styleManager.backdrop.update('xpm', backdropPath);
        logger.log('[ShareConfig] Backdrop applied');
      } else {
        logger.error('[ShareConfig] Backdrop module not available');
      }
    }

    if (window.CDEModal) {
      setTimeout(() => {
        window.CDEModal.alert('Shared theme loaded successfully!');
      }, 1000);
    }

    logger.log('[ShareConfig] Shared theme applied successfully');
    return true;
  }, {
    module: 'ShareConfig',
    action: 'loadSharedConfig',
    severity: ErrorSeverity.MEDIUM
  }) ?? false;
}
/**
 * Copy theme URL to clipboard
 */
export async function copyThemeURL(): Promise<boolean> {
  return errorHandler.wrapAsync(async () => {
    const url = encodeConfigToURL();
    await navigator.clipboard.writeText(url);
    logger.log('[ShareConfig] Theme URL copied to clipboard');
    return true;
  }, {
    module: 'ShareConfig',
    action: 'copyThemeURL',
    severity: ErrorSeverity.LOW
  }) ?? false;
}

/**
 * Get shareable theme URL
 */
export function getShareableURL(): string {
  return encodeConfigToURL();
}

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).ShareConfig = {
    encode: encodeConfigToURL,
    load: loadSharedConfig,
    copy: copyThemeURL,
    getURL: getShareableURL,
  };
}
