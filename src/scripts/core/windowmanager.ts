import { CONFIG } from './config';
import { logger } from '../utilities/logger';
import { settingsManager } from './settingsmanager';
import { AudioManager } from './audiomanager';

// ============================================================================
// WindowManager: window control (focus, drag, clock, dropdown)
// ============================================================================

// Interface for drag state
interface DragState {
  element: HTMLElement | null;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  lastX: number;
  lastY: number;
  isDragging: boolean;
}

// Stores previous state of windows to restore position and size
interface WindowState {
  display?: string;
  left?: string;
  top?: string;
  width?: string;
  height?: string;
  maximized: boolean;
}

const windowStates: Record<string, WindowState> = {};

let resizeTimer: ReturnType<typeof setTimeout> | undefined;

const WindowManager = (() => {
  let zIndex = CONFIG.WINDOW.BASE_Z_INDEX;
  const dragState: DragState = {
    element: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    lastX: 0,
    lastY: 0,
    isDragging: false,
  };
  const MIN_VISIBLE = CONFIG.WINDOW.MIN_VISIBLE;

  let currentWorkspace = '1';

  let lastFocusedWindowId: string | null = null;

  /**
   * Safe counters for keeping track of the top-most window across different layers
   */
  let highestWindowZIndex = CONFIG.WINDOW.BASE_Z_INDEX;
  let highestModalZIndex = 90000;

  /**
   * Returns the next available highest z-index for a specific layer.
   * @param isModal - Whether the request is for a modal dialog.
   */
  function getNextZIndex(isModal: boolean = false): number {
    if (isModal) {
      return ++highestModalZIndex;
    }
    return ++highestWindowZIndex;
  }

  /**
   * Returns the current highest z-index across all window layers.
   */
  function getTopZIndex(): number {
    return Math.max(highestWindowZIndex, highestModalZIndex);
  }

  /**
   * Helper to detect mobile viewport.
   */
  function isMobile(): boolean {
    return window.innerWidth < 768;
  }

  /**
   * Brings a window to the front (max z-index) and marks it as active.
   * @param id - The ID of the window element.
   */
  function focusWindow(id: string): void {
    if (id === lastFocusedWindowId) return; // Already focused

    const win = document.getElementById(id);
    if (!win) return;

    if (!dragState.isDragging) {
      if (lastFocusedWindowId) {
        const prevWin = document.getElementById(lastFocusedWindowId);
        if (prevWin) prevWin.classList.remove('active');
      }

      if (Math.random() < 0.05) {
        // Occasional garbage collection of classes
        document.querySelectorAll('.active').forEach((el) => {
          if (el.id !== id) el.classList.remove('active');
        });
      }

      win.classList.add('active');
      lastFocusedWindowId = id;

      zIndex = getNextZIndex();
      win.style.zIndex = String(zIndex);

      if (window.AudioManager) window.AudioManager.click();
      logger.log(`[WindowManager] focused: ${id}`);
    }
  }

  /**
   * Normalizes a window's position to ensure it is draggable.
   */
  function normalizeWindowPosition(win: HTMLElement): void {
    if (window.getComputedStyle(win).display === 'none') {
      return;
    }

    const rect = win.getBoundingClientRect();
    const TOP_BAR_HEIGHT = CONFIG.WINDOW.TOP_BAR_HEIGHT;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    win.style.position = 'absolute';

    // --- STRICT VIEWPORT CLAMPING ---
    const minY = TOP_BAR_HEIGHT;
    const minX = 0;
    const maxX = Math.max(0, viewportWidth - rect.width);
    const maxY = Math.max(minY, viewportHeight - rect.height);

    let newTop = Math.max(rect.top, minY);
    newTop = Math.min(newTop, maxY);

    let newLeft = Math.max(rect.left, minX);
    newLeft = Math.min(newLeft, maxX);

    // Force centering on mobile if requested or if normalization reveals desync
    if (isMobile()) {
      newLeft = (viewportWidth - rect.width) / 2;
      newTop = (viewportHeight - rect.height) / 2;
    }

    win.style.top = Math.max(minY, Math.min(maxY, newTop)) + 'px';
    win.style.left = Math.max(0, Math.min(maxX, newLeft)) + 'px';
    win.style.transform = 'none';

    logger.log(
      `[WindowManager] Normalized "${win.id}" to top: ${win.style.top}, left: ${win.style.left}`
    );
  }

  function centerWindow(win: HTMLElement): void {
    const winWidth = win.offsetWidth;
    const winHeight = win.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const TOP_BAR_HEIGHT = CONFIG.WINDOW.TOP_BAR_HEIGHT;

    // Calculate panel height based on device
    const PANEL_HEIGHT = isMobile() ? 65 : 85;

    let left = (viewportWidth - winWidth) / 2;
    let top = (viewportHeight - winHeight) / 2;

    const minX = 0;
    const maxX = Math.max(0, viewportWidth - winWidth);
    const minY = TOP_BAR_HEIGHT;
    const maxY = Math.max(minY, viewportHeight - winHeight - PANEL_HEIGHT);

    left = Math.max(minX, Math.min(left, maxX));
    top = Math.max(minY, Math.min(top, maxY));

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    win.style.position = 'absolute';
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    win.style.transform = 'none';
    win.style.margin = '0';

    logger.log(
      `[WindowManager] Centered window "${win.id}" at ${win.style.left}, ${win.style.top}`
    );
  }

  /**
   * Initiates dragging of a window. Supports both mouse and touch via PointerEvent.
   */
  function drag(e: PointerEvent, id: string): void {
    // Disable drag on mobile devices
    if (isMobile()) {
      logger.log(`[WindowManager] Drag disabled on mobile for window: ${id}`);
      return;
    }

    if (!e.isPrimary) return;

    const el = document.getElementById(id);
    if (!el) return;

    e.preventDefault();
    e.stopPropagation();

    if (window.getComputedStyle(el).transform !== 'none') {
      normalizeWindowPosition(el);
    }

    focusWindow(id);

    const rect = el.getBoundingClientRect();
    dragState.element = el;
    dragState.offsetX = e.clientX - rect.left;
    dragState.offsetY = e.clientY - rect.top;
    dragState.lastX = e.clientX;
    dragState.lastY = e.clientY;
    dragState.isDragging = true;

    // Capture the pointer to keep receiving events even if the pointer leaves the element
    el.setPointerCapture(e.pointerId);

    // X11-style move cursor while dragging
    document.documentElement.style.setProperty(
      '--cde-cursor-override',
      "url('/icons/cursors/cursor-move.svg') 12 12, move"
    );
    document.body.style.cursor = `url('/icons/cursors/cursor-move.svg') 12 12, move`;

    // Performance: Add will-change hint
    el.style.willChange = 'transform, left, top';

    el.addEventListener('pointermove', move, { passive: false });
    el.addEventListener('pointerup', stopDrag, { passive: false });
    el.addEventListener('pointercancel', stopDrag, { passive: false });

    logger.log(`[WindowManager] pointer drag started for "${id}".`);
  }

  function move(e: PointerEvent): void {
    if (!dragState.element || !dragState.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    // Get acceleration from CSS variable
    const accelStr = getComputedStyle(document.documentElement).getPropertyValue(
      '--mouse-acceleration'
    );
    const acceleration = parseFloat(accelStr) || 1;

    // Movement delta since last event
    const deltaX = e.clientX - dragState.lastX;
    const deltaY = e.clientY - dragState.lastY;

    // Apply acceleration to position
    let currentLeft = parseFloat(dragState.element.style.left || '0');
    let currentTop = parseFloat(dragState.element.style.top || '0');

    let left = currentLeft + deltaX * acceleration;
    let top = currentTop + deltaY * acceleration;

    // Update last position
    dragState.lastX = e.clientX;
    dragState.lastY = e.clientY;

    const winWidth = dragState.element.offsetWidth;
    const winHeight = dragState.element.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const TOP_BAR_HEIGHT = CONFIG.WINDOW.TOP_BAR_HEIGHT;
    const PANEL_HEIGHT = isMobile() ? 65 : 85;

    const minX = 0;
    const maxX = Math.max(0, viewportWidth - winWidth);

    const minY = TOP_BAR_HEIGHT;
    const maxY = Math.max(minY, viewportHeight - winHeight - PANEL_HEIGHT);

    left = Math.max(minX, Math.min(left, maxX));
    top = Math.max(minY, Math.min(top, maxY));

    // Apply wireframe mode if opaqueDragging is false
    const opaque = document.documentElement.getAttribute('data-opaque-drag') !== 'false';
    if (!opaque) {
      dragState.element.classList.add('dragging-wireframe');
    }

    dragState.element.style.left = left + 'px';
    dragState.element.style.top = top + 'px';
  }

  function stopDrag(e: PointerEvent): void {
    if (!dragState.element || !dragState.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const el = dragState.element;
    el.releasePointerCapture(e.pointerId);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', stopDrag);
    el.removeEventListener('pointercancel', stopDrag);

    // Performance: Clear will-change hint
    el.style.willChange = 'auto';

    // Restore default CDE cursor
    document.body.style.cursor = '';

    dragState.element.classList.remove('dragging-wireframe');
    dragState.isDragging = false;

    // Save session
    settingsManager.updateWindowSession(el.id, {
      left: el.style.left,
      top: el.style.top,
      maximized: el.classList.contains('maximized'),
    });

    dragState.element = null;
    logger.log(`[WindowManager] pointer drag stopped.`);
  }

  function titlebarDragHandler(e: PointerEvent): void {
    // IGNORE drag if clicking on buttons
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

  function initGlobalInteraction(): void {
    // Single delegated listener for both FOCUS and SOUND feedback
    document.addEventListener('pointerdown', (e) => {
      if (dragState.isDragging) return;
      const target = e.target as HTMLElement;
      if (!target || typeof target.closest !== 'function') return;

      // 1. SOUND FEEDBACK (Unified)
      if (
        target.closest(
          '.cde-icon, .cde-icon-btn, .menu-item, .cde-btn, .pager-workspace, .titlebar-btn'
        )
      ) {
        if (window.AudioManager) window.AudioManager.click();
      }

      // 2. FOCUS MANAGEMENT
      const win = target.closest('.window, .cde-retro-modal');
      if (win) {
        focusWindow(win.id);
      }

      const minBtn = target.closest('.min-btn');
      if (minBtn) {
        const img = minBtn.querySelector('img');
        if (img) {
          const original = img.src;
          img.src = '/icons/ui/shade-toggled-inactive.png';
          const restore = () => {
            img.src = original;
            window.removeEventListener('pointerup', restore);
          };
          window.addEventListener('pointerup', restore);
        }
      }

      const maxBtn = target.closest('.max-btn');
      if (maxBtn) {
        const img = maxBtn.querySelector('img');
        if (img) {
          const original = img.src;
          img.src = '/icons/ui/maximize-toggled-inactive.png';
          const restore = () => {
            img.src = original;
            window.removeEventListener('pointerup', restore);
          };
          window.addEventListener('pointerup', restore);
        }
      }
    });

    // Point to focus implementation
    document.addEventListener(
      'pointerenter',
      (e) => {
        const mode = document.documentElement.getAttribute('data-focus-mode');
        if (mode !== 'point') return;

        const target = e.target as HTMLElement;
        if (!target || typeof target.closest !== 'function') return;

        const win = target.closest('.window, .cde-retro-modal');
        if (win) {
          focusWindow(win.id);
        }
      },
      true
    );

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        logger.log('[WindowManager] Viewport resized, normalizing window positions...');
        document.querySelectorAll('.window, .cde-retro-modal').forEach((win) => {
          if (win instanceof HTMLElement) {
            if (isMobile()) {
              centerWindow(win);
            } else {
              normalizeWindowPosition(win);
            }
          }
        });
      }, CONFIG.TIMINGS.NORMALIZATION_DELAY);
    });
  }

  function setupDropdown(btnId: string, menuId: string): void {
    const dropdownBtn = document.getElementById(btnId);
    const dropdownMenu = document.getElementById(menuId);

    if (!dropdownBtn || !dropdownMenu) {
      logger.warn(`[WindowManager] Dropdown elements not found for ${btnId}/${menuId}!`, {
        btn: !!dropdownBtn,
        menu: !!dropdownMenu,
      });
      return;
    }

    logger.log(`[WindowManager] Initializing dropdown menu: ${menuId}...`);
    let lastToggleTime = 0;

    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const now = Date.now();
      if (now - lastToggleTime < 300) return;
      lastToggleTime = now;

      const isOpen = dropdownBtn.classList.contains('open');

      if (!isOpen) {
        // OPENING
        dropdownBtn.classList.add('open');
        const rect = dropdownBtn.getBoundingClientRect();

        dropdownMenu.style.position = 'fixed';
        dropdownMenu.style.zIndex = String(CONFIG.DROPDOWN.Z_INDEX);
        dropdownMenu.style.display = 'block';

        // Calculate position based on the button
        const menuRect = dropdownMenu.getBoundingClientRect();
        dropdownMenu.style.bottom = window.innerHeight - rect.top + CONFIG.DROPDOWN.OFFSET + 'px';
        dropdownMenu.style.left = rect.left + rect.width / 2 - menuRect.width / 2 + 'px';

        logger.log(`[WindowManager] Dropdown ${menuId} opened.`);
      } else {
        // CLOSING
        dropdownBtn.classList.remove('open');
        dropdownMenu.style.display = 'none';
        logger.log(`[WindowManager] Dropdown ${menuId} closed via button click`);
      }
    });

    document.addEventListener('pointerdown', (e) => {
      const now = Date.now();
      if (now - lastToggleTime < 300) return;

      if (!dropdownBtn.contains(e.target as Node) && !dropdownMenu.contains(e.target as Node)) {
        if (dropdownBtn.classList.contains('open')) {
          dropdownBtn.classList.remove('open');
          dropdownMenu.style.display = 'none';
          logger.log(`[WindowManager] Dropdown ${menuId} closed from outside click`);
        }
      }
    });

    dropdownMenu.style.display = 'none';
  }

  function initDropdowns(): void {
    setupDropdown('utilitiesBtn', 'utilitiesDropdown');
    setupDropdown('styleManagerBtn', 'styleManagerDropdown');
    setupDropdown('terminalBtn', 'terminalDropdown');
    setupDropdown('browserBtn', 'browserDropdown');
  }

  /**
   * Registers a single window element to make it draggable and interactive.
   */
  function registerWindow(win: HTMLElement): void {
    if (win.hasAttribute('data-cde-registered')) return;

    const id = win.id;
    const titlebar = document.getElementById(`${id}Titlebar`) || win.querySelector('.titlebar');

    if (titlebar) {
      // Restore session position if available
      const session = settingsManager.getSection('session').windows[id];
      if (session && session.left && session.top) {
        win.style.left = session.left;
        win.style.top = session.top;
        if (session.maximized && !win.hasAttribute('data-no-maximize')) {
          win.classList.add('maximized');
          const maxBtnImg = win.querySelector('.max-btn img') as HTMLImageElement;
          if (maxBtnImg) maxBtnImg.src = '/icons/ui/maximize-toggled-inactive.png';
        }
        logger.log(`[WindowManager] Restored session for: ${id}`);
      } else {
        if (window.getComputedStyle(win).display !== 'none') {
          setTimeout(() => {
            normalizeWindowPosition(win);
          }, CONFIG.TIMINGS.NORMALIZATION_DELAY);
        }
      }

      (titlebar as HTMLElement).style.touchAction = 'none';

      titlebar.addEventListener('pointerdown', titlebarDragHandler as any);
      titlebar.setAttribute('data-draggable', 'true');
      win.setAttribute('data-cde-registered', 'true');

      // Pop-in animation on registration if visible
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
          // Window is visible on registration, assign current workspace
          win.setAttribute('data-workspace', currentWorkspace);
          win.setAttribute('data-was-opened', 'true');
          logger.log(`[WindowManager] Visible window registered: ${id} in WS ${currentWorkspace}`);

          if (window.getComputedStyle(win).display !== 'none') {
            requestAnimationFrame(() => centerWindow(win));
          }
        } else {
          logger.log(
            `[WindowManager] Hidden window registered: ${id}, workspace will be assigned on first show`
          );
        }
      }

      const ws = win.getAttribute('data-workspace');
      if (ws && ws !== currentWorkspace) {
        win.style.display = 'none';
      }

      logger.log(`[WindowManager] Window registration complete: ${id || 'anonymous'}`);
    }
  }

  function switchWorkspace(id: string): void {
    if (id === currentWorkspace) return;

    AudioManager.click();
    logger.log(`[WindowManager] Switching from workspace ${currentWorkspace} to ${id}`);

    const windows = document.querySelectorAll('.window, .cde-retro-modal');

    // First pass: Hide all windows of current workspace and remember which ones were open
    windows.forEach((win) => {
      const el = win as HTMLElement;
      const winWorkspace = el.getAttribute('data-workspace');

      if (winWorkspace === currentWorkspace) {
        const isVisible = window.getComputedStyle(el).display !== 'none';
        logger.log(`[WindowManager] Window ${el.id} in WS ${winWorkspace}: visible=${isVisible}`);

        if (isVisible) {
          el.setAttribute('data-was-opened', 'true');
          el.style.display = 'none';
        } else {
          el.removeAttribute('data-was-opened');
        }
      }
    });

    // Update state BEFORE showing windows
    const previousWorkspace = currentWorkspace;
    currentWorkspace = id;

    windows.forEach((win) => {
      const el = win as HTMLElement;
      const winWorkspace = el.getAttribute('data-workspace');

      logger.log(
        `[WindowManager] Processing ${el.id}: workspace=${winWorkspace}, current=${currentWorkspace}, was-opened=${el.getAttribute('data-was-opened')}`
      );

      if (winWorkspace === currentWorkspace) {
        // Show windows that belong to current workspace and were opened
        if (el.getAttribute('data-was-opened') === 'true') {
          el.style.display = 'flex';
          logger.log(`[WindowManager] Showing ${el.id} in WS ${currentWorkspace}`);
        }
      } else {
        // Hide windows that belong to other workspaces
        if (window.getComputedStyle(el).display !== 'none') {
          el.style.display = 'none';
          logger.log(`[WindowManager] Hiding ${el.id} (belongs to WS ${winWorkspace})`);
        }
      }
    });

    // Update UI
    const pagerItems = document.querySelectorAll('.pager-workspace');
    pagerItems.forEach((item) => {
      if ((item as HTMLElement).dataset.workspace === id) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    logger.log(
      `[WindowManager] Workspace switch complete: ${previousWorkspace} -> ${currentWorkspace}`
    );
  }

  function initPager(): void {
    const pagerItems = document.querySelectorAll('.pager-workspace');
    pagerItems.forEach((item) => {
      item.addEventListener('click', () => {
        const ws = (item as HTMLElement).dataset.workspace;
        if (ws) switchWorkspace(ws);
      });
    });
  }

  function initDynamicScanning(): void {
    // Scan existing windows
    const windows = document.querySelectorAll('.window, .cde-retro-modal');
    windows.forEach((el) => registerWindow(el as HTMLElement));

    // Observe for new windows added to the DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.classList.contains('window') || node.classList.contains('cde-retro-modal')) {
              registerWindow(node);
            }
            // Also scan children in case a wrapper was added
            node.querySelectorAll('.window, .cde-retro-modal').forEach((el) => {
              registerWindow(el as HTMLElement);
            });
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    logger.log('[WindowManager] MutationObserver active for dynamic windows.');
  }

  function showWindow(id: string): void {
    const win = document.getElementById(id);
    if (!win) return;

    // CRITICAL: Assign workspace if not already assigned
    // This happens when window is shown for the first time
    if (!win.getAttribute('data-workspace')) {
      win.setAttribute('data-workspace', currentWorkspace);
      logger.log(`[WindowManager] Assigned workspace ${currentWorkspace} to ${id} on first show`);
    }

    // Mark as opened
    win.setAttribute('data-was-opened', 'true');

    win.style.display = 'flex';
    win.classList.add('window-opening');

    // Center window on mobile, normalize on desktop
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

    logger.log(
      `[WindowManager] Showed window ${id} in workspace ${win.getAttribute('data-workspace')}`
    );
  }

  function init(): void {
    initDynamicScanning();
    initGlobalInteraction();
    initDropdowns();
    initPager();
    initTitlebarShading();
    logger.log('[WindowManager] Initialized');
  }

  /**
   * Initialize double-click on titlebars for window shading (CDE behavior)
   */
  function initTitlebarShading(): void {
    let lastClickTime = 0;
    let lastClickTarget: HTMLElement | null = null;
    const DOUBLE_CLICK_DELAY = 300; // ms

    document.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        const titlebar = target.closest('.titlebar') as HTMLElement;

        if (titlebar && !isMobile()) {
          const now = Date.now();
          const timeSinceLastClick = now - lastClickTime;

          // Check if this is a double-click
          if (
            timeSinceLastClick < DOUBLE_CLICK_DELAY &&
            lastClickTarget === titlebar &&
            e.button === 0
          ) {
            // This is a double-click - shade the window
            const win = titlebar.closest('.window, .cde-retro-modal') as HTMLElement;
            if (win && win.id) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              shadeWindow(win.id);
              lastClickTime = 0;
              lastClickTarget = null;
              return;
            }
          }

          // Record this click for double-click detection
          lastClickTime = now;
          lastClickTarget = titlebar;
        }
      },
      { capture: true }
    ); // Use capture phase to intercept before drag

    logger.log('[WindowManager] Titlebar shading initialized');
  }

  return {
    init,
    drag,
    focusWindow,
    registerWindow,
    centerWindow,
    switchWorkspace,
    showWindow,
    getNextZIndex,
    getTopZIndex,
  };
})();

