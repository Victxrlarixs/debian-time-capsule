import { CONFIG } from '../config';
import { logger } from '../../utilities/logger';
import type { VFSNode, VFSFolder, VFSFile } from './types';
import tutorialData from '../../../data/tutorial.json';
import fontsData from '../../../data/fonts.json';
import cdePalettesData from '../../../data/cde_palettes.json';
import bootMessagesData from '../../../data/boot-messages.json';
import updateMessagesData from '../../../data/update-messages.json';
import backdropsData from '../../../data/backdrops.json';
import filesystemData from '../../../data/filesystem.json';

export class VFSInitializer {
  constructor(
    private fsMap: Record<string, VFSNode>,
    private setRootNode: (node: VFSFolder) => void,
    private mkdir: (path: string, name: string) => Promise<void>
  ) {}

  /** Initializes the virtual filesystem with the root structure. */
  init(): void {
    const rootPath = '/';
    const homePath = CONFIG.FS.HOME;

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

    this.setRootNode(root);
    this.flatten(rootPath, root);

    if (!this.fsMap[CONFIG.FS.TRASH]) {
      const parts = CONFIG.FS.TRASH.split('/').filter(Boolean);
      const trashName = parts.pop()!;
      const parentPath = '/' + parts.join('/') + (parts.length > 0 ? '/' : '');
      this.mkdir(parentPath, trashName);
    }

    this.syncDynamicContent();
    logger.log('[VFS] Initialized with System Root, entries:', Object.keys(this.fsMap).length);
  }

  private flatten(basePath: string, node: VFSNode): void {
    if (!node.metadata) {
      node.metadata = {
        size: node.type === 'file' ? node.content.length : 0,
        mtime: new Date().toISOString(),
        owner: 'victx',
        permissions: node.type === 'folder' ? 'rwxr-xr-x' : 'rw-r--r--',
      };
    }

    this.fsMap[basePath] = node;
    if (node.type === 'folder') {
      for (const [name, child] of Object.entries(node.children)) {
        const fullPath = basePath + name + (child.type === 'folder' ? '/' : '');
        this.flatten(fullPath, child);
      }
    }
  }

  private async syncDynamicContent(): Promise<void> {
    const [
      readme,
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
      import('../../../../README.md?raw'),
      import('../../../../docs/user-guide/getting-started.md?raw'),
      import('../../../../docs/user-guide/xemacs.md?raw'),
      import('../../../../docs/user-guide/terminal-lab.md?raw'),
      import('../../../../docs/user-guide/file-manager.md?raw'),
      import('../../../../docs/user-guide/netscape.md?raw'),
      import('../../../../docs/user-guide/style-manager.md?raw'),
      import('../../../../docs/user-guide/workspaces.md?raw'),
      import('../../../../docs/user-guide/keyboard-shortcuts.md?raw'),
      import('../../../../docs/user-guide/tips-and-tricks.md?raw'),
      import('../../../../docs/user-guide/lynx.md?raw'),
    ]);

    const readmePath = CONFIG.FS.HOME + 'README.md';
    const readmeFile = this.fsMap[readmePath] as VFSFile;
    if (readmeFile?.type === 'file') {
      readmeFile.content = readme.default;
    }

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
      if (this.fsMap[path]) {
        (this.fsMap[path] as VFSFile).content = content;
      }
    });

    const fontsPath = CONFIG.FS.HOME + 'settings/fonts.json';
    if (this.fsMap[fontsPath])
      (this.fsMap[fontsPath] as VFSFile).content = JSON.stringify(fontsData, null, 2);

    const palettesPath = CONFIG.FS.HOME + 'settings/cde_palettes.json';
    if (this.fsMap[palettesPath])
      (this.fsMap[palettesPath] as VFSFile).content = JSON.stringify(cdePalettesData, null, 2);

    const bootPath = CONFIG.FS.HOME + 'settings/boot-messages.json';
    if (this.fsMap[bootPath])
      (this.fsMap[bootPath] as VFSFile).content = JSON.stringify(bootMessagesData, null, 2);

    const updatePath = CONFIG.FS.HOME + 'settings/update-messages.json';
    if (this.fsMap[updatePath])
      (this.fsMap[updatePath] as VFSFile).content = JSON.stringify(updateMessagesData, null, 2);

    const backdropPath = CONFIG.FS.HOME + 'settings/backdrops.json';
    if (this.fsMap[backdropPath])
      (this.fsMap[backdropPath] as VFSFile).content = JSON.stringify(backdropsData, null, 2);

    const tutorialPath = CONFIG.FS.HOME + 'settings/tutorial.json';
    if (this.fsMap[tutorialPath])
      (this.fsMap[tutorialPath] as VFSFile).content = JSON.stringify(tutorialData, null, 2);

    logger.log('[VFS] Dynamic content synced (Lazy)');
  }
}
