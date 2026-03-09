import type { IVFS, VFSNode, VFSFolder } from './vfs/types';
import { VFSPathResolver } from './vfs/vfs-path-resolver';
import { VFSNodeAccessor } from './vfs/vfs-node-accessor';
import { VFSFileOperations } from './vfs/vfs-file-operations';
import { VFSFolderOperations } from './vfs/vfs-folder-operations';
import { VFSTransferOperations } from './vfs/vfs-transfer-operations';
import { VFSTrashManager } from './vfs/vfs-trash-manager';
import { VFSSearch } from './vfs/vfs-search';
import { VFSEventDispatcher } from './vfs/vfs-event-dispatcher';
import { VFSInitializer } from './vfs/vfs-initializer';

export type { VFSNode, VFSFolder, VFSFile, VFSMetadata, IVFS } from './vfs/types';

declare global {
  interface Window {
    VirtualFS: IVFS;
  }
}

const fsMap: Record<string, VFSNode> = {};
let rootNode: VFSFolder | null = null;

const eventDispatcher = new VFSEventDispatcher();
const pathResolver = new VFSPathResolver();
const nodeAccessor = new VFSNodeAccessor(fsMap);
const fileOps = new VFSFileOperations(
  fsMap,
  nodeAccessor.getNode.bind(nodeAccessor),
  eventDispatcher.dispatchChange.bind(eventDispatcher)
);
const folderOps = new VFSFolderOperations(
  fsMap,
  nodeAccessor.getNode.bind(nodeAccessor),
  eventDispatcher.dispatchChange.bind(eventDispatcher)
);
const transferOps = new VFSTransferOperations(
  fsMap,
  nodeAccessor.getNode.bind(nodeAccessor),
  eventDispatcher.dispatchChange.bind(eventDispatcher)
);
const search = new VFSSearch(nodeAccessor.getChildren.bind(nodeAccessor));
const trashManager = new VFSTrashManager(
  nodeAccessor.getNode.bind(nodeAccessor),
  folderOps.mkdir.bind(folderOps),
  transferOps.move.bind(transferOps)
);
const initializer = new VFSInitializer(
  fsMap,
  (node: VFSFolder) => {
    rootNode = node;
  },
  folderOps.mkdir.bind(folderOps)
);

export const VFS: IVFS = {
  init: () => initializer.init(),
  resolvePath: (cwd: string, path: string) => pathResolver.resolvePath(cwd, path),
  getNode: (path: string) => nodeAccessor.getNode(path),
  getChildren: (path: string) => nodeAccessor.getChildren(path),
  exists: (path: string) => nodeAccessor.exists(path),
  getSize: (path: string) => nodeAccessor.getSize(path),
  touch: (path: string, name: string) => fileOps.touch(path, name),
  writeFile: (path: string, content: string) => fileOps.writeFile(path, content),
  rm: (path: string, name: string) => fileOps.rm(path, name),
  mkdir: (path: string, name: string) => folderOps.mkdir(path, name),
  rename: (path: string, oldName: string, newName: string) =>
    transferOps.rename(path, oldName, newName),
  move: (oldPath: string, newPath: string) => transferOps.move(oldPath, newPath),
  copy: (sourcePath: string, destPath: string) => transferOps.copy(sourcePath, destPath),
  moveToTrash: (path: string) => trashManager.moveToTrash(path),
  restoreFromTrash: (name: string) => trashManager.restoreFromTrash(name),
  search: (basePath: string, query: string, recursive?: boolean) =>
    search.search(basePath, query, recursive),
};

if (typeof window !== 'undefined') {
  window.VirtualFS = VFS;
}