function minimizeWindow(id: string): void {
  const win = document.getElementById(id);
  if (!win) return;

  if (win.style.display !== 'none') {
    windowStates[id] = {
      display: win.style.display,
      left: win.style.left,
      top: win.style.top,
      width: win.style.width,
      height: win.style.height,
      maximized: win.classList.contains('maximized'),
    };

    // Add closing animation
    win.classList.add('window-closing');
    if (window.AudioManager) window.AudioManager.windowMinimize();

    // Wait for animation to finish before hiding
    win.addEventListener(
      'animationend',
      () => {
        win.style.display = 'none';
        win.classList.remove('window-closing');
      },
      { once: true }
    );
  }
}

function shadeWindow(id: string): void {
  const win = document.getElementById(id);
  if (!win) return;

  const titlebar = win.querySelector('.titlebar') as HTMLElement;
  if (!titlebar) return;

  const isMaximized = win.classList.contains('maximized');

  if (win.classList.contains('shaded')) {
    // Unshade: restore original height
    win.classList.remove('shaded');

    if (isMaximized) {
      // If maximized, remove inline height to let CSS handle it
      win.style.height = '';
    } else if (windowStates[id]?.height) {
      // If not maximized, restore saved height
      win.style.height = windowStates[id].height!;
    }

    if (window.AudioManager) window.AudioManager.windowShade();
    logger.log(`[WindowManager] Window "${id}" unshaded`);
  } else {
    if (!isMaximized) {
      windowStates[id] = {
        ...windowStates[id],
        height: win.style.height || getComputedStyle(win).height,
      };
    }

    win.classList.add('shaded');
    win.style.height = titlebar.offsetHeight + 'px';

    if (window.AudioManager) window.AudioManager.windowShade();
    logger.log(`[WindowManager] Window "${id}" shaded`);
  }
}

