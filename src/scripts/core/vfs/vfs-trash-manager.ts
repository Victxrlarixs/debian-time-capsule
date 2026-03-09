import { CONFIG } from '../config';
import type { VFSNode } from './types';

export class VFSTrashManager {
  constructor(
    private getNode: (path: string) => VFSNode | null,
    private mkdir: (path: string, name: string) => Promise<void>,
    private move: (oldPath: string, newPath: string) => Promise<void>
  ) {}

  /** Moves a file or folder to the trash. */
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
  }

  /** Restores a file or folder from the trash to the desktop. */
  async restoreFromTrash(name: string): Promise<void> {
    const trashItemPath = CONFIG.FS.TRASH + name;
    const restorePath = CONFIG.FS.DESKTOP + name;
    await this.move(trashItemPath, restorePath);
  }
}
