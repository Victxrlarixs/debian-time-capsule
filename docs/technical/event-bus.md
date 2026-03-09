# Event Bus System

Technical documentation for the event-driven architecture in Debian Time Capsule.

## Overview

The Event Bus implements a publish-subscribe pattern for decoupled component communication. Features communicate through events rather than direct dependencies.

## Architecture

```
┌─────────────────────────────────────────────┐
│           Event Bus (Singleton)              │
├─────────────────────────────────────────────┤
│  Publishers          │      Subscribers      │
│  • VFS              │      • FileManager    │
│  • WindowManager    │      • Emacs          │
│  • FileManager      │      • Desktop        │
│  • ErrorHandler     │      • Analytics      │
└─────────────────────────────────────────────┘
```

## Implementation

### Core API

```typescript
class EventBus {
  private listeners: Map<string, Set<Function>>;

  // Subscribe to event
  on<T = any>(event: string, callback: (data: T) => void | Promise<void>): () => void;

  // Emit event asynchronously
  async emit<T = any>(event: string, data?: T): Promise<void>;

  // Emit event synchronously
  emitSync<T = any>(event: string, data?: T): void;

  // Unsubscribe from event
  off(event: string, callback: Function): void;
}
```

### Event Flow

```
Publisher                EventBus               Subscriber
    │                        │                        │
    │ emit(FILE_OPENED)      │                        │
    ├───────────────────────▶│                        │
    │                        │ notify subscribers     │
    │                        ├───────────────────────▶│
    │                        │                        │
    │                        │                   handleFileOpened()
    │                        │                        │
    │                        │◀───────────────────────┤
    │                        │                        │
```

## System Events

### File Operations

```typescript
enum SystemEvent {
  FILE_SELECTED = 'file:selected',
  FILE_OPENED = 'file:opened',
  FILE_CREATED = 'file:created',
  FILE_SAVED = 'file:saved',
  FILE_DELETED = 'file:deleted',
  FILE_RENAMED = 'file:renamed',
  FILE_MOVED = 'file:moved',
  FILE_COPIED = 'file:copied',
}
```

### Folder Operations

```typescript
enum SystemEvent {
  FOLDER_CREATED = 'folder:created',
  FOLDER_OPENED = 'folder:opened',
  FOLDER_DELETED = 'folder:deleted',
}
```

### Window Management

```typescript
enum SystemEvent {
  WINDOW_OPENED = 'window:opened',
  WINDOW_CLOSED = 'window:closed',
  WINDOW_FOCUSED = 'window:focused',
  WINDOW_MINIMIZED = 'window:minimized',
  WINDOW_MAXIMIZED = 'window:maximized',
  WINDOW_RESTORED = 'window:restored',
}
```

### Workspace Management

```typescript
enum SystemEvent {
  WORKSPACE_CHANGED = 'workspace:changed',
  WORKSPACE_SWITCHED = 'workspace:switched',
}
```

### Theme Management

```typescript
enum SystemEvent {
  THEME_CHANGED = 'theme:changed',
  BACKDROP_CHANGED = 'backdrop:changed',
  FONT_CHANGED = 'font:changed',
}
```

### Settings Management

```typescript
enum SystemEvent {
  SETTINGS_LOADED = 'settings:loaded',
  SETTINGS_SAVED = 'settings:saved',
  SETTINGS_CHANGED = 'settings:changed',
}
```

### Application Lifecycle

```typescript
enum SystemEvent {
  APP_LAUNCHED = 'app:launched',
  APP_CLOSED = 'app:closed',
  PROCESS_STARTED = 'process:started',
  PROCESS_ENDED = 'process:ended',
}
```

### Error Handling

```typescript
enum SystemEvent {
  ERROR_OCCURRED = 'error:occurred',
}
```

## Event Data Types

```typescript
interface FileEventData {
  path: string;
  name?: string;
  content?: string;
}

interface WindowEventData {
  id: string;
  title?: string;
}

interface WorkspaceEventData {
  from?: string;
  to: string;
}

interface ThemeEventData {
  palette: string;
}

interface SettingsEventData {
  key: string;
  value: any;
}
```

## Usage

### Publishing Events

```typescript
import { container } from '../core/container';
import { SystemEvent } from '../core/system-events';
import type { EventBus } from '../core/event-bus';

class FileManager {
  private eventBus: EventBus;

  constructor() {
    this.eventBus = container.get<EventBus>('eventBus');
  }

  async openFile(path: string): Promise<void> {
    const node = this.getNode(path);

    // Emit async event
    await this.eventBus.emit(SystemEvent.FILE_OPENED, {
      path,
      name: node.name,
      content: node.content,
    });

    // Or emit sync event
    this.eventBus.emitSync(SystemEvent.FILE_OPENED, { path });
  }
}
```

