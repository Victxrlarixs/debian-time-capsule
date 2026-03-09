import { logger } from '../../utilities/logger';
import type { VFSNode, VFSFolder, VFSFile } from './types';

export class VFSTransferOperations {
  constructor(
    private fsMap: Record<string, VFSNode>,
    private getNode: (path: string) => VFSNode | null,
    private dispatchChange: (path: string) => void
  ) {}

  /** Renames a file or folder within the same directory. */
  async rename(path: string, oldName: string, newName: string): Promise<void> {
    const dirPath = path.endsWith('/') ? path : path + '/';
    const node = this.getNode(dirPath);
    if (node?.type === 'folder' && node.children[oldName]) {
      const item = node.children[oldName];
      const oldPath = dirPath + oldName + (item.type === 'folder' ? '/' : '');
      const newPath = dirPath + newName + (item.type === 'folder' ? '/' : '');

      node.children[newName] = item;
      delete node.children[oldName];

      this.fsMap[newPath] = item;
      delete this.fsMap[oldPath];

      logger.log(`[VFS] rename: ${oldPath} -> ${newPath}`);
      this.dispatchChange(dirPath);
    }
  }

  /** Moves a file or folder to a new location. */
  async move(oldPath: string, newPath: string): Promise<void> {
    const node = this.getNode(oldPath);
    if (!node) return;

    const oldParts = oldPath.split('/').filter(Boolean);
    const name = oldParts.pop()!;
    const oldParentPath = '/' + oldParts.join('/') + (oldParts.length > 0 ? '/' : '');
    const oldParent = this.getNode(oldParentPath);

    const newParts = newPath.split('/').filter(Boolean);
    const newName = newParts.pop()!;
    const newParentPath = '/' + newParts.join('/') + (newParts.length > 0 ? '/' : '');
    const newParent = this.getNode(newParentPath);

    if (oldParent?.type === 'folder' && newParent?.type === 'folder') {
      delete oldParent.children[name];
      delete this.fsMap[oldPath];

      newParent.children[newName] = node;
      this.fsMap[newPath] = node;

      if (node.type === 'folder') {
        const updateMap = (base: string, n: VFSNode) => {
          if (n.type === 'folder') {
            for (const [cName, child] of Object.entries(n.children)) {
              const cp = base + cName + (child.type === 'folder' ? '/' : '');
              const oldCp = oldPath + cp.slice(newPath.length);
              delete this.fsMap[oldCp];
              this.fsMap[cp] = child;
              updateMap(cp, child);
            }
          }
        };
        updateMap(newPath, node);
      }

      logger.log(`[VFS] move: ${oldPath} -> ${newPath}`);
      this.dispatchChange(oldParentPath);
      this.dispatchChange(newParentPath);
    }
  }

  /** Copies a file or folder to a new location. */
  async copy(sourcePath: string, destPath: string): Promise<void> {
    const sourceNode = this.getNode(sourcePath);
    if (!sourceNode) {
      logger.error(`[VFS] copy: source not found: ${sourcePath}`);
      return;
    }

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

    const destParts = destPath.split('/').filter(Boolean);
    const destName = destParts.pop()!;
    const destParentPath = '/' + destParts.join('/') + (destParts.length > 0 ? '/' : '');
    const destParent = this.getNode(destParentPath);

    if (destParent?.type === 'folder') {
      destParent.children[destName] = clonedNode;
      const finalPath = destPath + (clonedNode.type === 'folder' ? '/' : '');

      const addToMap = (base: string, n: VFSNode) => {
        this.fsMap[base] = n;
        if (n.type === 'folder') {
          for (const [cName, child] of Object.entries(n.children)) {
            const cp = base + cName + (child.type === 'folder' ? '/' : '');
            addToMap(cp, child);
          }
        }
      };
      addToMap(finalPath, clonedNode);

      logger.log(`[VFS] copy: ${sourcePath} -> ${destPath}`);
      this.dispatchChange(destParentPath);
    }
  }
}
