// src/scripts/core/interfaces/filesystem.interface.ts

import type { VFSNode } from '../vfs';

/**
 * Interface for read-only file system operations
 * Use this when components only need to read files
 */
export interface IFileReader {
  /**
   * Get a file or folder node by path
   * @param path - Absolute path
   * @returns VFSNode or null if not found
   */
  getNode(path: string): VFSNode | null;

  /**
   * Get children of a folder
   * @param path - Folder path
   * @returns Record of children or null if not a folder
   */
  getChildren(path: string): Record<string, VFSNode> | null;

  /**
   * Check if a path exists
   * @param path - Path to check
   * @returns True if exists
   */
  exists(path: string): boolean;

  /**
   * Get size of a file or folder (recursive)
   * @param path - Path to measure
   * @returns Size in bytes
   */
  getSize(path: string): number;
}

/**
 * Interface for write file system operations
 * Use this when components need to create or modify files
 */
export interface IFileWriter {
  /**
   * Create a new file
   * @param path - Parent folder path
   * @param name - File name
   */
  touch(path: string, name: string): Promise<void>;

  /**
   * Create a new folder
   * @param path - Parent folder path
   * @param name - Folder name
   */
  mkdir(path: string, name: string): Promise<void>;

  /**
   * Write content to a file
   * @param path - File path
   * @param content - File content
   */
  writeFile(path: string, content: string): Promise<void>;
}

/**
 * Interface for file system operations (move, copy, delete)
 * Use this when components need to manipulate files
 */
export interface IFileOperations {
  /**
   * Delete a file or folder
   * @param path - Parent folder path
   * @param name - Item name
   * @returns True if deleted
   */
  rm(path: string, name: string): Promise<boolean>;

  /**
   * Rename a file or folder
   * @param path - Parent folder path
   * @param oldName - Current name
   * @param newName - New name
   */
  rename(path: string, oldName: string, newName: string): Promise<void>;

  /**
   * Move a file or folder
   * @param oldPath - Current path
   * @param newPath - Destination path
   */
  move(oldPath: string, newPath: string): Promise<void>;

  /**
   * Copy a file or folder
   * @param sourcePath - Source path
   * @param destPath - Destination path
   */
  copy(sourcePath: string, destPath: string): Promise<void>;
}

/**
 * Interface for trash management
 * Use this when components need to work with the trash
 */
export interface ITrashManager {
  /**
   * Move a file or folder to trash
   * @param path - Path to move to trash
   */
  moveToTrash(path: string): Promise<void>;

  /**
   * Restore a file or folder from trash
   * @param name - Item name in trash
   */
  restoreFromTrash(name: string): Promise<void>;
}

/**
 * Interface for file search operations
 * Use this when components need to search files
 */
export interface IFileSearch {
  /**
   * Search for files matching a query
   * @param basePath - Base path to search from
   * @param query - Search query
   * @param recursive - Whether to search recursively
   * @returns Array of matching paths
   */
  search(basePath: string, query: string, recursive?: boolean): Promise<string[]>;
}

/**
 * Interface for path resolution
 * Use this when components need to resolve paths
 */
export interface IPathResolver {
  /**
   * Resolve a relative path to an absolute path
   * @param cwd - Current working directory
   * @param path - Relative or absolute path
   * @returns Absolute path
   */
  resolvePath(cwd: string, path: string): string;
}
