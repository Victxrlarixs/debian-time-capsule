// src/scripts/core/adapters/vfs.adapter.ts

import { VFS } from '../vfs';
import type {
  IFileReader,
  IFileWriter,
  IFileOperations,
  ITrashManager,
  IFileSearch,
  IPathResolver,
} from '../interfaces/filesystem.interface';
import type { VFSNode } from '../vfs';

/**
 * Adapter for VFS implementing segregated filesystem interfaces
 * Wraps the existing VFS implementation
 */
export class VFSAdapter
  implements IFileReader, IFileWriter, IFileOperations, ITrashManager, IFileSearch, IPathResolver
{
  // IFileReader
  getNode(path: string): VFSNode | null {
    return VFS.getNode(path);
  }

  getChildren(path: string): Record<string, VFSNode> | null {
    return VFS.getChildren(path);
  }

  exists(path: string): boolean {
    return VFS.exists(path);
  }

  getSize(path: string): number {
    return VFS.getSize(path);
  }

  // IFileWriter
  async touch(path: string, name: string): Promise<void> {
    await VFS.touch(path, name);
  }

  async mkdir(path: string, name: string): Promise<void> {
    await VFS.mkdir(path, name);
  }

  async writeFile(path: string, content: string): Promise<void> {
    await VFS.writeFile(path, content);
  }

  // IFileOperations
  async rm(path: string, name: string): Promise<boolean> {
    return await VFS.rm(path, name);
  }

  async rename(path: string, oldName: string, newName: string): Promise<void> {
    await VFS.rename(path, oldName, newName);
  }

  async move(oldPath: string, newPath: string): Promise<void> {
    await VFS.move(oldPath, newPath);
  }

  async copy(sourcePath: string, destPath: string): Promise<void> {
    await VFS.copy(sourcePath, destPath);
  }

  // ITrashManager
  async moveToTrash(path: string): Promise<void> {
    await VFS.moveToTrash(path);
  }

  async restoreFromTrash(name: string): Promise<void> {
    await VFS.restoreFromTrash(name);
  }

  // IFileSearch
  async search(basePath: string, query: string, recursive?: boolean): Promise<string[]> {
    return await VFS.search(basePath, query, recursive);
  }

  // IPathResolver
  resolvePath(cwd: string, path: string): string {
    return VFS.resolvePath(cwd, path);
  }
}
