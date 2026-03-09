// src/scripts/features/filemanager.ts

import { CONFIG } from '../core/config';
import { VFS, type VFSNode, type VFSFile } from '../core/vfs';
import { CDEModal } from '../ui/modals';
import { logger } from '../utilities/logger';
import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../shared/clipboard';
import { createContextMenu, type ContextMenuItem } from '../shared/context-menu';
import { openWindow, closeWindow, createZIndexManager } from '../shared/window-helpers';
import {} from '../shared/file-icons';
import { FileSorter } from './file-manager/file-sorter';
import { NavigationManager } from './file-manager/navigation-manager';
import { FileOperations } from './file-manager/file-operations';
import { FileRenderer } from './file-manager/file-renderer';
import { MenuManager } from './file-manager/menu-manager';
import { formatSize, getFileIcon, showProperties } from './file-manager/file-utils';

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

let fmSelected: string | null = null;
const zIndexManager = createZIndexManager(CONFIG.FILEMANAGER.BASE_Z_INDEX);
let initialized: boolean = false;
let searchQuery: string = '';
const fileSorter = new FileSorter();
const navigationManager = new NavigationManager();
const fileOperations = new FileOperations(VFS);
const fileRenderer = new FileRenderer();
const menuManager = new MenuManager(
  () => navigationManager.getCurrentPath(),
  () => fmSelected,
  touch,
  mkdir,
  rm,
  rename,
  emptyTrash,
  restore,
  openPath,
  openTextWindow,
  goBack,
  goForward,
  goUp,
  goHome,
  (sortBy) => {
    fileSorter.setSortBy(sortBy);
    renderFiles();
  },
  () => {
    fileSorter.toggleShowHidden();
    renderFiles();
  },
  renderFiles
);

let renderTimeout: number | null = null;
function debouncedRender(): void {
  if (renderTimeout) window.clearTimeout(renderTimeout);
  renderTimeout = window.setTimeout(() => {
    renderFiles();
    renderTimeout = null;
  }, 50);
}

window.addEventListener('cde-fs-change', (e: any) => {
  const currentPath = navigationManager.getCurrentPath();
  if (e.detail?.path === currentPath) {
    debouncedRender();
  }
});

function renderFiles(): void {
  const container = document.getElementById('fmFiles');
  const status = document.getElementById('fmStatus');

  if (!container || !status) return;

  const currentPath = navigationManager.getCurrentPath();
  navigationManager.updatePathInput();
  const children = VFS.getChildren(currentPath);

  if (!children) {
    logger.warn(`[FileManager] renderFiles: path not found: ${currentPath}`);
    return;
  }

  const items = fileSorter.filterAndSort(children, currentPath, searchQuery);

  fileRenderer.renderIconView(
    container,
    items,
    currentPath,
    fmSelected,
    (name) => {
      fmSelected = name;
    },
    (name, node) => {
      if (node.type === 'folder') {
        openPath(currentPath + name + '/');
      } else {
        openTextWindow(name, (node as VFSFile).content);
      }
    },
    (e, name) => {
      fmSelected = name;
      handleContextMenu(e);
    },
    async (sourcePath, targetName) => {
      const parts = sourcePath.split('/').filter(Boolean);
      const fileName = parts[parts.length - 1];
      await VFS.move(sourcePath, currentPath + targetName + '/' + fileName);
    }
  );

  status.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}${searchQuery ? ' (filtered)' : ''}`;
  navigationManager.renderBreadcrumbs(openPath);
}

function openPath(path: string): void {
  if (!VFS.getNode(path)) {
    logger.warn(`[FileManager] openPath: path not found: ${path}`);
    return;
  }

  navigationManager.navigate(path);
  searchQuery = '';
  const searchInput = document.getElementById('fmSearch') as HTMLInputElement | null;
  if (searchInput) searchInput.value = '';

  renderFiles();
}

function goBack(): void {
  if (navigationManager.goBack()) {
    renderFiles();
  }
}

function goForward(): void {
  if (navigationManager.goForward()) {
    renderFiles();
  }
}

function goUp(): void {
  const parent = navigationManager.goUp();
  if (parent && VFS.getNode(parent)) {
    openPath(parent);
  }
}

function goHome(): void {
  openPath(navigationManager.goHome());
}

async function touch(name: string): Promise<void> {
  const currentPath = navigationManager.getCurrentPath();
  await fileOperations.createFile(currentPath, name);
}

async function mkdir(name: string): Promise<void> {
  const currentPath = navigationManager.getCurrentPath();
  await fileOperations.createFolder(currentPath, name);
}

async function rm(name: string): Promise<void> {
  if (!name) return;
  const currentPath = navigationManager.getCurrentPath();
  const deleted = await fileOperations.deleteFile(currentPath, name);
  if (deleted) {
    fmSelected = null;
  }
}

async function emptyTrash(): Promise<void> {
  await fileOperations.emptyTrash();
}

async function restore(name: string): Promise<void> {
  await fileOperations.restoreFromTrash(name);
  fmSelected = null;
}

async function rename(oldName: string, newName: string): Promise<void> {
  const currentPath = navigationManager.getCurrentPath();
  await fileOperations.renameFile(currentPath, oldName, newName);
  fmSelected = null;
}

async function openTextWindow(name: string, content: string): Promise<void> {
  if (window.openEmacs) {
    await window.openEmacs(name, content);
  }
}

function handleContextMenu(e: MouseEvent): void {
  menuManager.handleContextMenu(e);
}

function initFileManager(): void {
  if (initialized) return;

  menuManager.setupMenuBar();
  const fmFiles = document.getElementById('fmFiles');
  if (fmFiles) {
    fmFiles.addEventListener('contextmenu', handleContextMenu);

    fmFiles.addEventListener('dragover', (e) => e.preventDefault());
    fmFiles.addEventListener('drop', async (e) => {
      const currentPath = navigationManager.getCurrentPath();
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
    menuManager.closeMenu();
    menuManager.closeContextMenu();
  });

  const pathInput = document.getElementById('fmPath') as HTMLInputElement | null;
  if (pathInput) {
    pathInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        openPath(pathInput.value);
        navigationManager.togglePathInput(false);
      }
      if (e.key === 'Escape') navigationManager.togglePathInput(false);
    });
    pathInput.addEventListener('blur', () => navigationManager.togglePathInput(false));
  }

  const pathContainer = document.getElementById('fmPathContainer');
  if (pathContainer) {
    pathContainer.addEventListener('click', () => navigationManager.togglePathInput(true));
  }

  const searchInput = document.getElementById('fmSearch') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.toLowerCase();
      renderFiles();
    });
  }

  document.addEventListener('keydown', async (e: KeyboardEvent) => {
    const win = document.getElementById('fm');
    if (!win || win.style.display === 'none') return;

    if (e.target instanceof HTMLInputElement) return;

    const currentPath = navigationManager.getCurrentPath();

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

window.openFileManager = () => {
  openWindow({
    id: 'fm',
    zIndex: zIndexManager.increment(),
    center: true,
    playSound: true,
    focus: true,
    onOpen: () => {
      initFileManager();
      openPath(navigationManager.getCurrentPath());
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
  const currentPath = navigationManager.getCurrentPath();
  await VFS.touch(currentPath, name);
  const node = VFS.getNode(currentPath + name) as VFSFile;
  if (node) node.content = content;
};

window.saveFile = (path, content) => {
  const node = VFS.getNode(path);
  if (node?.type === 'file') {
    node.content = content;
    logger.log(`[FileManager] Saved: ${path}`);

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