### Subscribing to Events

```typescript
import { container } from '../core/container';
import { SystemEvent } from '../core/system-events';
import type { EventBus } from '../core/event-bus';
import type { FileEventData } from '../core/system-events';

class Emacs {
  private eventBus: EventBus;
  private unsubscribe: (() => void)[] = [];

  constructor() {
    this.eventBus = container.get<EventBus>('eventBus');
    this.subscribeToEvents();
  }

  private subscribeToEvents(): void {
    const unsub = this.eventBus.on<FileEventData>(
      SystemEvent.FILE_OPENED,
      this.handleFileOpened
    );
    this.unsubscribe.push(unsub);
  }

  private handleFileOpened = async (data: FileEventData): Promise<void> => {
    if (data.content !== undefined) {
      await this.open(data.name!, data.content);
    }
  };

  destroy(): void {
    this.unsubscribe.forEach((fn) => fn());
  }
}
```

## Integration

### Container Registration

```typescript
// container.init.ts
import { EventBus } from './event-bus';

const eventBus = new EventBus();
container.registerInstance('eventBus', eventBus);
```

### VFS Integration

```typescript
// vfs.ts
const getEventBus = (): EventBus | null => {
  try {
    return container.has('eventBus') ? container.get<EventBus>('eventBus') : null;
  } catch {
    return null;
  }
};

async touch(path: string, name: string): Promise<void> {
  // Create file
  this.fsMap.set(fullPath, node);

  // Emit event
  const eventBus = getEventBus();
  if (eventBus) {
    await eventBus.emit(SystemEvent.FILE_CREATED, { path: fullPath, name });
  }
}
```

### WindowManager Integration

```typescript
// windowmanager.ts
focusWindow(id: string): void {
  const window = this.windows.get(id);
  window.zIndex = this.getNextZIndex();

  const eventBus = getEventBus();
  if (eventBus) {
    eventBus.emitSync(SystemEvent.WINDOW_FOCUSED, { id });
  }
}
```

## Best Practices

### 1. Type Safety

```typescript
// Good: Type-safe event data
this.eventBus.on<FileEventData>(SystemEvent.FILE_OPENED, (data) => {
  console.log(data.path); // TypeScript knows about 'path'
});

// Bad: No type safety
this.eventBus.on(SystemEvent.FILE_OPENED, (data: any) => {
  console.log(data.path); // No type checking
});
```

### 2. Cleanup Subscriptions

```typescript
class MyFeature {
  private unsubscribe: (() => void)[] = [];

  constructor() {
    const unsub = eventBus.on(SystemEvent.FILE_OPENED, this.handler);
    this.unsubscribe.push(unsub);
  }

  destroy(): void {
    this.unsubscribe.forEach((fn) => fn());
    this.unsubscribe = [];
  }
}
```

### 3. Async vs Sync

```typescript
// Use emitSync for UI updates (no await needed)
this.eventBus.emitSync(SystemEvent.WINDOW_FOCUSED, { id });

// Use emit for async operations
await this.eventBus.emit(SystemEvent.FILE_SAVED, { path, content });
```

### 4. Avoid Circular Dependencies

```typescript
// Good: One-way event flow
FileManager → FILE_OPENED → Emacs
Emacs → FILE_SAVED → FileManager

// Bad: Circular event flow (infinite loop)
FeatureA → EVENT_X → FeatureB → EVENT_Y → FeatureA
```

## Current Integrations

### VFS Events

```typescript
VFS.touch()      → FILE_CREATED
VFS.writeFile()  → FILE_SAVED
VFS.rm()         → FILE_DELETED
VFS.mkdir()      → FOLDER_CREATED
VFS.rename()     → FILE_RENAMED
VFS.move()       → FILE_MOVED
VFS.copy()       → FILE_COPIED
```

### WindowManager Events

```typescript
focusWindow()    → WINDOW_FOCUSED
minimizeWindow() → WINDOW_MINIMIZED
maximizeWindow() → WINDOW_MAXIMIZED
```

### Feature Subscriptions

```typescript
Emacs        → listens to FILE_OPENED
FileManager  → listens to FOLDER_OPENED
Desktop      → emits FILE_OPENED, FOLDER_OPENED
```

## Benefits

1. **Loose Coupling**: Features don't depend on each other directly
2. **Testability**: Easy to mock events in unit tests
3. **Extensibility**: New features can subscribe to existing events
4. **Maintainability**: Changes to one feature don't affect others
5. **Debugging**: Central place to log all system events

## Further Reading

- [Error Handling](error-handling.md)
- [Architecture Overview](architecture.md)
