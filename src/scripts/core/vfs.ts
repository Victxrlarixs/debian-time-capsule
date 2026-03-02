import { CONFIG } from './config';
import { logger } from '../utilities/logger';
// Sync content imports
import tutorialData from '../../data/tutorial.json';
import fontsData from '../../data/fonts.json';
import cdePalettesData from '../../data/cde_palettes.json';
import bootMessagesData from '../../data/boot-messages.json';
import updateMessagesData from '../../data/update-messages.json';
import backdropsData from '../../data/backdrops.json';
import filesystemData from '../../data/filesystem.json';

// --- Types ---

export interface VFSMetadata {
  size: number;
  mtime: string; // ISO string
  owner: string;
  permissions: string;
}

export interface VFSFile {
  type: 'file';
  content: string;
  metadata?: VFSMetadata;
}

export interface VFSFolder {
  type: 'folder';
  children: Record<string, VFSNode>;
  metadata?: VFSMetadata;
}

export type VFSNode = VFSFile | VFSFolder;

export interface IVFS {
  init(): void;
  resolvePath(cwd: string, path: string): string;
  getNode(path: string): VFSNode | null;
  getChildren(path: string): Record<string, VFSNode> | null;
  touch(path: string, name: string): Promise<void>;
  mkdir(path: string, name: string): Promise<void>;
  rm(path: string, name: string): Promise<boolean>;
  rename(path: string, oldName: string, newName: string): Promise<void>;
  move(oldPath: string, newPath: string): Promise<void>;
  copy(sourcePath: string, destPath: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  moveToTrash(path: string): Promise<void>;
  restoreFromTrash(name: string): Promise<void>;
  search(basePath: string, query: string, recursive?: boolean): Promise<string[]>;
  getSize(path: string): number;
  exists(path: string): boolean;
}

declare global {
  interface Window {
    VirtualFS: IVFS;
  }
}

// --- State ---

/** Flattened map for O(1) path lookups */
const fsMap: Record<string, VFSNode> = {};

/** The root node of the virtual filesystem */
let rootNode: VFSFolder | null = null;

// --- Private Helpers ---

/**
 * Recursively flattens the nested filesystem structure.
 */
function flatten(basePath: string, node: VFSNode): void {
  if (!node.metadata) {
    node.metadata = {
      size: node.type === 'file' ? node.content.length : 0,
      mtime: new Date().toISOString(),
      owner: 'victx',
      permissions: node.type === 'folder' ? 'rwxr-xr-x' : 'rw-r--r--',
    };
  }

  fsMap[basePath] = node;
  if (node.type === 'folder') {
    for (const [name, child] of Object.entries((node as VFSFolder).children)) {
      const fullPath = basePath + name + (child.type === 'folder' ? '/' : '');
      flatten(fullPath, child);
    }
  }
}

/**
 * Notifies the system that the filesystem has changed.
 */
function dispatchChange(path: string): void {
  window.dispatchEvent(
    new CustomEvent('cde-fs-change', {
      detail: { path },
    })
  );
}

// --- Sync Logic ---

async function syncDynamicContent(): Promise<void> {
  // Load heavy assets dynamically to keep initial bundle small
  const [
    readme,
    // User guide documentation
    gettingStarted,
    xemacsGuide,
    terminalLabGuide,
    fileManagerGuide,
    netscapeGuide,
    styleManagerGuide,
    workspacesGuide,
    keyboardShortcuts,
    tipsAndTricks,
    lynxGuide,
  ] = await Promise.all([
    import('../../../README.md?raw'),
    // Documentation imports
    import('../../../docs/user-guide/getting-started.md?raw'),
    import('../../../docs/user-guide/xemacs.md?raw'),
    import('../../../docs/user-guide/terminal-lab.md?raw'),
    import('../../../docs/user-guide/file-manager.md?raw'),
    import('../../../docs/user-guide/netscape.md?raw'),
    import('../../../docs/user-guide/style-manager.md?raw'),
    import('../../../docs/user-guide/workspaces.md?raw'),
    import('../../../docs/user-guide/keyboard-shortcuts.md?raw'),
    import('../../../docs/user-guide/tips-and-tricks.md?raw'),
    import('../../../docs/user-guide/lynx.md?raw'),
  ]);

  // README.md in user home directory
  const readmePath = CONFIG.FS.HOME + 'README.md';
  const readmeFile = fsMap[readmePath] as VFSFile;
  if (readmeFile?.type === 'file') {
    readmeFile.content = readme.default;
  }

  // Documentation files
  const docsBasePath = CONFIG.FS.HOME + 'Documentation/';
  const docFiles = {
    'Getting-Started.md': gettingStarted.default,
    'XEmacs-Guide.md': xemacsGuide.default,
    'Terminal-Lab.md': terminalLabGuide.default,
    'File-Manager.md': fileManagerGuide.default,
    'Netscape.md': netscapeGuide.default,
    'Lynx.md': lynxGuide.default,
    'Style-Manager.md': styleManagerGuide.default,
    'Workspaces.md': workspacesGuide.default,
    'Keyboard-Shortcuts.md': keyboardShortcuts.default,
    'Tips-and-Tricks.md': tipsAndTricks.default,
  };

  Object.entries(docFiles).forEach(([filename, content]) => {
    const path = docsBasePath + filename;
    if (fsMap[path]) {
      (fsMap[path] as VFSFile).content = content;
    }
  });

  const fontsPath = CONFIG.FS.HOME + 'settings/fonts.json';
  if (fsMap[fontsPath]) (fsMap[fontsPath] as VFSFile).content = JSON.stringify(fontsData, null, 2);

  const palettesPath = CONFIG.FS.HOME + 'settings/cde_palettes.json';
  if (fsMap[palettesPath])
    (fsMap[palettesPath] as VFSFile).content = JSON.stringify(cdePalettesData, null, 2);

  const bootPath = CONFIG.FS.HOME + 'settings/boot-messages.json';
  if (fsMap[bootPath])
    (fsMap[bootPath] as VFSFile).content = JSON.stringify(bootMessagesData, null, 2);

  const updatePath = CONFIG.FS.HOME + 'settings/update-messages.json';
  if (fsMap[updatePath])
    (fsMap[updatePath] as VFSFile).content = JSON.stringify(updateMessagesData, null, 2);

  const backdropPath = CONFIG.FS.HOME + 'settings/backdrops.json';
  if (fsMap[backdropPath])
    (fsMap[backdropPath] as VFSFile).content = JSON.stringify(backdropsData, null, 2);

  const tutorialPath = CONFIG.FS.HOME + 'settings/tutorial.json';
  if (fsMap[tutorialPath])
    (fsMap[tutorialPath] as VFSFile).content = JSON.stringify(tutorialData, null, 2);

  logger.log('[VFS] Dynamic content synced (Lazy)');
}

// --- Public API ---

export const VFS: IVFS = {
  init(): void {
    const rootPath = '/';
    const homePath = CONFIG.FS.HOME;

    // Build a proper root structure
    const root: VFSFolder = {
      type: 'folder',
      children: {
        bin: { type: 'folder', children: {} },
        etc: {
          type: 'folder',
          children: {
            hostname: { type: 'file', content: 'Debian-CDE' },
            motd: { type: 'file', content: 'Welcome to Debian CDE Workstation' },
            'os-release': {
              type: 'file',
              content:
                'PRETTY_NAME="Debian GNU/Linux CDE Edition"\nNAME="Debian GNU/Linux"\nID=debian',
            },
            passwd: {
              type: 'file',
              content:
                'root:x:0:0:root:/root:/bin/bash\nvictx:x:1000:1000:victx:/home/victxrlarixs:/bin/bash',
            },
          },
        },
        usr: {
          type: 'folder',
          children: {
            bin: { type: 'folder', children: {} },
            lib: { type: 'folder', children: {} },
            src: {
              type: 'folder',
              children: {
                'debian-cde': {
                  type: 'folder',
                  children: {
                    src: {
                      type: 'folder',
                      children: {
                        components: { type: 'folder', children: {} },
                        scripts: { type: 'folder', children: {} },
                        layouts: { type: 'folder', children: {} },
                      },
                    },
                    public: {
                      type: 'folder',
                      children: {
                        icons: { type: 'folder', children: {} },
                        css: { type: 'folder', children: {} },
                      },
                    },
                    'package.json': {
                      type: 'file',
                      content:
                        '{\n  "name": "debian-cde",\n  "version": "1.0.0",\n  "dependencies": {\n    "astro": "latest",\n    "typescript": "latest"\n  }\n}',
                    },
                    'README.md': {
                      type: 'file',
                      content: '# Debian CDE\nClassic Desktop Environment for the web.',
                    },
                    'tsconfig.json': {
                      type: 'file',
                      content: '{\n  "compilerOptions": { ... }\n}',
                    },
                  },
                },
              },
            },
          },
        },
        var: { type: 'folder', children: {} },
        tmp: { type: 'folder', children: {} },
        home: {
          type: 'folder',
          children: {
            victxrlarixs: (filesystemData as any)[homePath],
          },
        },
      },
    };

    rootNode = root;
    flatten(rootPath, rootNode);

    if (!fsMap[CONFIG.FS.TRASH]) {
      const parts = CONFIG.FS.TRASH.split('/').filter(Boolean);
      const trashName = parts.pop()!;
      const parentPath = '/' + parts.join('/') + (parts.length > 0 ? '/' : '');
      this.mkdir(parentPath, trashName);
    }

    syncDynamicContent(); // Non-blocking sync
    logger.log('[VFS] Initialized with System Root, entries:', Object.keys(fsMap).length);
  },

  resolvePath(cwd: string, path: string): string {
    if (path.startsWith('~')) path = CONFIG.FS.HOME + path.slice(1);
    if (!path.startsWith('/')) path = cwd + (cwd.endsWith('/') ? '' : '/') + path;

    const parts = path.split('/').filter(Boolean);
    const resolved: string[] = [];

    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        resolved.pop();
        continue;
      }
      resolved.push(part);
    }

