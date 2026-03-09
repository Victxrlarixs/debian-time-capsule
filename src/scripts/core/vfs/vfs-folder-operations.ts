import { logger } from '../../utilities/logger';
import type { VFSNode, VFSFolder } from './types';

export class VFSFolderOperations {
  constructor(
    private fsMap: Record<string, VFSNode>,
    private getNode: (path: string) => VFSNode | null,
    private dispatchChange: (path: string) => void
  ) {}

  /** Creates a new folder in the specified directory. */
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
      this.fsMap[dirPath + name + '/'] = newFolder;

      if (node.metadata) node.metadata.mtime = new Date().toISOString();

      logger.log(`[VFS] mkdir: ${dirPath}${name}/`);
      this.dispatchChange(dirPath);
    }
  }
}
