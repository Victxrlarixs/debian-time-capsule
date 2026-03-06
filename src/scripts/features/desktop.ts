// src/scripts/features/desktop.ts
import { CONFIG } from '../core/config';
import { logger } from '../utilities/logger';
import { container } from '../core/container';
import type { ISettingsManager } from '../core/interfaces/settings-manager.interface';
import { VFS, type IVFS, type VFSFile } from '../core/vfs';
import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../shared/clipboard';
import { createContextMenu, type ContextMenuItem } from '../shared/context-menu';
import { getFileIconByPath, ICON_PATHS } from '../shared/file-icons';

/**
 * Interface for stored icon positions.
 * Key is the filename, value is {left, top}.
 */
interface IconPositions {
  [filename: string]: { left: number; top: number };
}

/**
 * System icons that are always present and cannot be deleted.
 */
const SYSTEM_ICONS: any[] = [
  {
    id: 'emacs-icon',
    name: 'XEmacs',
    icon: '/icons/apps/xemacs.png',
    action: () => {
      if ((window as any).Emacs?.openSplash) (window as any).Emacs.openSplash();
    },
  },
  {
    id: 'share-theme-icon',
    name: 'Share Theme',
    icon: '/icons/apps/org.xfce.PanelProfiles.png',
    action: () => {
      if ((window as any).shareThemeToDiscussions) (window as any).shareThemeToDiscussions();
    },
  },
  {
    id: 'netscape-icon',
    name: 'Netscape',
    icon: '/icons/apps/netscape_classic.png',
    action: () => {
      if ((window as any).Netscape?.open) (window as any).Netscape.open();
    },
  },
  {
    id: 'lynx-icon',
    name: 'Lynx',
    icon: '/icons/apps/Lynx.svg',
    action: () => {
      if ((window as any).Lynx?.open) (window as any).Lynx.open();
    },
  },
];

/**
 * Desktop Manager: Handles icons, shortcuts and desktop background interactions.
 */
