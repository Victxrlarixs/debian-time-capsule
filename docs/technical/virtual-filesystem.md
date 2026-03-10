# Virtual File System (VFS)

Technical documentation for the Virtual File System implementation in Debian Time Capsule.

## System Design

The VFS provides a Unix-like filesystem abstraction that runs entirely in memory with optional persistence to IndexedDB. It simulates a complete directory structure with files, folders, and metadata.

```
VFS (Main API)
├── VFSPathResolver      # Path normalization
├── VFSNodeAccessor      # Node retrieval
├── VFSFileOperations    # File CRUD
├── VFSFolderOperations  # Folder CRUD
├── VFSTransferOperations # Move/Copy/Rename
├── VFSTrashManager      # Trash/Restore
├── VFSSearch            # File search
├── VFSEventDispatcher   # Change events
└── VFSInitializer       # Bootstrap filesystem
```

## Core Concepts

### Node Types

The filesystem consists of two node types:

**VFSFile:**

```typescript
interface VFSFile {
  type: 'file';
  content: string;
  metadata?: VFSMetadata;
}
```

**VFSFolder:**

```typescript
interface VFSFolder {
  type: 'folder';
  children: Record<string, VFSNode>;
  metadata?: VFSMetadata;
}
```

**Metadata:**

```typescript
interface VFSMetadata {
  size: number; // Bytes
  mtime: string; // ISO timestamp
  owner: string; // Username
  permissions: string; // Unix-style (e.g., 'rwxr-xr-x')
}
```

### Storage Architecture

**In-Memory Map:**

```typescript
const fsMap: Record<string, VFSNode> = {};
```

- Key: Full path (e.g., `/home/victxrlarixs/Desktop/file.txt`)
- Value: VFSNode (file or folder)
- O(1) lookup performance
- Flat structure for fast access

**Path Format:**

- Absolute paths: `/home/victxrlarixs/file.txt`
- Folders end with `/`: `/home/victxrlarixs/Desktop/`
- Root: `/`

## Core Components

### VFSPathResolver

Resolves relative paths to absolute paths with Unix-style path handling.

**Features:**

- Tilde expansion: `~/file.txt` → `/home/victxrlarixs/file.txt`
- Relative paths: `../folder/file.txt`
- Current directory: `./file.txt`
- Parent directory: `..`

**Method:**

```typescript
resolvePath(cwd: string, path: string): string
```

**Examples:**

```typescript
resolvePath('/home/victxrlarixs/', '~/Desktop/file.txt');
// → '/home/victxrlarixs/Desktop/file.txt'

resolvePath('/home/victxrlarixs/Desktop/', '../Documents/file.txt');
// → '/home/victxrlarixs/Documents/file.txt'
```

### VFSNodeAccessor

Provides read-only access to filesystem nodes.

**Methods:**

```typescript
getNode(path: string): VFSNode | null
getChildren(path: string): Record<string, VFSNode> | null
exists(path: string): boolean
getSize(path: string): number
```

**Usage:**

```typescript
const node = VFS.getNode('/home/victxrlarixs/file.txt');
if (node?.type === 'file') {
  console.log(node.content);
}

const children = VFS.getChildren('/home/victxrlarixs/Desktop/');
// Returns: { 'file.txt': VFSFile, 'folder': VFSFolder, ... }
```

### VFSFileOperations

Handles file creation, modification, and deletion.

**Methods:**

```typescript
touch(path: string, name: string): Promise<void>
writeFile(path: string, content: string): Promise<void>
rm(path: string, name: string): Promise<boolean>
```

**File Creation:**

```typescript
await VFS.touch('/home/victxrlarixs/Desktop/', 'newfile.txt');
// Creates empty file with default metadata
```

**File Writing:**

```typescript
await VFS.writeFile('/home/victxrlarixs/Desktop/file.txt', 'Hello World');
// Updates content and metadata (size, mtime)
```

**File Deletion:**

```typescript
const deleted = await VFS.rm('/home/victxrlarixs/Desktop/', 'file.txt');
// Returns true if successful, moves to trash
```

### VFSFolderOperations

Handles folder creation and management.

**Methods:**