function maximizeWindow(id: string): void {
  const win = document.getElementById(id);
  if (!win || win.hasAttribute('data-no-maximize')) return;

  if (win.classList.contains('maximized')) {
    win.classList.remove('maximized');
    if (window.AudioManager) window.AudioManager.windowMaximize();

    // Icon update
    const maxBtnImg = win.querySelector('.max-btn img') as HTMLImageElement;
    if (maxBtnImg) maxBtnImg.src = '/icons/ui/maximize-inactive.png';

    if (windowStates[id]) {
      win.style.left = windowStates[id].left || '';
      win.style.top = windowStates[id].top || '';
      win.style.width = windowStates[id].width || '';
      win.style.height = windowStates[id].height || '';
    }
    WindowManager.focusWindow(id);

    settingsManager.updateWindowSession(id, { maximized: false });
    logger.log(`[WindowManager] maximizeWindow: window "${id}" restored.`);
  } else {
    windowStates[id] = {
      left: win.style.left,
      top: win.style.top,
      width: win.style.width,
      height: win.style.height,
      maximized: false,
    };
    win.classList.add('maximized');
    if (window.AudioManager) window.AudioManager.windowMaximize();

    // Icon update
    const maxBtnImg = win.querySelector('.max-btn img') as HTMLImageElement;
    if (maxBtnImg) maxBtnImg.src = '/icons/ui/maximize-toggled-inactive.png';

    WindowManager.focusWindow(id);

    settingsManager.updateWindowSession(id, { maximized: true });
    logger.log(`[WindowManager] maximizeWindow: window "${id}" maximized.`);
  }
}

declare global {
  interface Window {
    drag: (e: PointerEvent, id: string) => void;
    focusWindow: (id: string) => void;
    centerWindow: (win: HTMLElement) => void;
    minimizeWindow: typeof minimizeWindow;
    maximizeWindow: typeof maximizeWindow;
    shadeWindow: typeof shadeWindow;
    WindowManager: typeof WindowManager;
  }
}

window.drag = WindowManager.drag as any;
window.focusWindow = WindowManager.focusWindow;
window.centerWindow = WindowManager.centerWindow;
window.minimizeWindow = minimizeWindow;
window.maximizeWindow = maximizeWindow;
window.shadeWindow = shadeWindow;
window.WindowManager = WindowManager;

export { WindowManager, minimizeWindow, maximizeWindow, shadeWindow };
