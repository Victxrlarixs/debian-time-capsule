import { CONFIG } from './config';
import { logger } from '../utilities/logger';
import { container } from './container';
import type { ISessionStorage } from './interfaces/window-manager.interface';
import { AudioManager } from './audiomanager';

// Specialized managers
import { ZIndexManager } from './window-management/z-index-manager';
import { WorkspaceManager } from './window-management/workspace-manager';
import { WindowPositionManager } from './window-management/window-position-manager';
import { DragManager } from './window-management/drag-manager';
import { WindowStateManager } from './window-management/window-state-manager';
import { DropdownManager } from './window-management/dropdown-manager';
import { WindowFocusManager } from './window-management/window-focus-manager';

let resizeTimer: ReturnType<typeof setTimeout> | undefined;

const WindowManagerV2 = (() => {
  let sessionStorage: ISessionStorage;

  // Initialize specialized managers (lazy)
  let zIndexManager: ZIndexManager;
  let workspaceManager: WorkspaceManager;
  let positionManager: WindowPositionManager;
  let dropdownManager: DropdownManager;
  let dragManager: DragManager;
  let stateManager: WindowStateManager;
  let focusManager: WindowFocusManager;

  function ensureInitialized(): void {
    if (!sessionStorage) {
      sessionStorage = container.get<ISessionStorage>('sessionStorage');
      zIndexManager = new ZIndexManager();
      workspaceManager = new WorkspaceManager();
      positionManager = new WindowPositionManager();
      dropdownManager = new DropdownManager();
      dragManager = new DragManager(
        sessionStorage,
        (id: string) => focusWindow(id),
        (win: HTMLElement) => positionManager.normalizeWindowPosition(win)
      );
      stateManager = new WindowStateManager(sessionStorage, (id: string) => focusWindow(id));
      focusManager = new WindowFocusManager(zIndexManager, () => dragManager.isDragging());
    }
  }

  function isMobile(): boolean {
    return window.innerWidth < 768;
  }

  function focusWindow(id: string): void {
    focusManager.focusWindow(id);
  }

  function centerWindow(win: HTMLElement): void {
    positionManager.centerWindow(win);
  }

  function drag(e: PointerEvent, id: string): void {
    dragManager.startDrag(e, id);
  }

  function titlebarDragHandler(e: PointerEvent): void {
    const target = e.target as HTMLElement;
    if (target.closest('.close-btn, .min-btn, .max-btn')) {
      return;
    }

    const titlebar = e.currentTarget as HTMLElement;
    const win = titlebar.parentElement;
    if (win && win.id) {
      drag(e, win.id);
    }
  }

  function initResizeHandler(): void {
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        logger.log('[WindowManagerV2] Viewport resized, normalizing positions...');
        positionManager.normalizeAllWindows();
      }, CONFIG.TIMINGS.NORMALIZATION_DELAY);
    });
  }

  function registerWindow(win: HTMLElement): void {
    if (win.hasAttribute('data-cde-registered')) return;

    const id = win.id;
    const titlebar = document.getElementById(`${id}Titlebar`) || win.querySelector('.titlebar');

    if (titlebar) {
      // Restore session
      const session = sessionStorage.loadWindowState(id);
      if (session && session.left && session.top) {
        win.style.left = session.left;
        win.style.top = session.top;
        if (session.maximized && !win.hasAttribute('data-no-maximize')) {
          win.classList.add('maximized');
          const maxBtnImg = win.querySelector('.max-btn img') as HTMLImageElement;
          if (maxBtnImg) maxBtnImg.src = '/icons/ui/maximize-toggled-inactive.png';
        }
        logger.log(`[WindowManagerV2] Restored session for: ${id}`);
      } else {
        if (window.getComputedStyle(win).display !== 'none') {
          setTimeout(() => {
            positionManager.normalizeWindowPosition(win);
          }, CONFIG.TIMINGS.NORMALIZATION_DELAY);
        }
      }

      (titlebar as HTMLElement).style.touchAction = 'none';
      titlebar.addEventListener('pointerdown', titlebarDragHandler as any);
      titlebar.setAttribute('data-draggable', 'true');
      win.setAttribute('data-cde-registered', 'true');

      // Pop-in animation
      if (window.getComputedStyle(win).display !== 'none') {
        win.classList.add('window-opening');
        win.addEventListener(
          'animationend',
          () => {
            win.classList.remove('window-opening');
          },
          { once: true }
        );
      }

      const isVisible = window.getComputedStyle(win).display !== 'none';

      if (!win.getAttribute('data-workspace')) {
        if (isVisible) {
          workspaceManager.assignWorkspaceToWindow(win);
          win.setAttribute('data-was-opened', 'true');
          logger.log(`[WindowManagerV2] Visible window registered: ${id}`);

          if (window.getComputedStyle(win).display !== 'none') {
            requestAnimationFrame(() => centerWindow(win));
          }
        } else {
          logger.log(`[WindowManagerV2] Hidden window registered: ${id}`);
        }
      }

      const ws = win.getAttribute('data-workspace');
      if (ws && ws !== workspaceManager.getCurrentWorkspace()) {
        win.style.display = 'none';
      }

      logger.log(`[WindowManagerV2] Window registration complete: ${id}`);
    }
  }

  function switchWorkspace(id: string): void {
    workspaceManager.switchWorkspace(id);
  }

  function initDynamicScanning(): void {
    const windows = document.querySelectorAll('.window, .cde-retro-modal');
    windows.forEach((el) => registerWindow(el as HTMLElement));

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.classList.contains('window') || node.classList.contains('cde-retro-modal')) {
              registerWindow(node);
            }
            node.querySelectorAll('.window, .cde-retro-modal').forEach((el) => {
              registerWindow(el as HTMLElement);
            });
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    logger.log('[WindowManagerV2] MutationObserver active');
  }

  function showWindow(id: string): void {
    const win = document.getElementById(id);
    if (!win) return;

    if (!win.getAttribute('data-workspace')) {
      workspaceManager.assignWorkspaceToWindow(win);
      logger.log(`[WindowManagerV2] Assigned workspace to ${id} on first show`);
    }

    win.setAttribute('data-was-opened', 'true');
    win.style.display = 'flex';
    win.classList.add('window-opening');

    if (isMobile()) {
      centerWindow(win);
    }

    focusWindow(id);
    AudioManager.windowOpen();

    win.addEventListener(
      'animationend',
      () => {
        win.classList.remove('window-opening');
      },
      { once: true }
    );

    logger.log(`[WindowManagerV2] Showed window ${id}`);
  }

  function initTitlebarShading(): void {
    let lastClickTime = 0;
    let lastClickTarget: HTMLElement | null = null;
    const DOUBLE_CLICK_DELAY = 300;

    document.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        const titlebar = target.closest('.titlebar') as HTMLElement;

        if (titlebar && !isMobile()) {
          const now = Date.now();
          const timeSinceLastClick = now - lastClickTime;

          if (
            timeSinceLastClick < DOUBLE_CLICK_DELAY &&
            lastClickTarget === titlebar &&
            e.button === 0
          ) {
            const win = titlebar.closest('.window, .cde-retro-modal') as HTMLElement;
            if (win && win.id) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              stateManager.shadeWindow(win.id);
              lastClickTime = 0;
              lastClickTarget = null;
              return;
            }
          }

          lastClickTime = now;
          lastClickTarget = titlebar;
        }
      },
      { capture: true }
    );

    logger.log('[WindowManagerV2] Titlebar shading initialized');
  }

  function init(): void {
    ensureInitialized();
    initDynamicScanning();
    focusManager.initGlobalInteraction();
    dropdownManager.initDropdowns();
    workspaceManager.initPager();
    initTitlebarShading();
    initResizeHandler();
    logger.log('[WindowManagerV2] Initialized');
  }

  return {
    init,
    drag,
    focusWindow,
    registerWindow,
    centerWindow,
    switchWorkspace,
    showWindow,
    getNextZIndex: (isModal?: boolean) => zIndexManager.getNextZIndex(isModal),
    getTopZIndex: () => zIndexManager.getTopZIndex(),
    // Expose state manager methods
    minimizeWindow: (id: string) => stateManager.minimizeWindow(id),
    maximizeWindow: (id: string) => stateManager.maximizeWindow(id),
    shadeWindow: (id: string) => stateManager.shadeWindow(id),
  };
})();

// Export for global access (legacy compatibility)
declare global {
  interface Window {
    drag: (e: PointerEvent, id: string) => void;
    focusWindow: (id: string) => void;
    centerWindow: (win: HTMLElement) => void;
    minimizeWindow: (id: string) => void;
    maximizeWindow: (id: string) => void;
    shadeWindow: (id: string) => void;
    WindowManager: typeof WindowManagerV2;
  }
}

window.drag = WindowManagerV2.drag as any;
window.focusWindow = WindowManagerV2.focusWindow;
window.centerWindow = WindowManagerV2.centerWindow;
window.minimizeWindow = WindowManagerV2.minimizeWindow;
window.maximizeWindow = WindowManagerV2.maximizeWindow;
window.shadeWindow = WindowManagerV2.shadeWindow;
window.WindowManager = WindowManagerV2;

export { WindowManagerV2 as WindowManager };
export const minimizeWindow = WindowManagerV2.minimizeWindow;
export const maximizeWindow = WindowManagerV2.maximizeWindow;
export const shadeWindow = WindowManagerV2.shadeWindow;