```typescript
mkdir(path: string, name: string): Promise<void>
```

**Folder Creation:**

```typescript
await VFS.mkdir('/home/victxrlarixs/Desktop/', 'NewFolder');
// Creates folder with empty children object
```

**Recursive Creation:**

- Parent folders must exist
- Use multiple `mkdir` calls for nested structures

### VFSTransferOperations

Handles move, copy, and rename operations.

**Methods:**

```typescript
move(oldPath: string, newPath: string): Promise<void>
copy(sourcePath: string, destPath: string): Promise<void>
rename(path: string, oldName: string, newName: string): Promise<void>
```

**Move:**

```typescript
await VFS.move('/home/victxrlarixs/Desktop/file.txt', '/home/victxrlarixs/Documents/file.txt');
// Moves file, updates fsMap keys
```

**Copy:**

```typescript
await VFS.copy('/home/victxrlarixs/Desktop/file.txt', '/home/victxrlarixs/Documents/file.txt');
// Deep copy for folders (recursive)
```

**Rename:**

```typescript
await VFS.rename('/home/victxrlarixs/Desktop/', 'oldname.txt', 'newname.txt');
// Renames file/folder in place
```

### VFSTrashManager

Implements trash/recycle bin functionality.

**Trash Location:** `/home/victxrlarixs/.Trash/`

**Methods:**

```typescript
moveToTrash(path: string): Promise<void>
restoreFromTrash(name: string): Promise<void>
```

**Move to Trash:**

```typescript
await VFS.moveToTrash('/home/victxrlarixs/Desktop/file.txt');
// Moves to /home/victxrlarixs/.Trash/file.txt
```

**Restore:**

```typescript
await VFS.restoreFromTrash('file.txt');
// Moves back to /home/victxrlarixs/Desktop/file.txt
```

**Trash Behavior:**

- Files are moved, not deleted
- Original location is not tracked (always restores to Desktop)
- Empty trash deletes all files permanently

### VFSSearch

Provides file and folder search functionality.

**Method:**

```typescript
search(basePath: string, query: string, recursive?: boolean): Promise<string[]>
```

**Search Features:**

- Case-insensitive matching
- Searches file and folder names
- Optional recursive search
- Returns array of full paths

**Usage:**

```typescript
const results = await VFS.search('/home/victxrlarixs/', 'document', true);
// Returns: ['/home/victxrlarixs/Documents/', '/home/victxrlarixs/Desktop/document.txt']
```

### VFSEventDispatcher

Dispatches filesystem change events.

**Events:**

- `cde-fs-change` - Custom DOM event
- Includes path and action in detail

**Usage:**

```typescript
window.addEventListener('cde-fs-change', (e: CustomEvent) => {
  console.log('Filesystem changed:', e.detail.path, e.detail.action);
});
```

**Integration with EventBus:**

```typescript
// VFS emits SystemEvent via EventBus
SystemEvent.FILE_CREATED;
SystemEvent.FILE_SAVED;
SystemEvent.FILE_DELETED;
SystemEvent.FILE_RENAMED;
SystemEvent.FILE_MOVED;
SystemEvent.FILE_COPIED;
SystemEvent.FOLDER_CREATED;
```

### VFSInitializer

Bootstraps the filesystem with initial structure and content.

**Initialization Process:**

1. Create root folder structure
2. Flatten tree into fsMap (recursive)
3. Add default metadata to all nodes
4. Create trash folder if missing
5. Sync dynamic content (docs, settings)

**Root Structure:**

```
/
├── bin/
├── etc/
│   ├── hostname
│   ├── motd
│   ├── os-release
│   └── passwd
├── usr/
│   ├── bin/
│   ├── lib/
│   └── src/
│       └── debian-cde/
├── var/
├── tmp/
└── home/
    └── victxrlarixs/
        ├── Desktop/
        ├── Documents/
        ├── Downloads/
        ├── Pictures/
        ├── settings/
        └── .Trash/
```

**Dynamic Content Sync:**

- Loads markdown docs from `/docs/user-guide/`
- Loads JSON data files (fonts, palettes, backdrops, etc.)
- Updates file content in fsMap
- Runs asynchronously after initial structure

