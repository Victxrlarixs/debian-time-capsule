// src/scripts/shared/window-helpers.ts
// Shared window management helpers to eliminate duplication

import { WindowManager } from '../core/windowmanager';
import { logger } from '../utilities/logger';

/**
 * Configuration for opening a window
 */
export interface WindowOpenConfig {
  /** Window element ID */
  id: string;
  /** Optional z-index (if not provided, uses default behavior) */
  zIndex?: number;
  /** Whether to center the window after opening */
  center?: boolean;
  /** Whether to play window open sound */
  playSound?: boolean;
  /** Whether to focus the window */
  focus?: boolean;
  /** Optional callback after window is opened */
  onOpen?: () => void;
}

/**
 * Opens a window with standard behavior (show, center, focus, sound)
 * Eliminates duplicated window opening code across features
 */
export function openWindow(config: WindowOpenConfig): HTMLElement | null {
  const { id, zIndex, center = true, playSound = true, focus = true, onOpen } = config;

  WindowManager.showWindow(id);

  const win = document.getElementById(id);
  if (!win) {
    logger.warn(`[WindowHelpers] Window not found: ${id}`);
    return null;
  }

  // Set z-index if provided
  if (zIndex !== undefined) {
    win.style.zIndex = String(zIndex);
  }

  // Center window
  if (center) {
    requestAnimationFrame(() => {
      WindowManager.centerWindow(win);
    });
  }

  // Focus window
  if (focus) {
    if (window.focusWindow) {
      window.focusWindow(id);
    }
  }

  // Play sound
  if (playSound && window.AudioManager) {
    window.AudioManager.windowOpen();
  }

  // Execute callback
  if (onOpen) {
    onOpen();
  }

  logger.log(`[WindowHelpers] Opened window: ${id}`);
  return win;
}

/**
 * Closes a window with standard behavior (minimize or hide, sound)
 */
export function closeWindow(id: string, playSound: boolean = true): void {
  if (window.minimizeWindow) {
    window.minimizeWindow(id);
  } else {
    const win = document.getElementById(id);
    if (win) {
      win.style.display = 'none';
    }
  }

  if (playSound && window.AudioManager) {
    window.AudioManager.windowClose();
  }

  logger.log(`[WindowHelpers] Closed window: ${id}`);
}

/**
 * Manages z-index for windows that need manual control
 * Returns a function to get and increment z-index
 */
export function createZIndexManager(baseZIndex: number = 10000) {
  let currentZIndex = baseZIndex;

  return {
    get: () => currentZIndex,
    increment: () => ++currentZIndex,
    set: (value: number) => {
      currentZIndex = value;
    },
  };
}
