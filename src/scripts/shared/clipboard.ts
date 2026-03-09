// src/scripts/shared/clipboard.ts
// Shared clipboard functionality for File Manager and Desktop

import { VFS } from '../core/vfs';
import { logger } from '../utilities/logger';
import { ErrorSeverity } from '../core/error-handler';

export interface ClipboardItem {
  path: string;
  operation: 'copy' | 'cut';
}

// Global clipboard declaration
declare global {
  interface Window {
    fmClipboard: ClipboardItem | null;
  }
}

// Initialize global clipboard
if (typeof window !== 'undefined') {
  window.fmClipboard = null;
}

/**
 * Copy a file/folder to clipboard
 */
export function copyToClipboard(path: string): void {
  window.fmClipboard = { path, operation: 'copy' };
  if (window.AudioManager) window.AudioManager.click();
  logger.log(`[Clipboard] Copied: ${path}`);
}

/**
 * Cut a file/folder to clipboard
 */
export function cutToClipboard(path: string): void {
  window.fmClipboard = { path, operation: 'cut' };
  if (window.AudioManager) window.AudioManager.click();
  logger.log(`[Clipboard] Cut: ${path}`);
}

/**
 * Paste from clipboard to destination directory
 */
export async function pasteFromClipboard(destDir: string): Promise<boolean> {
  if (!window.fmClipboard) {
    logger.warn('[Clipboard] Nothing to paste');
    return false;
  }

  const parts = window.fmClipboard.path.split('/').filter(Boolean);
  const name = parts[parts.length - 1];
  const destPath = destDir + name + (window.fmClipboard.path.endsWith('/') ? '/' : '');

  const { errorHandler } = await import('../core/error-handler');
  const result = await errorHandler.wrapAsync(async () => {
    if (window.fmClipboard!.operation === 'copy') {
      await VFS.copy(window.fmClipboard!.path, destPath);
      logger.log(`[Clipboard] Pasted (copy): ${window.fmClipboard!.path} -> ${destPath}`);
    } else {
      await VFS.move(window.fmClipboard!.path, destPath);
      logger.log(`[Clipboard] Pasted (move): ${window.fmClipboard!.path} -> ${destPath}`);
      window.fmClipboard = null;
    }

    if (window.AudioManager) window.AudioManager.success();
    return true;
  }, {
    module: 'Clipboard',
    action: 'paste',
    severity: ErrorSeverity.MEDIUM,
    data: { source: window.fmClipboard.path, dest: destPath }
  });

  return result ?? false;
}

/**
 * Check if clipboard has content
 */
export function hasClipboardContent(): boolean {
  return window.fmClipboard !== null;
}

/**
 * Clear clipboard
 */
export function clearClipboard(): void {
  window.fmClipboard = null;
  logger.log('[Clipboard] Cleared');
}

/**
 * Get current clipboard content
 */
export function getClipboard(): ClipboardItem | null {
  return window.fmClipboard;
}
