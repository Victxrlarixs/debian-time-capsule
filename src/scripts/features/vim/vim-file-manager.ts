import { VFS } from '../../core/vfs';
import { ErrorSeverity } from '../../core/error-handler';

/**
 * File Manager - Single Responsibility: Handle file operations
 */
export class VimFileManager {
  constructor(
    private textarea: HTMLTextAreaElement,
    private onMessage: (msg: string, isError?: boolean) => void,
    private onFileChange: (path: string, modified: boolean) => void,
    private onTitleUpdate: (title: string) => void
  ) {}

  async save(filePath: string): Promise<boolean> {
    if (!filePath) {
      this.onMessage('E32: No file name', true);
      return false;
    }

    const { errorHandler } = await import('../../core/error-handler');
    const result = await errorHandler.wrapAsync(
      async () => {
        const existing = VFS.getNode(filePath);
        if (!existing) {
          const parts = filePath.split('/');
          const filename = parts.pop()!;
          const parentDir = parts.join('/') + '/';
          await VFS.touch(parentDir, filename);
        }
        await VFS.writeFile(filePath, this.textarea.value);
        this.onFileChange(filePath, false);
        this.onMessage(`"${filePath}" written`);
        if (window.AudioManager) window.AudioManager.success();
        return true;
      },
      {
        module: 'Vim',
        action: 'save',
        severity: ErrorSeverity.HIGH,
        data: { path: filePath },
      }
    );

    if (!result) {
      this.onMessage('Error writing file', true);
      if (window.AudioManager) window.AudioManager.error();
      return false;
    }

    return true;
  }

  async saveAs(filename: string): Promise<string | null> {
    let fullPath: string;
    if (filename.startsWith('/')) {
      fullPath = filename;
    } else {
      fullPath = `/home/victxrlarixs/Desktop/${filename}`;
    }

    const parts = fullPath.split('/');
    const fname = parts.pop()!;
    const parentDir = parts.join('/') + '/';

    if (!VFS.getNode(parentDir)) {
      this.onMessage(`E212: Can't open file for writing`, true);
      if (window.AudioManager) window.AudioManager.error();
      return null;
    }

    const { errorHandler } = await import('../../core/error-handler');
    const result = await errorHandler.wrapAsync(
      async () => {
        const existing = VFS.getNode(fullPath);
        if (!existing) await VFS.touch(parentDir, fname);
        this.onTitleUpdate(fname);
        return fullPath;
      },
      {
        module: 'Vim',
        action: 'saveAs',
        severity: ErrorSeverity.HIGH,
        data: { path: fullPath },
      }
    );

    if (!result) {
      this.onMessage('Error writing file', true);
      if (window.AudioManager) window.AudioManager.error();
      return null;
    }

    return result;
  }

  async openFile(filename: string): Promise<{ path: string; content: string; isNew: boolean } | null> {
    let fullPath: string;
    if (filename.startsWith('/')) {
      fullPath = filename;
    } else {
      fullPath = `/home/victxrlarixs/Desktop/${filename}`;
    }

    const node = VFS.getNode(fullPath);
    if (!node) {
      this.onMessage(`"${fullPath}" [New File]`);
      return { path: fullPath, content: '', isNew: true };
    }

    if (node.type !== 'file') {
      this.onMessage(`E502: "${fullPath}" is a directory`, true);
      return null;
    }

    const fname = fullPath.split('/').pop()!;
    return { path: fullPath, content: node.content, isNew: false };
  }

  reloadFile(filePath: string): boolean {
    if (!filePath) {
      this.onMessage('E32: No file name', true);
      return false;
    }

    const node = VFS.getNode(filePath);
    if (node && node.type === 'file') {
      this.textarea.value = node.content;
      this.onFileChange(filePath, false);
      this.onMessage('File reloaded');
      return true;
    }

    this.onMessage('Error reloading file', true);
    return false;
  }

  showExplorer(dirPath: string): string {
    const node = VFS.getNode(dirPath);
    if (!node || node.type !== 'folder') {
      this.onMessage(`E344: Can't find directory "${dirPath}" in cdpath`, true);
      return '';
    }

    let listing = `" ============================================================================\n`;
    listing += `" Netrw Directory Listing                                        (netrw v53)\n`;
    listing += `"   ${dirPath}\n`;
    listing += `"   Sorted by      name\n`;
    listing += `"   Sort sequence: [/]$,*,\\.bak$,\\.o$,\\.h$,\\.info$,\\.swp$,\\.obj$\n`;
    listing += `"   Quick Help: <F1>:help  -:go up dir  D:delete  R:rename  s:sort-by  x:exec\n`;
    listing += `" ============================================================================\n`;
    listing += `../\n`;

    // List directories first
    const dirs: string[] = [];
    const files: string[] = [];

    if (node.type === 'folder' && node.children) {
      Object.keys(node.children).forEach(name => {
        const child = node.children![name];
        if (child.type === 'folder') {
          dirs.push(name + '/');
        } else {
          files.push(name);
        }
      });
    }

    dirs.sort().forEach(dir => listing += dir + '\n');
    files.sort().forEach(file => listing += file + '\n');

    return listing;
  }
}