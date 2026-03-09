export interface VFSMetadata {
  size: number;
  mtime: string;
  owner: string;
  permissions: string;
}

export interface VFSFile {
  type: 'file';
  content: string;
  metadata?: VFSMetadata;
}

export interface VFSFolder {
  type: 'folder';
  children: Record<string, VFSNode>;
  metadata?: VFSMetadata;
}

export type VFSNode = VFSFile | VFSFolder;

export interface IVFS {
  init(): void;
  resolvePath(cwd: string, path: string): string;
  getNode(path: string): VFSNode | null;
  getChildren(path: string): Record<string, VFSNode> | null;
  touch(path: string, name: string): Promise<void>;
  mkdir(path: string, name: string): Promise<void>;
  rm(path: string, name: string): Promise<boolean>;
  rename(path: string, oldName: string, newName: string): Promise<void>;
  move(oldPath: string, newPath: string): Promise<void>;
  copy(sourcePath: string, destPath: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  moveToTrash(path: string): Promise<void>;
  restoreFromTrash(name: string): Promise<void>;
  search(basePath: string, query: string, recursive?: boolean): Promise<string[]>;
  getSize(path: string): number;
  exists(path: string): boolean;
}