    return '/' + resolved.join('/') + (path.endsWith('/') && resolved.length > 0 ? '/' : '');
  },

  getNode(path: string): VFSNode | null {
    return fsMap[path] || null;
  },

  getChildren(path: string): Record<string, VFSNode> | null {
    const node = this.getNode(path);
    return node?.type === 'folder' ? node.children : null;
  },

  async touch(path: string, name: string): Promise<void> {
    const dirPath = path.endsWith('/') ? path : path + '/';
    const node = this.getNode(dirPath);
    if (node?.type === 'folder') {
      const newFile: VFSFile = {
        type: 'file',
        content: '',
        metadata: {
          size: 0,
          mtime: new Date().toISOString(),
          owner: 'victx',
          permissions: 'rw-r--r--',
        },
      };
      node.children[name] = newFile;
      fsMap[dirPath + name] = newFile;

      // Update folder mtime
      if (node.metadata) node.metadata.mtime = new Date().toISOString();

      logger.log(`[VFS] touch: ${dirPath}${name}`);
      dispatchChange(dirPath);
    }
  },

  async mkdir(path: string, name: string): Promise<void> {
    const dirPath = path.endsWith('/') ? path : path + '/';
    const node = this.getNode(dirPath);
    if (node?.type === 'folder') {
      const newFolder: VFSFolder = {
        type: 'folder',
        children: {},
        metadata: {
          size: 0,
          mtime: new Date().toISOString(),
          owner: 'victx',
          permissions: 'rwxr-xr-x',
        },
      };
      node.children[name] = newFolder;
      fsMap[dirPath + name + '/'] = newFolder;

      // Update parent mtime
      if (node.metadata) node.metadata.mtime = new Date().toISOString();

      logger.log(`[VFS] mkdir: ${dirPath}${name}/`);
      dispatchChange(dirPath);
    }
  },

  async rm(path: string, name: string): Promise<boolean> {
    const dirPath = path.endsWith('/') ? path : path + '/';
    const node = this.getNode(dirPath);
    if (node?.type === 'folder' && node.children[name]) {
      const item = node.children[name];
      const fullPath = dirPath + name + (item.type === 'folder' ? '/' : '');
      delete fsMap[fullPath];
      delete node.children[name];
      logger.log(`[VFS] rm: ${fullPath}`);
      dispatchChange(dirPath);
      return true;
    }
    return false;
  },

  async rename(path: string, oldName: string, newName: string): Promise<void> {
    const dirPath = path.endsWith('/') ? path : path + '/';
    const node = this.getNode(dirPath);
    if (node?.type === 'folder' && node.children[oldName]) {
      const item = node.children[oldName];
      const oldPath = dirPath + oldName + (item.type === 'folder' ? '/' : '');
      const newPath = dirPath + newName + (item.type === 'folder' ? '/' : '');

      node.children[newName] = item;
      delete node.children[oldName];

      fsMap[newPath] = item;
      delete fsMap[oldPath];

      logger.log(`[VFS] rename: ${oldPath} -> ${newPath}`);
      dispatchChange(dirPath);
    }
  },

  async writeFile(path: string, content: string): Promise<void> {
    const node = this.getNode(path);
    if (node && node.type === 'file') {
      node.content = content;
      if (node.metadata) {
        node.metadata.size = content.length;
        node.metadata.mtime = new Date().toISOString();
      }
      logger.log(`[VFS] writeFile: ${path}`);
      // Find parent directory to dispatch change
      const parts = path.split('/').filter(Boolean);
      parts.pop();
      const parentPath = '/' + parts.join('/') + (parts.length > 0 ? '/' : '');
      const parent = this.getNode(parentPath);
      if (parent?.metadata) parent.metadata.mtime = new Date().toISOString();

      dispatchChange(parentPath);
    } else {
      logger.error(`[VFS] writeFile failed: ${path} is not a file or not found`);
    }
  },

  async move(oldPath: string, newPath: string): Promise<void> {
    const node = this.getNode(oldPath);
    if (!node) return;

    // Get parent of oldPath
    const oldParts = oldPath.split('/').filter(Boolean);
    const name = oldParts.pop()!;
    const oldParentPath = '/' + oldParts.join('/') + (oldParts.length > 0 ? '/' : '');
    const oldParent = this.getNode(oldParentPath);

    // Get parent of newPath
    const newParts = newPath.split('/').filter(Boolean);
    const newName = newParts.pop()!;
    const newParentPath = '/' + newParts.join('/') + (newParts.length > 0 ? '/' : '');
    const newParent = this.getNode(newParentPath);

    if (oldParent?.type === 'folder' && newParent?.type === 'folder') {
      // Remove from old parent
      delete oldParent.children[name];
      delete fsMap[oldPath];

      // Add to new parent
      newParent.children[newName] = node;
      fsMap[newPath] = node;

      // If it's a folder, we need to recursively update fsMap keys
      if (node.type === 'folder') {
        const updateMap = (base: string, n: VFSNode) => {
          if (n.type === 'folder') {
            for (const [cName, child] of Object.entries(n.children)) {
              const cp = base + cName + (child.type === 'folder' ? '/' : '');
              const oldCp = oldPath + cp.slice(newPath.length);
              delete fsMap[oldCp];
              fsMap[cp] = child;
              updateMap(cp, child);
            }
          }
        };
        updateMap(newPath, node);
      }

      logger.log(`[VFS] move: ${oldPath} -> ${newPath}`);
      dispatchChange(oldParentPath);
      dispatchChange(newParentPath);
    }
  },

  async moveToTrash(path: string): Promise<void> {
    const trashPath = CONFIG.FS.TRASH;
    if (!this.getNode(trashPath)) {
      const parts = trashPath.split('/').filter(Boolean);
      const trashName = parts.pop()!;
      const parentPath = '/' + parts.join('/') + (parts.length > 0 ? '/' : '');
      await this.mkdir(parentPath, trashName);
    }

    const parts = path.split('/').filter(Boolean);
    const name = parts.pop()!;
    await this.move(path, trashPath + name);
  },

  async restoreFromTrash(name: string): Promise<void> {
    const trashItemPath = CONFIG.FS.TRASH + name;
    const restorePath = CONFIG.FS.DESKTOP + name;
    await this.move(trashItemPath, restorePath);
  },

  async copy(sourcePath: string, destPath: string): Promise<void> {
    const sourceNode = this.getNode(sourcePath);
    if (!sourceNode) {
      logger.error(`[VFS] copy: source not found: ${sourcePath}`);
      return;
    }

    // Deep clone the node
    const cloneNode = (node: VFSNode): VFSNode => {
      if (node.type === 'file') {
        return {
          type: 'file',
          content: node.content,
          metadata: node.metadata
            ? { ...node.metadata, mtime: new Date().toISOString() }
            : undefined,
        };
      } else {
        const cloned: VFSFolder = {
          type: 'folder',
          children: {},
          metadata: node.metadata
            ? { ...node.metadata, mtime: new Date().toISOString() }
            : undefined,
        };
        for (const [name, child] of Object.entries(node.children)) {
          cloned.children[name] = cloneNode(child);
        }
        return cloned;
      }
    };

    const clonedNode = cloneNode(sourceNode);

    // Get destination parent
    const destParts = destPath.split('/').filter(Boolean);
    const destName = destParts.pop()!;
    const destParentPath = '/' + destParts.join('/') + (destParts.length > 0 ? '/' : '');
    const destParent = this.getNode(destParentPath);

    if (destParent?.type === 'folder') {
      destParent.children[destName] = clonedNode;
      const finalPath = destPath + (clonedNode.type === 'folder' ? '/' : '');

      // Recursively add to fsMap
      const addToMap = (base: string, n: VFSNode) => {
        fsMap[base] = n;
        if (n.type === 'folder') {
          for (const [cName, child] of Object.entries(n.children)) {
            const cp = base + cName + (child.type === 'folder' ? '/' : '');
            addToMap(cp, child);
          }
        }
      };
      addToMap(finalPath, clonedNode);

      logger.log(`[VFS] copy: ${sourcePath} -> ${destPath}`);
      dispatchChange(destParentPath);
    }
  },

  async search(basePath: string, query: string, recursive = false): Promise<string[]> {
    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    const searchDir = (path: string) => {
      const children = this.getChildren(path);
      if (!children) return;

      for (const [name, node] of Object.entries(children)) {
        const fullPath = path + name + (node.type === 'folder' ? '/' : '');

        // Match filename
        if (name.toLowerCase().includes(lowerQuery)) {
          results.push(fullPath);
        }

        // Search file content if it's a text file
        if (node.type === 'file' && node.content.toLowerCase().includes(lowerQuery)) {
          if (!results.includes(fullPath)) {
            results.push(fullPath);
          }
        }

        // Recurse into folders
        if (recursive && node.type === 'folder') {
          searchDir(fullPath);
        }
      }
    };

    searchDir(basePath);
    return results;
  },

  getSize(path: string): number {
    const node = this.getNode(path);
    if (!node) return 0;

    if (node.type === 'file') {
      return node.content.length;
    }

    // Recursive size for folders
    const calcSize = (n: VFSNode): number => {
      if (n.type === 'file') return n.content.length;
      let sum = 0;
      for (const child of Object.values(n.children)) {
        sum += calcSize(child);
      }
      return sum;
    };

    return calcSize(node);
  },

  exists(path: string): boolean {
    return !!this.getNode(path);
  },
};

// Global Exposure
if (typeof window !== 'undefined') {
  window.VirtualFS = VFS;
}
