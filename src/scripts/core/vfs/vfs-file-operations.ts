import { logger } from '../../utilities/logger';
import type { VFSNode, VFSFile, VFSFolder } from './types';

export class VFSFileOperations {
  constructor(
    private fsMap: Record<string, VFSNode>,
    private getNode: (path: string) => VFSNode | null,
    private dispatchChange: (path: string) => void
  ) {}

  /** Creates an empty file in the specified directory. */
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
      this.fsMap[dirPath + name] = newFile;

      if (node.metadata) node.metadata.mtime = new Date().toISOString();

      logger.log(`[VFS] touch: ${dirPath}${name}`);
      this.dispatchChange(dirPath);
    }
  }

  /** Writes content to an existing file. */
  async writeFile(path: string, content: string): Promise<void> {
    const node = this.getNode(path);
    if (node && node.type === 'file') {
      node.content = content;
      if (node.metadata) {
        node.metadata.size = content.length;
        node.metadata.mtime = new Date().toISOString();
      }
      logger.log(`[VFS] writeFile: ${path}`);

      const parts = path.split('/').filter(Boolean);
      parts.pop();
      const parentPath = '/' + parts.join('/') + (parts.length > 0 ? '/' : '');
      const parent = this.getNode(parentPath);
      if (parent?.metadata) parent.metadata.mtime = new Date().toISOString();

      this.dispatchChange(parentPath);
    } else {
      logger.error(`[VFS] writeFile failed: ${path} is not a file or not found`);
    }
  }

  /** Removes a file or folder from the specified directory. */
  async rm(path: string, name: string): Promise<boolean> {
    const dirPath = path.endsWith('/') ? path : path + '/';
    const node = this.getNode(dirPath);
    if (node?.type === 'folder' && node.children[name]) {
      const item = node.children[name];
      const fullPath = dirPath + name + (item.type === 'folder' ? '/' : '');
      delete this.fsMap[fullPath];
      delete node.children[name];
      logger.log(`[VFS] rm: ${fullPath}`);
      this.dispatchChange(dirPath);
      return true;
    }
    return false;
  }
}
