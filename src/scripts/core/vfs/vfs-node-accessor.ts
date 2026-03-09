import type { VFSNode, VFSFolder } from './types';

export class VFSNodeAccessor {
  constructor(private fsMap: Record<string, VFSNode>) {}

  /** Returns the node at the given path, or null if not found. */
  getNode(path: string): VFSNode | null {
    return this.fsMap[path] || null;
  }

  /** Returns the children of a folder, or null if not a folder. */
  getChildren(path: string): Record<string, VFSNode> | null {
    const node = this.getNode(path);
    return node?.type === 'folder' ? node.children : null;
  }

  /** Checks if a path exists in the filesystem. */
  exists(path: string): boolean {
    return !!this.getNode(path);
  }

  /** Calculates the total size of a file or folder recursively. */
  getSize(path: string): number {
    const node = this.getNode(path);
    if (!node) return 0;

    if (node.type === 'file') {
      return node.content.length;
    }

    const calcSize = (n: VFSNode): number => {
      if (n.type === 'file') return n.content.length;
      let sum = 0;
      for (const child of Object.values((n as VFSFolder).children)) {
        sum += calcSize(child);
      }
      return sum;
    };

    return calcSize(node);
  }
}
