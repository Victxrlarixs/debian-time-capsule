import type { VFS as VFSType } from '../../core/vfs';
import { CDEModal } from '../../ui/modals';
import { CONFIG } from '../../core/config';

/**
 * Handles file system operations (CRUD, trash management).
 */
export class FileOperations {
  constructor(private vfs: typeof VFSType) {}

  public async createFile(path: string, name: string): Promise<void> {
    await this.vfs.touch(path, name);
    if (window.AudioManager) window.AudioManager.success();
  }

  public async createFolder(path: string, name: string): Promise<void> {
    await this.vfs.mkdir(path, name);
    if (window.AudioManager) window.AudioManager.success();
  }

  public async deleteFile(path: string, name: string): Promise<boolean> {
    const isTrash = path.includes('/.trash/');
    const msg = isTrash ? `Permanently delete ${name}?` : `Move ${name} to Trash?`;
    const confirmed = await CDEModal.confirm(msg);

    if (confirmed) {
      if (isTrash) {
        await this.vfs.rm(path, name);
      } else {
        await this.vfs.moveToTrash(path + name + (this.vfs.getNode(path + name + '/') ? '/' : ''));
      }
      if (window.AudioManager) window.AudioManager.success();
      return true;
    }
    return false;
  }

  public async renameFile(path: string, oldName: string, newName: string): Promise<void> {
    await this.vfs.rename(path, oldName, newName);
    if (window.AudioManager) window.AudioManager.success();
  }

  public async moveToTrash(fullPath: string): Promise<void> {
    await this.vfs.moveToTrash(fullPath);
    if (window.AudioManager) window.AudioManager.success();
  }

  public async copyFile(sourcePath: string, destPath: string): Promise<void> {
    await this.vfs.copy(sourcePath, destPath);
    if (window.AudioManager) window.AudioManager.success();
  }

  public async moveFile(sourcePath: string, destPath: string): Promise<void> {
    await this.vfs.move(sourcePath, destPath);
    if (window.AudioManager) window.AudioManager.success();
  }

  public async emptyTrash(): Promise<void> {
    const confirmed = await CDEModal.confirm('Permanently delete all items in Trash?');
    if (confirmed) {
      const trashPath = CONFIG.FS.HOME + '.trash/';
      const trash = this.vfs.getChildren(trashPath);
      if (trash) {
        for (const name of Object.keys(trash)) {
          await this.vfs.rm(trashPath, name);
        }
      }
      if (window.AudioManager) window.AudioManager.success();
    }
  }

  public async restoreFromTrash(name: string): Promise<void> {
    await this.vfs.restoreFromTrash(name);
    if (window.AudioManager) window.AudioManager.success();
  }
}