## API Reference

### Main VFS Interface

```typescript
interface IVFS {
  // Initialization
  init(): void;

  // Path operations
  resolvePath(cwd: string, path: string): string;

  // Read operations
  getNode(path: string): VFSNode | null;
  getChildren(path: string): Record<string, VFSNode> | null;
  exists(path: string): boolean;
  getSize(path: string): number;

  // File operations
  touch(path: string, name: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
  rm(path: string, name: string): Promise<boolean>;

  // Folder operations
  mkdir(path: string, name: string): Promise<void>;

  // Transfer operations
  rename(path: string, oldName: string, newName: string): Promise<void>;
  move(oldPath: string, newPath: string): Promise<void>;
  copy(sourcePath: string, destPath: string): Promise<void>;

  // Trash operations
  moveToTrash(path: string): Promise<void>;
  restoreFromTrash(name: string): Promise<void>;

  // Search
  search(basePath: string, query: string, recursive?: boolean): Promise<string[]>;
}
```

## Usage Examples

### Creating Files and Folders

```typescript
// Create folder
await VFS.mkdir('/home/victxrlarixs/Desktop/', 'MyFolder');

// Create file
await VFS.touch('/home/victxrlarixs/Desktop/MyFolder/', 'file.txt');

// Write content
await VFS.writeFile('/home/victxrlarixs/Desktop/MyFolder/file.txt', 'Hello World');
```

### Reading Files

```typescript
const node = VFS.getNode('/home/victxrlarixs/Desktop/file.txt');
if (node?.type === 'file') {
  console.log('Content:', node.content);
  console.log('Size:', node.metadata?.size);
  console.log('Modified:', node.metadata?.mtime);
}
```

### Listing Directory Contents

```typescript
const children = VFS.getChildren('/home/victxrlarixs/Desktop/');
if (children) {
  Object.entries(children).forEach(([name, node]) => {
    console.log(`${name} (${node.type})`);
  });
}
```

### Moving and Copying

```typescript
// Move file
await VFS.move('/home/victxrlarixs/Desktop/file.txt', '/home/victxrlarixs/Documents/file.txt');

// Copy folder (recursive)
await VFS.copy('/home/victxrlarixs/Desktop/MyFolder/', '/home/victxrlarixs/Documents/MyFolder/');
```

### Trash Operations

```typescript
// Delete to trash
await VFS.moveToTrash('/home/victxrlarixs/Desktop/file.txt');

// List trash contents
const trash = VFS.getChildren('/home/victxrlarixs/.Trash/');

// Restore file
await VFS.restoreFromTrash('file.txt');
```

## Persistence

### IndexedDB Integration

VFS integrates with the storage system for persistence:

**Storage Flow:**

1. VFS operations modify in-memory fsMap
2. Changes trigger `cde-fs-change` event
3. Storage adapter listens and persists to IndexedDB
4. On page load, IndexedDB data restores fsMap

**Storage Key:** `cde_filesystem`

**Data Format:** Serialized fsMap object

### Session vs Persistent

- **Session:** Window positions, temporary state
- **Persistent:** Filesystem structure and content

## Performance Considerations

### O(1) Lookups

Using a flat Map with full paths as keys provides constant-time access:

```typescript
// Fast lookup
const node = fsMap['/home/victxrlarixs/Desktop/file.txt'];
```

### Memory Usage

- All files stored in memory as strings
- Large files impact memory
- Consider lazy loading for large content

### Event Throttling

Filesystem change events are debounced to prevent excessive updates:

```typescript
// Desktop icons sync with 50ms debounce
let syncTimeout: number | null = null;
window.addEventListener('cde-fs-change', (e) => {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => syncIcons(), 50);
});
```

## Configuration

Key configuration values from `CONFIG`:

```typescript
FS: {
  HOME: '/home/victxrlarixs/',
  DESKTOP: '/home/victxrlarixs/Desktop/',
  TRASH: '/home/victxrlarixs/.Trash/',
}
```

## Further Reading

- [Architecture Overview](./architecture.md)
- [Storage & Cache](./storage.md)
- [Event Bus](./event-bus.md)
- [System Events](./system-events.md)
