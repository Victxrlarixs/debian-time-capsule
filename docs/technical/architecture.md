# Architecture Overview

Technical overview of Debian Time Capsule's system architecture.

## System Design

Debian Time Capsule follows a modular, event-driven architecture built on Astro's islands pattern.

```
┌─────────────────────────────────────────────┐
│           Astro Static Shell                │
├─────────────────────────────────────────────┤
│  Desktop UI (Static HTML/CSS)               │
├──────────────┬──────────────────────────────┤
│ Core Systems │  Feature Islands             │
│              │                              │
│ • VFS        │  • XEmacs                    │
│ • WindowMgr  │  • Terminal Lab              │
│ • Settings   │  • File Manager              │
│ • Events     │  • Netscape                  │
│              │  • Style Manager             │
├──────────────┴──────────────────────────────┤
│         Utilities & Workers                  │
│  • Storage  • Lazy Loader  • Virtual Scroll │
│  • XPM Worker  • VFS Worker                 │
└─────────────────────────────────────────────┘
```

## Core Principles

### 1. Islands Architecture

Each application is an independent island that hydrates on demand:

```typescript
// Static shell (no JS)
<Desktop />
<FrontPanel />

// Interactive islands (hydrate on interaction)
<XEmacs client:visible />
<Terminal client:idle />
<FileManager client:load />
```

### 2. Event-Driven Communication

Components communicate through a central event bus:

```typescript
// Publish event
eventBus.emit('window:opened', { id: 'emacs-1' });

// Subscribe to event
eventBus.on('window:opened', (data) => {
  windowManager.register(data.id);
});
```

### 3. Lazy Loading

Features load on-demand to minimize initial bundle:

```typescript
// Register feature
lazyLoader.register('emacs', () => import('./features/emacs'));

// Load when needed
const emacs = await lazyLoader.load('emacs');
```

### 4. Progressive Enhancement

Core functionality works without JavaScript, enhanced features require it.

## Core Systems

### Virtual File System (VFS)

Manages file and directory operations in memory.

**Key Features:**

- O(1) path resolution using Map
- Unix-like path handling
- CRUD operations
- Event notifications

**Implementation:**

```typescript
class VirtualFileSystem {
  private fsMap: Map<string, FSNode>;

  resolvePath(path: string): FSNode | null {
    return this.fsMap.get(this.normalizePath(path));
  }

  createFile(path: string, content: string): boolean {
    const node = { type: 'file', content, ...metadata };
    this.fsMap.set(path, node);
    this.emit('file:created', { path });
    return true;
  }
}
```

