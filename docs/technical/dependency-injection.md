# Dependency Injection Architecture

Technical overview of the Dependency Injection system implemented in Debian Time Capsule.

## System Design

The Dependency Injection architecture addresses legacy coupling issues by introducing interface-based abstractions and a centralized service container. This enables testability, flexibility, and adherence to SOLID principles.

## Core Components

### Directory Structure

```
src/scripts/core/
├── interfaces/              # Segregated interfaces (ISP)
│   ├── window-manager.interface.ts
│   ├── settings-manager.interface.ts
│   ├── filesystem.interface.ts
│   ├── audio-manager.interface.ts
│   └── index.ts
├── adapters/               # Legacy code adapters
│   ├── vfs.adapter.ts
│   ├── audiomanager.adapter.ts
│   ├── settingsmanager.adapter.ts
│   └── index.ts
├── container.ts            # DI Container
├── container.init.ts       # Initialization
├── cde-namespace.ts        # Consolidated namespace
└── README.md
```

### Service Container

The ServiceContainer manages service registration and resolution:

```typescript
class ServiceContainer {
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();
  private singletons = new Set<string>();

  register<T>(key: string, factory: () => T, singleton: boolean = true): void;
  registerInstance<T>(key: string, instance: T): void;
  get<T>(key: string): T;
  has(key: string): boolean;
  clear(): void;
}
```

### Interface Segregation

Monolithic interfaces have been split following the Interface Segregation Principle.

**Filesystem Interfaces:**

```typescript
interface IFileReader {
  getNode(path: string): VFSNode | null;
  getChildren(path: string): Record<string, VFSNode> | null;
  exists(path: string): boolean;
  getSize(path: string): number;
}

interface IFileWriter {
  touch(path: string, name: string): Promise<void>;
  mkdir(path: string, name: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
}

interface IFileOperations {
  rm(path: string, name: string): Promise<boolean>;
  rename(path: string, oldName: string, newName: string): Promise<void>;
  move(oldPath: string, newPath: string): Promise<void>;
  copy(sourcePath: string, destPath: string): Promise<void>;
}

interface ITrashManager {
  moveToTrash(path: string): Promise<void>;
  restoreFromTrash(name: string): Promise<void>;
}

interface IFileSearch {
  search(basePath: string, query: string, recursive?: boolean): Promise<string[]>;
}
```

**Audio Interfaces:**

```typescript
interface IBasicAudio {
  beep(frequency?: number, duration?: number): void;
  click(): void;
}

interface ISystemSounds {
  error(): void;
  success(): void;
  notification(): void;
}

interface IWindowSounds {
  windowOpen(): void;
  windowClose(): void;
  windowMinimize(): void;
  windowMaximize(): void;
  windowShade(): void;
}

interface IMenuSounds {
  menuOpen(): void;
  menuClose(): void;
}

interface IMusicPlayer {
  playMelody(notes: Note[]): Promise<void>;
  playStartupChime(): void;
  playThemeMelody(): void;
}
```

### Adapters

Adapters wrap legacy implementations to conform to new interfaces:

```typescript
class VFSAdapter implements IFileReader, IFileWriter, IFileOperations, ITrashManager, IFileSearch {
  getNode(path: string): VFSNode | null {
    return VFS.getNode(path);
  }
  // Delegates to legacy VFS
}
```

### Consolidated Namespace

```typescript
window.CDE = {
  core: {
    fs: IFileSystem,
    audio: IAudioManager,
    settings: ISettingsManager
  },
  ui: {
    modal: CDEModal
  },
  apps: {
    fileManager: () => void,
    emacs: () => void,
  }
}
```

## Usage

### Accessing Services

```typescript
import { container } from '@/scripts/core/container';
import type { IFileReader } from '@/scripts/core/interfaces';

// Get service with specific type
const fs = container.get<IFileReader>('fileReader');
const node = fs.getNode('/home/user/file.txt');
```

### Global Namespace

```typescript
// Access from anywhere
const node = window.CDE.core.fs.getNode('/home/user/file.txt');
window.CDE.core.audio.beep();
window.CDE.ui.modal.open('Info', 'Hello World');
```

### Available Services

| Key              | Type                                | Description                   |
| ---------------- | ----------------------------------- | ----------------------------- |
| `fs`             | `IFileReader & IFileWriter & ...`   | Complete filesystem           |
| `fileReader`     | `IFileReader`                       | Read-only operations          |
| `fileWriter`     | `IFileWriter`                       | Write operations              |
| `fileOperations` | `IFileOperations`                   | Move, copy, delete operations |
| `trashManager`   | `ITrashManager`                     | Trash management              |
| `fileSearch`     | `IFileSearch`                       | File search                   |
| `audio`          | `IBasicAudio & ISystemSounds & ...` | Complete audio system         |
| `basicAudio`     | `IBasicAudio`                       | Basic sounds                  |
| `systemSounds`   | `ISystemSounds`                     | System sounds                 |
| `windowSounds`   | `IWindowSounds`                     | Window sounds                 |
| `settings`       | `ISettingsManager`                  | Configuration                 |
| `sessionStorage` | `ISessionStorage`                   | Session management            |

## Migration Guide

### Before

```typescript
import { VFS } from '@/scripts/core/vfs';
import { AudioManager } from '@/scripts/core/audiomanager';

class MyComponent {
  render() {
    const node = VFS.getNode('/path');
    AudioManager.beep();
  }
}
```

### After

```typescript
import { container } from '@/scripts/core/container';
import type { IFileReader, IBasicAudio } from '@/scripts/core/interfaces';

class MyComponent {
  private fs: IFileReader;
  private audio: IBasicAudio;

  constructor() {
    this.fs = container.get<IFileReader>('fileReader');
    this.audio = container.get<IBasicAudio>('basicAudio');
  }

  render() {
    const node = this.fs.getNode('/path');
    this.audio.beep();
  }
}
```

### Testing with Mocks

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { container } from '@/scripts/core/container';
import type { IFileReader } from '@/scripts/core/interfaces';

class MockFileReader implements IFileReader {
  getNode(path: string) {
    return { type: 'file', content: 'mock' };
  }
  getChildren() {
    return {};
  }
  exists() {
    return true;
  }
  getSize() {
    return 100;
  }
}

describe('MyComponent', () => {
  beforeEach(() => {
    container.registerInstance('fileReader', new MockFileReader());
  });

  it('should render', () => {
    const component = new MyComponent();
    component.render();
  });
});
```

## Backward Compatibility

Legacy APIs remain available for compatibility:

```typescript
// Legacy (deprecated)
window.VirtualFS.getNode('/path');
window.AudioManager.beep();

// New (recommended)
window.CDE.core.fs.getNode('/path');
window.CDE.core.audio.beep();
```

Legacy APIs will be removed in future versions.

## Further Reading

- [Architecture Overview](./architecture.md)
- [Error Handling](./error-handling.md)
- [Event Bus](./event-bus.md)
