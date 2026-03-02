// src/scripts/features/filemanager.ts

import { CONFIG } from '../core/config';
import { VFS, type VFSNode, type VFSFile, type VFSFolder } from '../core/vfs';
import { CDEModal } from '../ui/modals';
import { logger } from '../utilities/logger';
import { WindowManager } from '../core/windowmanager';
import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../shared/clipboard';
import { createContextMenu, type ContextMenuItem } from '../shared/context-menu';
import { openWindow, closeWindow, createZIndexManager } from '../shared/window-helpers';
import {} from '../shared/file-icons';

declare global {
  interface Window {
    openFileManager: () => void;
    closeFileManager: () => void;
    toggleFileManager: () => void;
    isFileManagerOpen: () => boolean;
    openPath: (path: string) => void;
    goBack: () => void;
    goForward: () => void;
    goUp: () => void;
    goHome: () => void;
    createFile: (name: string, content: string) => Promise<void>;
    saveFile: (path: string, content: string) => void;
    CDEModal: typeof CDEModal;
  }
}

window.VirtualFS = VFS;

export { formatSize, showProperties };

// ------------------------------------------------------------------
// INTERNAL STATE
// ------------------------------------------------------------------

let currentPath: string = CONFIG.FS.HOME;
let history: string[] = [];
let historyIndex: number = -1;
let fmSelected: string | null = null;
let showHidden: boolean = false;
const zIndexManager = createZIndexManager(CONFIG.FILEMANAGER.BASE_Z_INDEX);
let initialized: boolean = false;
let activeMenu: HTMLElement | null = null;
let activeContextMenu: HTMLElement | null = null;
let searchQuery: string = '';
let multiSelect: Set<string> = new Set();
let sortBy: 'name' | 'size' | 'date' = 'name';
let sortOrder: 'asc' | 'desc' = 'asc';

// Mobile support: Tap & Long-press state
let lastTapTime = 0;
let longPressTimer: number | null = null;
let tapStartX = 0;
let tapStartY = 0;

// debounce for re-renders
let renderTimeout: number | null = null;
function debouncedRender(): void {
  if (renderTimeout) window.clearTimeout(renderTimeout);
  renderTimeout = window.setTimeout(() => {
    renderFiles();
    renderTimeout = null;
  }, 50);
}

/**
 * Listens for VFS changes and re-renders if the change affects the current path.
 */
window.addEventListener('cde-fs-change', (e: any) => {
  if (e.detail?.path === currentPath) {
    debouncedRender();
  }
});

// ------------------------------------------------------------------
// PRIVATE FUNCTIONS
// ------------------------------------------------------------------

/**
 * Renders the files in the current folder to the UI.
 */