See the [Virtual File System (VFS)](#virtual-file-system-vfs) section above for details.

### Window Manager

Handles window lifecycle, positioning, and z-index management.

**Responsibilities:**

- Window creation/destruction
- Position and size management
- Z-index ordering
- Focus management
- Workspace assignment

**Implementation:**

```typescript
class WindowManager {
  private windows: Map<string, Window>;
  private zIndexCounter: number = 1000;

  createWindow(config: WindowConfig): Window {
    const window = new Window({
      ...config,
      zIndex: this.zIndexCounter++,
    });

    this.windows.set(window.id, window);
    this.emit('window:created', window);
    return window;
  }

  bringToFront(id: string): void {
    const window = this.windows.get(id);
    window.zIndex = this.zIndexCounter++;
    this.emit('window:focused', window);
  }
}
```

See the [Window Manager](#window-manager) section above for details.

### Settings Manager

Manages user preferences and configuration.

**Storage Hierarchy:**

1. Memory cache (runtime)
2. IndexedDB (persistent)
3. localStorage (fallback)

**Implementation:**

```typescript
class SettingsManager {
  async get(key: string): Promise<any> {
    // Check memory cache
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Load from storage
    const value = await storageAdapter.get(key);
    this.cache.set(key, value);
    return value;
  }

  async set(key: string, value: any): Promise<void> {
    this.cache.set(key, value);
    await storageAdapter.set(key, value);
    this.emit('setting:changed', { key, value });
  }
}
```

### Event Bus

Central pub/sub system for component communication.

**Features:**

- Type-safe events
- Wildcard subscriptions
- Once listeners
- Event namespacing

**Implementation:**

```typescript
class EventBus {
  private listeners: Map<string, Set<Function>>;

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }
}
```

## Feature Islands

### XEmacs

Text editor with Emacs keybindings.

**Components:**

- Editor core (CodeMirror-like)
- Minibuffer
- Keybinding handler
- File operations

**Lazy Loading:**

```typescript
lazyLoader.register('emacs', () => import('./features/emacs'));
```

### Terminal Lab

Interactive terminal with lessons.

**Components:**

- Terminal emulator
- Lesson system
- Command parser
- Progress tracker

### File Manager

File browsing and management.

**Components:**

- Tree view
- List view
- Icon view
- Context menus
- Virtual scrolling

### Style Manager

Theme customization interface.

**Components:**

- Palette selector
- Backdrop browser
- Font settings
- Preview system

## Utilities

### Lazy Loader

Dynamic import system with caching.

```typescript
class LazyLoader {
  private modules: Map<string, () => Promise<any>>;
  private cache: Map<string, any>;

  register(name: string, loader: () => Promise<any>): void {
    this.modules.set(name, loader);
  }

  async load(name: string): Promise<any> {
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }

    const loader = this.modules.get(name);
    const module = await loader();
    this.cache.set(name, module);
    return module;
  }
}
```

### Storage Adapter

Unified storage API with fallback.

```typescript
class StorageAdapter {
  async set(key: string, value: any): Promise<void> {
    if (this.useIndexedDB) {
      return indexedDBManager.set(STORES.SETTINGS, key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }
}
```

### Virtual Scroller

Efficient rendering for large lists.

```typescript
class VirtualScroller {
  private renderVisibleItems(): void {
    const start = Math.floor(this.scrollTop / this.itemHeight);
    const end = start + this.visibleCount + this.overscan;

    // Only render visible items
    for (let i = start; i < end; i++) {
      this.renderItem(i);
    }
  }
}
```

## Web Workers

### XPM Worker

Parses XPM backdrop files off the main thread.

```typescript
// xpm-worker.ts
self.onmessage = (e) => {
  if (e.data.type === 'parse') {
    const result = parseXPM(e.data.xpmText, e.data.themeColors);
    self.postMessage({ type: 'result', dataUrl: result });
  }
};
```

### VFS Worker

Handles heavy filesystem operations.

```typescript
// vfs-worker.ts
self.onmessage = (e) => {
  switch (e.data.type) {
    case 'search':
      const results = searchFiles(e.data.payload);
      self.postMessage({ type: 'search:result', results });
      break;
    case 'flatten':
      const flat = flattenTree(e.data.payload);
      self.postMessage({ type: 'flatten:result', flat });
      break;
  }
};
```

## Data Flow

### Application Launch

```
User clicks icon
    ↓
lazyLoader.load('emacs')
    ↓
Dynamic import
    ↓
Module initialization
    ↓
windowManager.createWindow()
    ↓
Window rendered
    ↓
Event: 'window:opened'
```

### Theme Change

```
User selects palette
    ↓
styleManager.applyPalette()
    ↓
storageAdapter.set('theme', data)
    ↓
CSS variables updated
    ↓
Event: 'theme:changed'
    ↓
All windows re-render
```

### File Operation

```
User creates file
    ↓
vfs.createFile(path, content)
    ↓
fsMap.set(path, node)
    ↓
storageAdapter.set('vfs', fsMap)
    ↓
Event: 'file:created'
    ↓
File Manager updates
```

## Performance Optimizations

### Code Splitting

```javascript
// Main bundle: ~200KB
// Feature chunks: ~20-50KB each
// Total: ~400KB (all features loaded)
```

### Lazy Loading

Features load on-demand:

- Initial: Core systems only
- On interaction: Feature islands
- On visibility: Background features

### Virtual Scrolling

Render only visible items:

- 10,000 files: Only ~20 DOM nodes
- Constant memory usage
- 60fps scrolling

### Web Workers

Offload heavy operations:

- XPM parsing: ~100ms → non-blocking
- VFS operations: ~50ms → non-blocking

### Caching

Multiple cache layers:

- Memory: Instant access
- IndexedDB: Fast persistent
- localStorage: Fallback

## Build Process

### Astro Build

```bash
npm run build
    ↓
Astro processes .astro files
    ↓
Vite bundles JavaScript
    ↓
CSS optimized and minified
    ↓
Static HTML generated
    ↓
Output to dist/
```

### Bundle Analysis

```
dist/
├── _astro/
│   ├── layout.[hash].js      # Main bundle
│   ├── emacs.[hash].js       # Lazy chunk
│   ├── terminal.[hash].js    # Lazy chunk
│   └── ...
├── index.html
└── assets/
```

## Testing Strategy

### Unit Tests (Future)

- Core systems (VFS, WindowManager)
- Utilities (LazyLoader, StorageAdapter)
- Pure functions

### Integration Tests (Future)

- Feature interactions
- Event flow
- Storage operations

### E2E Tests (Future)

- User workflows
- Application launches
- Theme changes

## Deployment

### Static Hosting

Built as static site, deployable to:

- GitHub Pages
- Netlify
- Vercel
- Any static host

### PWA

Service worker enables:

- Offline functionality
- Install as app
- Fast loading

## Further Reading

- [Storage & Cache](storage.md)
- [Dependency Injection Architecture](dependency-injection.md)
- [Error Handling](error-handling.md)
- [Event Bus](event-bus.md)
- [Window Management](window-management.md)
- [Virtual File System](virtual-filesystem.md)
- [Module Loading](module-loading.md)