export const DesktopManager = (() => {
  const containerEl = document.getElementById('desktop-icons-container');
  let icons: HTMLElement[] = [];
  let selectedIcon: HTMLElement | null = null;
  const settingsManager = container.get<ISettingsManager>('settings');

  // Drag state
  let isDragging = false;
  let dragTarget: HTMLElement | null = null;
  let offsetX = 0;
  let offsetY = 0;
  let lastX = 0;
  let lastY = 0;

  // Mobile support: Tap & Long-press state
  let lastTapTime = 0;
  let longPressTimer: number | null = null;
  let tapStartX = 0;
  let tapStartY = 0;

  /**
   * Initializes the desktop icons.
   */
  async function init(): Promise<void> {
    const container = document.getElementById('desktop-icons-container');
    if (!container) {
      logger.warn('[DesktopManager] Container #desktop-icons-container not found.');
      return;
    }

    logger.log('[DesktopManager] Initializing desktop icons...');
    await syncIcons();
    setupGlobalEvents();
  }

  /**
   * Syncs icons with the virtual filesystem /home/victxrlarixs/Desktop/
   */
  async function syncIcons(): Promise<void> {
    const container = document.getElementById('desktop-icons-container');
    if (!container) return;

    // Get files from the virtual Desktop folder
    const desktopPath = CONFIG.FS.DESKTOP;
    const desktopChildren = VFS.getChildren(desktopPath) || {};
    const savedPositions = (settingsManager.getSection('desktop') as IconPositions) || {};

    // 1. Collect current DOM icons to identify what to remove
    const currentIconElements = Array.from(
      container.querySelectorAll('.cde-desktop-icon')
    ) as HTMLElement[];
    const existingNames = new Set(currentIconElements.map((el) => el.dataset.name));

    // 2. Add or update icons from VFS
    const newNames = Object.keys(desktopChildren);
    newNames.forEach((name, index) => {
      const node = desktopChildren[name];
      if (!existingNames.has(name)) {
        const pos = savedPositions[name] || findNextAvailableSlot();
        createIcon(name, node.type, pos.left, pos.top);
      }
    });

    // 3. Remove icons that no longer exist in VFS or System
    currentIconElements.forEach((el) => {
      const name = el.dataset.name;
      const isSystem = el.dataset.system === 'true';
      if (!isSystem && name && !desktopChildren[name]) {
        el.remove();
      }
    });

    SYSTEM_ICONS.forEach((sys) => {
      if (!container.querySelector(`[data-id="${sys.id}"]`)) {
        const pos = savedPositions[sys.id] || findNextAvailableSlot();
        createIcon(sys.name, 'file', pos.left, pos.top, true, sys.id, sys.icon);
      }
    });
  }

  /**
   * Creates a single desktop icon element.
   */
  function createIcon(
    name: string,
    type: 'file' | 'folder',
    left: number,
    top: number,
    isSystem: boolean = false,
    id?: string,
    customIcon?: string
  ): void {
    const container = document.getElementById('desktop-icons-container');
    if (!container) return;

    const icon = document.createElement('div');
    icon.className = 'cde-desktop-icon';
    icon.dataset.name = name;
    icon.dataset.type = type;
    if (isSystem) icon.dataset.system = 'true';
    if (id) icon.dataset.id = id;

    icon.style.left = left + 'px';
    icon.style.top = top + 'px';

    const img = document.createElement('img');
    img.src =
      customIcon ||
      (type === 'folder' ? ICON_PATHS.FOLDER : getFileIconByPath(CONFIG.FS.DESKTOP + name));
    img.alt = name;
    if (name === 'Emacs') {
      img.classList.add('emacs-pixelated');
    }

    const span = document.createElement('span');
    span.textContent = name;

    icon.appendChild(img);
    icon.appendChild(span);

    // Event delegation is now handled in setupGlobalEvents for efficiency
    container.appendChild(icon);
    icons.push(icon);
  }

  function onIconPointerDown(e: PointerEvent, icon: HTMLElement): void {
    e.stopPropagation();

    // Select icon
    deselectAll();
    icon.classList.add('selected');
    selectedIcon = icon;

    // Start Drag
    isDragging = true;
    dragTarget = icon;
    const rect = icon.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    lastX = e.clientX;
    lastY = e.clientY;

    icon.setPointerCapture(e.pointerId);
    icon.addEventListener('pointermove', onPointerMove);
    icon.addEventListener('pointerup', onPointerUp, { once: true });

    logger.log(`[DesktopManager] Started dragging icon: ${icon.dataset.name}`);
  }

  /**
   * Snaps a coordinate to the predefined grid.
   */
  function snapToGrid(x: number, y: number): { x: number; y: number } {
    const gridSize = CONFIG.DESKTOP_ICONS.GRID_SIZE;
    const padding = 20; // Margin from edges

    const gridX = Math.round((x - padding) / gridSize) * gridSize + padding;
    const gridY = Math.round((y - padding) / gridSize) * gridSize + padding;

    return { x: gridX, y: gridY };
  }

  /**
   * Checks if a grid slot is already occupied by another icon.
   */
  function isSlotOccupied(x: number, y: number, excludeId?: string): boolean {
    const container = document.getElementById('desktop-icons-container');
    if (!container) return false;

    const currentIcons = container.querySelectorAll('.cde-desktop-icon');
    for (const icon of Array.from(currentIcons)) {
      const el = icon as HTMLElement;
      const id = el.dataset.id || el.dataset.name;
      if (id === excludeId) continue;

      const iconX = parseInt(el.style.left);
      const iconY = parseInt(el.style.top);

      // Simple coordinate match (with small tolerance)
      if (Math.abs(iconX - x) < 5 && Math.abs(iconY - y) < 5) {
        return true;
      }
    }
    return false;
  }

  /**
   * Finds the next available empty slot in the grid (filling columns first, CDE style).
   */
  function findNextAvailableSlot(): { left: number; top: number } {
    const container = document.getElementById('desktop-icons-container');
    if (!container) return { left: 20, top: 20 };

    const gridSize = CONFIG.DESKTOP_ICONS.GRID_SIZE;
    const padding = 20;
    const height = container.offsetHeight;

    // Iterate through grid (Columns first: left-to-right, then top-to-bottom within column)
    for (let x = padding; x < container.offsetWidth - gridSize; x += gridSize) {
      for (let y = padding; y < height - gridSize; y += gridSize) {
        if (!isSlotOccupied(x, y)) {
          return { left: x, top: y };
        }
      }
    }

    return { left: padding, top: padding }; // Fallback
  }

  function onPointerMove(e: PointerEvent): void {
    if (!isDragging || !dragTarget) return;

    const container = document.getElementById('desktop-icons-container');
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    // Get acceleration from CSS variable
    const accelStr = getComputedStyle(document.documentElement).getPropertyValue(
      '--mouse-acceleration'
    );
    const acceleration = parseFloat(accelStr) || 1;

    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;

    let currentLeft = parseFloat(dragTarget.style.left || '0');
    let currentTop = parseFloat(dragTarget.style.top || '0');

    let newX = currentLeft + deltaX * acceleration;
    let newY = currentTop + deltaY * acceleration;

    lastX = e.clientX;
    lastY = e.clientY;

    // Aggressive safety margin: icon cannot go near the edges (15px buffer)
    newX = Math.max(15, Math.min(newX, containerRect.width - dragTarget.offsetWidth - 15));
    newY = Math.max(15, Math.min(newY, containerRect.height - dragTarget.offsetHeight - 15));

    dragTarget.style.left = newX + 'px';
    dragTarget.style.top = newY + 'px';
  }

  function onPointerUp(e: PointerEvent): void {
    if (!isDragging || !dragTarget) return;

    dragTarget.releasePointerCapture(e.pointerId);
    dragTarget.removeEventListener('pointermove', onPointerMove);

    // Snap to grid
    const currentX = parseFloat(dragTarget.style.left);
    const currentY = parseFloat(dragTarget.style.top);
    const id = dragTarget.dataset.id || dragTarget.dataset.name;

    let { x: snappedX, y: snappedY } = snapToGrid(currentX, currentY);

    // Collision Detection: If occupied, try to find nearest empty space
    if (isSlotOccupied(snappedX, snappedY, id)) {
      logger.log(`[DesktopManager] Slot ${snappedX},${snappedY} occupied. Finding nearest...`);
      const savedPositions = (settingsManager.getSection('desktop') as IconPositions) || {};
      const prev = savedPositions[id || ''];
      if (prev) {
        snappedX = prev.left;
        snappedY = prev.top;
      }
    }

    dragTarget.style.left = snappedX + 'px';
    dragTarget.style.top = snappedY + 'px';

    // Save final position
    savePosition(dragTarget);

    isDragging = false;
    dragTarget = null;
    logger.log('[DesktopManager] Icon drag finished and snapped to grid.');
  }

  async function onIconDoubleClick(name: string, type: 'file' | 'folder'): Promise<void> {
    // Check if it's the PWA install icon - handle separately
    if (selectedIcon && selectedIcon.dataset.id === 'pwa-install-icon') {
      return; // PWA installer handles its own double-click
    }

    // Check if it's a system icon
    if (selectedIcon && selectedIcon.dataset.system === 'true') {
      const sysId = selectedIcon.dataset.id;
      const sys = SYSTEM_ICONS.find((s) => s.id === sysId);
      if (sys) {
        logger.log(`[DesktopManager] Launching system icon: ${sys.name}`);
        if (window.AudioManager) window.AudioManager.click();
        sys.action();
        return;
      }
    }

    logger.log(`[DesktopManager] Double-click on: ${name} (${type})`);
    const path = CONFIG.FS.DESKTOP + name + (type === 'folder' ? '/' : '');

    if (type === 'folder') {
      if (window.openFileManager) {
        window.openFileManager();
        if (window.openPath) window.openPath(path);
      }
    } else {
      if ((window as any).openEmacs) {
        const node = VFS.getNode(path);
        const content = node && node.type === 'file' ? node.content : '';
        await (window as any).openEmacs(name, content, path);
      }
    }
  }

  function deselectAll(): void {
    document.querySelectorAll('.cde-desktop-icon').forEach((el) => el.classList.remove('selected'));
    selectedIcon = null;
  }

  function setupGlobalEvents(): void {
    const container = document.getElementById('desktop-icons-container');
    if (!container) return;

    // --- DELEGATED ICON EVENTS ---

    container.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement;
      if (!target || typeof target.closest !== 'function') return;

      const icon = target.closest('.cde-desktop-icon') as HTMLElement | null;

      // --- MOBILE: Long-press support ---
      if (longPressTimer) clearTimeout(longPressTimer);
      tapStartX = e.clientX;
      tapStartY = e.clientY;

      longPressTimer = window.setTimeout(() => {
        // Trigger context menu if we haven't moved much and still "pressing"
        if (Math.abs(e.clientX - tapStartX) < 10 && Math.abs(e.clientY - tapStartY) < 10) {
          logger.log('[DesktopManager] Long-press detected.');
          showContextMenu(e as unknown as MouseEvent, icon);
        }
        longPressTimer = null;
      }, 500);

      // --- MOBILE: Double-tap support ---
      const now = Date.now();
      if (icon && now - lastTapTime < 300) {
        logger.log('[DesktopManager] Double-tap detected.');
        if (longPressTimer) clearTimeout(longPressTimer);
        const name = icon.dataset.name || '';
        const type = (icon.dataset.type as 'file' | 'folder') || 'file';
        onIconDoubleClick(name, type);
        lastTapTime = 0; // Reset
        return;
      }
      lastTapTime = now;

      if (icon) {
        onIconPointerDown(e, icon);
      } else {
        // Click on background
        const target = e.target as HTMLElement;
        if (!target.closest('.fm-contextmenu')) {
          deselectAll();
          closeContextMenu();
        }
      }
    });

    container.addEventListener('pointermove', (e) => {
      // Cancel long-press if user moves too much
      if (
        longPressTimer &&
        (Math.abs(e.clientX - tapStartX) > 10 || Math.abs(e.clientY - tapStartY) > 10)
      ) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });

    container.addEventListener('pointerup', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });

    container.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      if (!target || typeof target.closest !== 'function') return;

      const icon = target.closest('.cde-desktop-icon') as HTMLElement | null;
      if (icon) {
        const name = icon.dataset.name || '';
        const type = (icon.dataset.type as 'file' | 'folder') || 'file';
        onIconDoubleClick(name, type);
      }
    });

    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const icon =
        target && typeof target.closest === 'function'
          ? (target.closest('.cde-desktop-icon') as HTMLElement | null)
          : null;

      // If we click on an icon, show its menu; otherwise show desktop menu
      showContextMenu(e, icon);
    });

    // --- GLOBAL EVENTS ---

    // Listen for filesystem changes to refresh icons
    let syncTimeout: number | null = null;
    window.addEventListener('cde-fs-change', (e: any) => {
      if (e.detail?.path === CONFIG.FS.DESKTOP) {
        if (syncTimeout) window.clearTimeout(syncTimeout);
        syncTimeout = window.setTimeout(() => {
          logger.log('[DesktopManager] Filesystem change detected, syncing icons...');
          syncIcons();
          syncTimeout = null;
        }, 50);
      }
    });
  }

  let activeContextMenu: HTMLElement | null = null;

  function showContextMenu(e: MouseEvent, targetIcon: HTMLElement | null): void {
    closeContextMenu();

    // Play menu open sound
    if (window.AudioManager) window.AudioManager.menuOpen();

    const isSystem = targetIcon?.dataset.system === 'true';

    const items: ContextMenuItem[] = targetIcon
      ? [
          {
            label: 'Open',
            icon: '/icons/apps/org.xfce.catfish.png',
            action: async () => {
              const name = targetIcon.dataset.name || '';
              const type = (targetIcon.dataset.type as 'file' | 'folder') || 'file';
              await onIconDoubleClick(name, type);
            },
          },
          {
            label: 'Copy',
            icon: '/icons/actions/edit-copy.png',
            disabled: isSystem,
            action: () => {
              if (isSystem) return;
              const name = targetIcon.dataset.name;
              if (!name) return;
              const fullPath =
                CONFIG.FS.DESKTOP + name + (targetIcon.dataset.type === 'folder' ? '/' : '');
              copyToClipboard(fullPath);
            },
          },
          {
            label: 'Cut',
            icon: '/icons/actions/edit-cut.png',
            disabled: isSystem,
            action: () => {
              if (isSystem) return;
              const name = targetIcon.dataset.name;
              if (!name) return;
              const fullPath =
                CONFIG.FS.DESKTOP + name + (targetIcon.dataset.type === 'folder' ? '/' : '');
              cutToClipboard(fullPath);
            },
          },
          {
            label: 'Rename',
            icon: '/icons/actions/edit-text.png',
            disabled: isSystem,
            action: async () => {
              if (isSystem) return;
              const name = targetIcon.dataset.name;
              if (!name) return;
              const newName = await (window as any).CDEModal.prompt('New name:', name);
              if (newName) await VFS.rename(CONFIG.FS.DESKTOP, name, newName);
            },
          },
          {
            label: 'Properties',
            icon: '/icons/system/system-search.png',
            action: async () => {
              const name = targetIcon.dataset.name;
              if (!name) return;
              if (isSystem) {
                const sysId = targetIcon.dataset.id;
                let path = '/usr/bin/unknown';
                if (sysId === 'emacs-icon') path = '/usr/bin/emacs';
                else if (sysId === 'share-theme-icon') path = '/usr/bin/share-theme';
                else if (sysId === 'netscape-icon') path = '/usr/bin/netscape';
                else if (sysId === 'lynx-icon') path = '/usr/bin/lynx';

                const { showProperties } = await import('./filemanager');
                showProperties(path);
              } else {
                const { showProperties } = await import('./filemanager');
                showProperties(CONFIG.FS.DESKTOP + name);
              }
            },
          },
          {
            label: 'Delete',
            icon: '/icons/actions/edit-delete.png',
            disabled: isSystem,
            action: async () => {
              if (isSystem) return;
              const name = targetIcon.dataset.name;
              if (!name) return;
              await VFS.rm(CONFIG.FS.DESKTOP, name);
            },
          },
        ]
      : [
          {
            label: 'Paste',
            icon: '/icons/actions/edit-paste.png',
            disabled: !window.fmClipboard,
            action: async () => {
              await pasteFromClipboard(CONFIG.FS.DESKTOP);
            },
          },
          {
            label: '--- Programs ---',
            header: true,
            action: async () => {},
          },
          {
            label: 'FileManager',
            icon: '/icons/apps/filemanager.png',
            action: async () => {
              if (window.toggleFileManager) window.toggleFileManager();
            },
          },
          {
            label: 'XEmacs',
            icon: '/icons/apps/xemacs.png',
            action: async () => {
              if (window.Emacs?.open) window.Emacs.open();
            },
          },
          {
            label: 'Netscape',
            icon: '/icons/apps/netscape_classic.png',
            action: async () => {
              if ((window as any).Netscape?.open) (window as any).Netscape.open();
            },
          },
          {
            label: '--- Workspaces ---',
            header: true,
            action: async () => {},
          },
          {
            label: 'Workspace 1',
            icon: '/icons/system/system-workspaces-pages-manager.png',
            action: async () => {
              if (window.WindowManager?.switchWorkspace) window.WindowManager.switchWorkspace('1');
            },
          },
          {
            label: 'Workspace 2',
            icon: '/icons/system/system-workspaces-pages-manager.png',
            action: async () => {
              if (window.WindowManager?.switchWorkspace) window.WindowManager.switchWorkspace('2');
            },
          },
          {
            label: 'Workspace 3',
            icon: '/icons/system/system-workspaces-pages-manager.png',
            action: async () => {
              if (window.WindowManager?.switchWorkspace) window.WindowManager.switchWorkspace('3');
            },
          },
          {
            label: 'Workspace 4',
            icon: '/icons/system/system-workspaces-pages-manager.png',
            action: async () => {
              if (window.WindowManager?.switchWorkspace) window.WindowManager.switchWorkspace('4');
            },
          },
          {
            label: '--- Tools ---',
            header: true,
            action: async () => {},
          },
          {
            label: 'New File',
            icon: '/icons/mimetypes/document.png',
            action: async () => {
              const name = await (window as any).CDEModal.prompt('File name:');
              if (name) await VFS.touch(CONFIG.FS.DESKTOP, name);
            },
          },
          {
            label: 'New Folder',
            icon: '/icons/apps/filemanager.png',
            action: async () => {
              const name = await (window as any).CDEModal.prompt('Folder name:');
              if (name) await VFS.mkdir(CONFIG.FS.DESKTOP, name);
            },
          },
          {
            label: 'Style Manager',
            icon: '/icons/apps/org.xfce.settings.appearance.png',
            action: async () => {
              if (window.styleManager) window.styleManager.openMain();
            },
          },
          {
            label: 'Share Theme',
            icon: '/icons/apps/org.xfce.PanelProfiles.png',
            action: async () => {
              if ((window as any).shareThemeToDiscussions)
                (window as any).shareThemeToDiscussions();
            },
          },
          {
            label: 'Keyboard Shortcuts',
            icon: '/icons/apps/preferences-desktop-keyboard-shortcuts.png',
            action: async () => {
              if ((window as any).AccessibilityManager)
                (window as any).AccessibilityManager.showShortcutsHelp();
            },
          },
          {
            label: 'Refresh Desktop',
            icon: '/icons/actions/view-refresh.png',
            action: async () => {
              window.location.reload();
            },
          },
        ];

    activeContextMenu = createContextMenu(items, e.clientX, e.clientY);
  }

  function closeContextMenu(): void {
    if (activeContextMenu) {
      // Play menu close sound
      if (window.AudioManager) window.AudioManager.menuClose();
      activeContextMenu.remove();
      activeContextMenu = null;
    }
  }

  function savePosition(icon: HTMLElement): void {
    const id = icon.dataset.id || icon.dataset.name;
    if (!id) return;

    const savedPositions = (settingsManager.getSection('desktop') as IconPositions) || {};
    savedPositions[id] = {
      left: parseInt(icon.style.left),
      top: parseInt(icon.style.top),
    };

    settingsManager.setSection('desktop', savedPositions);
  }

  return {
    init,
  };
})();

// Expose globally
export default DesktopManager;
