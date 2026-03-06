// src/scripts/core/interfaces/window-manager.interface.ts

/**
 * Interface for Window Management operations
 * Defines the contract for window lifecycle, focus, and workspace management
 */
export interface IWindowManager {
  /**
   * Initialize the window manager system
   */
  init(): void;

  /**
   * Bring a window to the front and mark it as active
   * @param id - The ID of the window element
   */
  focusWindow(id: string): void;

  /**
   * Register a window element to make it draggable and interactive
   * @param win - The window HTML element
   */
  registerWindow(win: HTMLElement): void;

  /**
   * Center a window in the viewport
   * @param win - The window HTML element
   */
  centerWindow(win: HTMLElement): void;

  /**
   * Switch to a different workspace
   * @param id - The workspace ID
   */
  switchWorkspace(id: string): void;

  /**
   * Show a window (make it visible)
   * @param id - The ID of the window element
   */
  showWindow(id: string): void;

  /**
   * Get the next available z-index for layering
   * @param isModal - Whether this is for a modal dialog
   */
  getNextZIndex(isModal?: boolean): number;

  /**
   * Get the current highest z-index across all layers
   */
  getTopZIndex(): number;

  /**
   * Initiate dragging of a window
   * @param e - The pointer event
   * @param id - The window ID
   */
  drag(e: PointerEvent, id: string): void;
}

/**
 * Interface for window state persistence
 */
export interface ISessionStorage {
  /**
   * Save window state to persistent storage
   * @param id - Window ID
   * @param state - Window state data
   */
  saveWindowState(id: string, state: WindowState): void;

  /**
   * Load window state from persistent storage
   * @param id - Window ID
   * @returns Window state or null if not found
   */
  loadWindowState(id: string): WindowState | null;
}

/**
 * Window state data structure
 */
export interface WindowState {
  top?: string;
  left?: string;
  display?: string;
  maximized: boolean;
}