function renderFiles(): void {
  const container = document.getElementById('fmFiles');
  const pathInput = document.getElementById('fmPath') as HTMLInputElement | null;
  const status = document.getElementById('fmStatus');

  if (!container || !pathInput || !status) return;

  pathInput.value = currentPath;
  const children = VFS.getChildren(currentPath);

  if (!children) {
    logger.warn(`[FileManager] renderFiles: path not found: ${currentPath}`);
    return;
  }

  // Filter and Sort (Folders first, then Alpha)
  let items = Object.entries(children)
    .filter(([name]) => showHidden || !name.startsWith('.'))
    .filter(([name]) => !searchQuery || name.toLowerCase().includes(searchQuery))
    .map(([name, node]) => ({ name, node }));

  // Apply sorting
  items.sort((a, b) => {
    // Folders first
    if (a.node.type === 'folder' && b.node.type === 'file') return -1;
    if (a.node.type === 'file' && b.node.type === 'folder') return 1;

    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    } else if (sortBy === 'size') {
      const sizeA = VFS.getSize(currentPath + a.name + (a.node.type === 'folder' ? '/' : ''));
      const sizeB = VFS.getSize(currentPath + b.name + (b.node.type === 'folder' ? '/' : ''));
      comparison = sizeA - sizeB;
    } else if (sortBy === 'date') {
      const dateA = new Date(a.node.metadata?.mtime || 0).getTime();
      const dateB = new Date(b.node.metadata?.mtime || 0).getTime();
      comparison = dateA - dateB;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  renderIconView(container, items);

  status.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}${searchQuery ? ' (filtered)' : ''}`;
  renderBreadcrumbs();
}

function renderIconView(container: HTMLElement, items: { name: string; node: VFSNode }[]): void {
  const fragment = document.createDocumentFragment();
  items.forEach(({ name, node }) => {
    const div = document.createElement('div');
    div.className = 'fm-file';
    if (fmSelected === name) div.classList.add('selected');
    div.dataset.name = name;

    setupFileEvents(div, name, node);

    const img = document.createElement('img');
    img.src = getFileIcon(node, currentPath + name);
    img.draggable = false;

    const span = document.createElement('span');
    span.textContent = name;

    div.appendChild(img);
    div.appendChild(span);
    fragment.appendChild(div);
  });
  container.replaceChildren(fragment);
}
/**
 * Determines the appropriate icon for a file based on its type and content.
 * Empty files show document.png, files with content show gtk-file.png
 */
function getFileIcon(node: VFSNode, fullPath: string): string {
  if (node.type === 'folder') {
    return '/icons/apps/filemanager.png';
  }

  // Check if file is empty
  const fileNode = node as VFSFile;
  const isEmpty = !fileNode.content || fileNode.content.trim() === '';

  return isEmpty ? '/icons/mimetypes/document.png' : '/icons/mimetypes/gtk-file.png';
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function setupFileEvents(div: HTMLElement, name: string, item: VFSNode): void {
  div.draggable = true;

  div.addEventListener('dragstart', (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData(
        'text/plain',
        currentPath + name + (item.type === 'folder' ? '/' : '')
      );
      e.dataTransfer.effectAllowed = 'move';
    }
    div.classList.add('dragging');
  });

  div.addEventListener('dragend', () => {
    div.classList.remove('dragging');
  });

  if (item.type === 'folder') {
    div.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      div.classList.add('drag-over');
    });
    div.addEventListener('dragleave', () => {
      div.classList.remove('drag-over');
    });
    div.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      div.classList.remove('drag-over');
      const sourcePath = e.dataTransfer?.getData('text/plain');
      if (sourcePath && sourcePath !== currentPath + name + '/') {
        const parts = sourcePath.split('/').filter(Boolean);
        const fileName = parts[parts.length - 1];
        await VFS.move(sourcePath, currentPath + name + '/' + fileName);
      }
    });
  }

  div.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    document
      .querySelectorAll('.fm-file, .fm-list-item')
      .forEach((el) => el.classList.remove('selected'));
    div.classList.add('selected');
    fmSelected = name;

    // Mobile Logic
    if (longPressTimer) clearTimeout(longPressTimer);
    tapStartX = e.clientX;
    tapStartY = e.clientY;
    longPressTimer = window.setTimeout(() => {
      if (Math.abs(e.clientX - tapStartX) < 10 && Math.abs(e.clientY - tapStartY) < 10) {
        handleContextMenu(e as unknown as MouseEvent);
      }
      longPressTimer = null;
    }, 500);

    const now = Date.now();
    if (now - lastTapTime < 300) {
      if (longPressTimer) clearTimeout(longPressTimer);
      if (item.type === 'folder') {
        const img = div.querySelector('img');
        if (img) img.src = '/icons/places/folder_open.png';
        setTimeout(() => openPath(currentPath + name + '/'), 50);
      } else {
        setTimeout(() => openTextWindow(name, (item as VFSFile).content), 50);
      }
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;
  });

  div.addEventListener('pointermove', (e) => {
    if (
      longPressTimer &&
      (Math.abs(e.clientX - tapStartX) > 10 || Math.abs(e.clientY - tapStartY) > 10)
    ) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  div.addEventListener('pointerup', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });
}

/**
 * Navigates to the specified filesystem path.
 */
function openPath(path: string): void {
  if (!VFS.getNode(path)) {
    logger.warn(`[FileManager] openPath: path not found: ${path}`);
    return;
  }

  if (history.length > 0 && history[historyIndex] === path) return;

  history = history.slice(0, historyIndex + 1);
  history.push(path);
  historyIndex++;
  currentPath = path;
  searchQuery = ''; // Clear search on navigation
  const searchInput = document.getElementById('fmSearch') as HTMLInputElement | null;
  if (searchInput) searchInput.value = '';

  renderFiles();
}

function renderBreadcrumbs(): void {
  const container = document.getElementById('fmBreadcrumbs');
  if (!container) return;

  const parts = currentPath.split('/').filter(Boolean);
  const fragment = document.createDocumentFragment();

  // Root segment
  const root = document.createElement('span');
  root.className = 'fm-breadcrumb-segment';
  root.textContent = '/';
  root.onclick = (e) => {
    e.stopPropagation();
    openPath('/');
  };
  fragment.appendChild(root);

  let full = '/';
  parts.forEach((part, i) => {
    const sep = document.createElement('span');
    sep.className = 'fm-breadcrumb-separator';
    sep.textContent = '>';
    fragment.appendChild(sep);

    full += part + '/';
    const segment = document.createElement('span');
    segment.className = 'fm-breadcrumb-segment';
    segment.textContent = part;
    const thisPath = full;
    segment.onclick = (e) => {
      e.stopPropagation();
      openPath(thisPath);
    };
    fragment.appendChild(segment);
  });

  container.replaceChildren(fragment);
}

function togglePathInput(show: boolean): void {
  const breadcrumbs = document.getElementById('fmBreadcrumbs');
  const pathInput = document.getElementById('fmPath');
  if (!breadcrumbs || !pathInput) return;

  if (show) {
    breadcrumbs.classList.add('fm-hidden');
    pathInput.classList.remove('fm-hidden');
    (pathInput as HTMLInputElement).value = currentPath;
    pathInput.focus();
  } else {
    breadcrumbs.classList.remove('fm-hidden');
    pathInput.classList.add('fm-hidden');
  }
}

/**
 * Navigates back in history.
 */
function goBack(): void {
  if (historyIndex > 0) {
    historyIndex--;
    currentPath = history[historyIndex];
    renderFiles();
  }
}

/**
 * Navigates forward in history.
 */
function goForward(): void {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    currentPath = history[historyIndex];
    renderFiles();
  }
}

/**
 * Navigates up one level.
 */
function goUp(): void {
  const parts = currentPath.split('/').filter(Boolean);
  if (parts.length > 0) {
    parts.pop();
    const parent = '/' + parts.join('/') + (parts.length > 0 ? '/' : '');
    if (VFS.getNode(parent)) {
      openPath(parent);
    }
  }
}

/**
 * Navigates to home.
 */
function goHome(): void {
  openPath(CONFIG.FS.HOME);
}

// ------------------------------------------------------------------
// OPERATIONS
// ------------------------------------------------------------------

async function touch(name: string): Promise<void> {
  await VFS.touch(currentPath, name);
  if (window.AudioManager) window.AudioManager.success();
}

async function mkdir(name: string): Promise<void> {
  await VFS.mkdir(currentPath, name);
  if (window.AudioManager) window.AudioManager.success();
}

async function rm(name: string): Promise<void> {
  if (!name) return;
  const isTrash = currentPath.includes('/.trash/');
  const msg = isTrash ? `Permanently delete ${name}?` : `Move ${name} to Trash?`;
  const confirmed = await CDEModal.confirm(msg);
  if (confirmed) {
    if (isTrash) await VFS.rm(currentPath, name);
    else
      await VFS.moveToTrash(
        currentPath + name + (VFS.getNode(currentPath + name + '/') ? '/' : '')
      );
    fmSelected = null;
    if (window.AudioManager) window.AudioManager.success();
  }
}

async function emptyTrash(): Promise<void> {
  const confirmed = await CDEModal.confirm('Permanently delete all items in Trash?');
  if (confirmed) {
    const trashPath = CONFIG.FS.HOME + '.trash/';
    const trash = VFS.getChildren(trashPath);
    if (trash) {
      for (const name of Object.keys(trash)) {
        await VFS.rm(trashPath, name);
      }
    }
    if (window.AudioManager) window.AudioManager.success();
  }
}

async function restore(name: string): Promise<void> {
  await VFS.restoreFromTrash(name);
  fmSelected = null;
  if (window.AudioManager) window.AudioManager.success();
}

async function rename(oldName: string, newName: string): Promise<void> {
  await VFS.rename(currentPath, oldName, newName);
  fmSelected = null;
  if (window.AudioManager) window.AudioManager.success();
}

async function openTextWindow(name: string, content: string): Promise<void> {
  if (window.openEmacs) {
    await window.openEmacs(name, content);
  }
}

async function showProperties(fullPath: string): Promise<void> {
  const node = VFS.getNode(
    fullPath + (VFS.getNode(fullPath + '/') && !fullPath.endsWith('/') ? '/' : '')
  );
  if (!node) return;

  const parts = fullPath.split('/').filter(Boolean);
  const name = parts[parts.length - 1] || '/';
  const meta = (node as any).metadata;
  const size = VFS.getSize(fullPath + (node.type === 'folder' ? '/' : ''));
  const sizeStr = formatSize(size);
  const dateStr = meta?.mtime ? new Date(meta.mtime).toLocaleString() : 'Unknown';

  // Count items in folder
  let itemCount = '';
  if (node.type === 'folder') {
    const children = VFS.getChildren(fullPath + '/');
    const count = children ? Object.keys(children).length : 0;
    itemCount = `<tr><td style="padding: 2px 0; color: #555;">Items:</td><td>${count}</td></tr>`;
  }

  const html = `
    <div class="fm-properties">
      <div style="display: flex; gap: 15px; margin-bottom: 10px;">
        <img src="${getFileIcon(node, fullPath)}" style="width: 48px; height: 48px;" />
        <div>
          <b style="font-size: 14px;">${name}</b><br/>
          <span style="color: #666;">Type: ${node.type}</span>
        </div>
      </div>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 10px 0;"/>
      <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
        <tr><td style="padding: 2px 0; color: #555;">Path:</td><td>${fullPath}</td></tr>
        <tr><td style="padding: 2px 0; color: #555;">Size:</td><td>${sizeStr}</td></tr>
        ${itemCount}
        <tr><td style="padding: 2px 0; color: #555;">Modified:</td><td>${dateStr}</td></tr>
        <tr><td style="padding: 2px 0; color: #555;">Owner:</td><td>${meta?.owner || 'victx'}</td></tr>
        <tr><td style="padding: 2px 0; color: #555;">Permissions:</td><td><code>${meta?.permissions || (node.type === 'folder' ? 'rwxr-xr-x' : 'rw-r--r--')}</code></td></tr>
      </table>
    </div>
  `;

  CDEModal.open(`Properties: ${name}`, html, [{ label: 'Close', value: true, isDefault: true }]);
}

// ------------------------------------------------------------------
// MENUS
// ------------------------------------------------------------------

const fmMenus: Record<string, ContextMenuItem[]> = {
  File: [
    {
      label: 'New File',
      icon: '/icons/mimetypes/document.png',
      action: async () => {
        const name = await CDEModal.prompt('File name:');
        if (name) await touch(name);
      },
    },
    {
      label: 'New Folder',
      icon: '/icons/places/folder_open.png',
      action: async () => {
        const name = await CDEModal.prompt('Folder name:');
        if (name) await mkdir(name);
      },
    },
    {
      label: 'Empty Trash',
      icon: '/icons/places/user-trash-full.png',
      action: emptyTrash,
    },
  ],
  Edit: [
    {
      label: 'Copy',
      icon: '/icons/actions/edit-copy.png',
      action: async () => {
        if (!fmSelected) return;
        const fullPath =
          currentPath + fmSelected + (VFS.getNode(currentPath + fmSelected + '/') ? '/' : '');
        copyToClipboard(fullPath);
      },
    },
    {
      label: 'Cut',
      icon: '/icons/actions/edit-cut.png',
      action: async () => {
        if (!fmSelected) return;
        const fullPath =
          currentPath + fmSelected + (VFS.getNode(currentPath + fmSelected + '/') ? '/' : '');
        cutToClipboard(fullPath);
      },
    },
    {
      label: 'Paste',
      icon: '/icons/actions/edit-paste.png',
      action: async () => {
        await pasteFromClipboard(currentPath);
      },
    },
    {
      label: 'Rename',
      icon: '/icons/actions/edit-copy.png',
      action: async () => {
        if (!fmSelected) return;
        const newName = await CDEModal.prompt('New name:', fmSelected);
        if (newName) await rename(fmSelected, newName);
      },
    },
  ],
  View: [
    {
      label: 'Sort by Name',
      action: () => {
        if (sortBy === 'name') sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        else {
          sortBy = 'name';
          sortOrder = 'asc';
        }
        renderFiles();
      },
    },
    {
      label: 'Sort by Size',
      action: () => {
        if (sortBy === 'size') sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        else {
          sortBy = 'size';
          sortOrder = 'asc';
        }
        renderFiles();
      },
    },
    {
      label: 'Sort by Date',
      action: () => {
        if (sortBy === 'date') sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        else {
          sortBy = 'date';
          sortOrder = 'asc';
        }
        renderFiles();
      },
    },
    {
      label: 'Show Hidden Files',
      action: () => {
        showHidden = !showHidden;
        renderFiles();
      },
    },
    {
      label: 'Refresh',
      icon: '/icons/actions/view-refresh.png',
      action: () => renderFiles(),
    },
  ],
  Go: [
    { label: 'Back', icon: '/icons/actions/previous.png', action: goBack },
    { label: 'Forward', icon: '/icons/actions/right.png', action: goForward },
    { label: 'Up', icon: '/icons/actions/go-up.png', action: goUp },
    { label: 'Home', icon: '/icons/actions/gohome.png', action: goHome },
  ],
  Places: [
    {
      label: 'Settings',
      icon: '/icons/apps/org.xfce.settings.manager.png',
      action: () => openPath(CONFIG.FS.HOME + 'settings/'),
    },
    {
      label: 'Manual Pages',
      icon: '/icons/system/help.png',
      action: () => openPath(CONFIG.FS.HOME + 'man-pages/'),
    },
    {
      label: 'Desktop',
      icon: '/icons/places/desktop.png',
      action: () => openPath(CONFIG.FS.DESKTOP),
    },
  ],
};

function setupMenuBar(): void {
  const menuBar = document.querySelector('.fm-menubar');
  if (!menuBar) return;

  menuBar.querySelectorAll('span').forEach((span) => {
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();

      const name = span.textContent?.trim() || '';
      let items = fmMenus[name];

      if (name === 'File') {
        // Robust check for trash path (ignoring trailing slashes)
        const normalize = (p: string) => (p.endsWith('/') ? p : p + '/');
        const isTrash = normalize(currentPath) === normalize(CONFIG.FS.TRASH);
        items = items.filter((item) => item.label !== 'Empty Trash' || isTrash);
      }

      if (!items || items.length === 0) return;

      const menu = document.createElement('div');
      menu.className = 'fm-dropdown';
      menu.style.zIndex = String(CONFIG.DROPDOWN.Z_INDEX);

      items.forEach((item) => {
        const option = document.createElement('div');
        option.className = 'fm-dropdown-item';
        option.textContent = item.label;
        option.addEventListener('click', async () => {
          await item.action();
          closeMenu();
        });
        menu.appendChild(option);
      });

      document.body.appendChild(menu);
      const rect = span.getBoundingClientRect();
      menu.style.left = rect.left + 'px';
      menu.style.top = rect.bottom + 'px';
      activeMenu = menu;
    });
  });
}

function closeMenu(): void {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

function handleContextMenu(e: MouseEvent): void {
  e.preventDefault();
  if (activeContextMenu) activeContextMenu.remove();

  const target = e.target as HTMLElement;
  const fileEl =
    target && typeof target.closest === 'function'
      ? (target.closest('.fm-file') as HTMLElement | null)
      : null;

  let items: ContextMenuItem[] = [];

  if (fileEl) {
    const name = fileEl.dataset.name;
    if (!name) return;

    fmSelected = name;
    document.querySelectorAll('.fm-file').forEach((el) => el.classList.remove('selected'));
    fileEl.classList.add('selected');

    const isTrashDir = currentPath.includes('/.trash/');

    items = [
      {
        label: isTrashDir ? 'Restore' : 'Open',
        icon: '/icons/apps/org.xfce.catfish.png',
        action: () => {
          if (isTrashDir) {
            restore(name);
          } else {
            const item = VFS.getNode(
              currentPath + name + (VFS.getNode(currentPath + name + '/') ? '/' : '')
            );
            if (item) {
              if (item.type === 'folder') openPath(currentPath + name + '/');
              else openTextWindow(name, (item as VFSFile).content);
            }
          }
        },
      },
      {
        label: 'Copy',
        icon: '/icons/actions/edit-copy.png',
        action: () => {
          const fullPath = currentPath + name + (VFS.getNode(currentPath + name + '/') ? '/' : '');
          copyToClipboard(fullPath);
        },
      },
      {
        label: 'Cut',
        icon: '/icons/actions/edit-cut.png',
        action: () => {
          const fullPath = currentPath + name + (VFS.getNode(currentPath + name + '/') ? '/' : '');
          cutToClipboard(fullPath);
        },
      },
      {
        label: 'Rename',
        icon: '/icons/actions/edit-text.png',
        action: async () => {
          const newName = await CDEModal.prompt('New name:', name);
          if (newName) await rename(name, newName);
        },
      },
      {
        label: 'Properties',
        icon: '/icons/system/system-search.png',
        action: () => showProperties(currentPath + name),
      },
      {
        label: 'Delete',
        icon: '/icons/actions/edit-delete.png',
        action: () => rm(name),
      },
    ];
  } else {
    items = [
      {
        label: 'Paste',
        icon: '/icons/actions/edit-paste.png',
        disabled: !window.fmClipboard,
        action: async () => {
          await pasteFromClipboard(currentPath);
        },
      },
      ...fmMenus['File'],
    ];
  }

  activeContextMenu = createContextMenu(items, e.clientX, e.clientY);
}

// ------------------------------------------------------------------
// INIT & EXPOSURE
// ------------------------------------------------------------------

function initFileManager(): void {
  if (initialized) return;

  setupMenuBar();
  const fmFiles = document.getElementById('fmFiles');
  if (fmFiles) {
    fmFiles.addEventListener('contextmenu', handleContextMenu);

    // Drop on background to move to current dir
    fmFiles.addEventListener('dragover', (e) => e.preventDefault());
    fmFiles.addEventListener('drop', async (e) => {
      const sourcePath = e.dataTransfer?.getData('text/plain');
      if (sourcePath) {
        const parts = sourcePath.split('/').filter(Boolean);
        const fileName = parts[parts.length - 1];
        const newPath = currentPath + fileName + (sourcePath.endsWith('/') ? '/' : '');
        if (sourcePath !== newPath) {
          await VFS.move(sourcePath, newPath);
        }
      }
    });
  }

  document.addEventListener('click', () => {
    closeMenu();
    if (activeContextMenu) {
      activeContextMenu.remove();
      activeContextMenu = null;
    }
  });

  const pathInput = document.getElementById('fmPath') as HTMLInputElement | null;
  if (pathInput) {
    pathInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        openPath(pathInput.value);
        togglePathInput(false);
      }
      if (e.key === 'Escape') togglePathInput(false);
    });
    pathInput.addEventListener('blur', () => togglePathInput(false));
  }

  const pathContainer = document.getElementById('fmPathContainer');
  if (pathContainer) {
    pathContainer.addEventListener('click', () => togglePathInput(true));
  }

  const searchInput = document.getElementById('fmSearch') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.toLowerCase();
      renderFiles();
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', async (e: KeyboardEvent) => {
    const win = document.getElementById('fm');
    if (!win || win.style.display === 'none') return;

    if (e.target instanceof HTMLInputElement) return;

    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'c':
          e.preventDefault();
          if (fmSelected) {
            const fullPath =
              currentPath + fmSelected + (VFS.getNode(currentPath + fmSelected + '/') ? '/' : '');
            copyToClipboard(fullPath);
          }
          break;
        case 'x':
          e.preventDefault();
          if (fmSelected) {
            const fullPath =
              currentPath + fmSelected + (VFS.getNode(currentPath + fmSelected + '/') ? '/' : '');
            cutToClipboard(fullPath);
          }
          break;
        case 'v':
          e.preventDefault();
          await pasteFromClipboard(currentPath);
          break;
        case 'f':
          e.preventDefault();
          searchInput?.focus();
          break;
      }
    } else if (e.key === 'Delete' && fmSelected) {
      e.preventDefault();
      rm(fmSelected);
    } else if (e.key === 'F2' && fmSelected) {
      e.preventDefault();
      CDEModal.prompt('New name:', fmSelected).then((newName) => {
        if (newName) rename(fmSelected!, newName);
      });
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      goUp();
    }
  });

  initialized = true;
  logger.log('[FileManager] Initialized');
}

// ------------------------------------------------------------------
// EXPOSURE
// ------------------------------------------------------------------

window.openFileManager = () => {
  openWindow({
    id: 'fm',
    zIndex: zIndexManager.increment(),
    center: true,
    playSound: true,
    focus: true,
    onOpen: () => {
      initFileManager();
      openPath(currentPath);
    },
  });
};

window.closeFileManager = () => {
  closeWindow('fm');
};

window.toggleFileManager = () => {
  const win = document.getElementById('fm');
  const panelIcon = document.querySelector('.cde-icon[onclick="toggleFileManager()"] img');
  if (panelIcon instanceof HTMLImageElement) {
    const original = panelIcon.src;
    panelIcon.src = '/icons/places/folder_open.png';
    setTimeout(() => {
      panelIcon.src = original;
    }, 300);
  }
  if (win?.style.display === 'none' || !win?.style.display) window.openFileManager();
  else window.closeFileManager();
};

window.isFileManagerOpen = () => {
  const win = document.getElementById('fm');
  return !!win && win.style.display !== 'none';
};

window.openPath = openPath;
window.goBack = goBack;
window.goForward = goForward;
window.goUp = goUp;
window.goHome = goHome;

window.createFile = async (name, content) => {
  await VFS.touch(currentPath, name);
  const node = VFS.getNode(currentPath + name) as VFSFile;
  if (node) node.content = content;
};

window.saveFile = (path, content) => {
  const node = VFS.getNode(path);
  if (node?.type === 'file') {
    node.content = content;
    logger.log(`[FileManager] Saved: ${path}`);

    // Dispatch filesystem change event to update desktop icons
    window.dispatchEvent(new CustomEvent('cde-fs-change', { detail: { path, action: 'update' } }));
  }
};

export const FileManager = {
  init: initFileManager,
  open: window.openFileManager,
  close: window.closeFileManager,
  toggle: window.toggleFileManager,
  isOpen: window.isFileManagerOpen,
  openPath: openPath,
};

logger.log('[FileManager] Module loaded');
