# Module Loading & Code Splitting

Technical documentation for the module loading system in Debian Time Capsule.

## System Design

The module loading system implements sophisticated lazy loading with a 5-tier priority system to optimize application startup performance and distribute network/CPU load.

```
ModuleLoader
├── Module Registry (Map)
├── Dependency Resolution
├── Priority-Based Loading
├── Idle Loading (requestIdleCallback)
└── Load Statistics
```

## Priority System

The 5-tier priority system provides fine-grained control over module loading timing:

### Priority Levels

**CRITICAL (0)** - Core systems loaded synchronously during boot
- VFS (Virtual File System)
- WindowManager
- Must be available immediately
- Loaded before desktop appears

**HIGH (1)** - Essential UI loaded synchronously
- Desktop (icon system)
- StyleManager
- Loaded during boot sequence
- Required for basic functionality

**MEDIUM (2)** - Features loaded on idle with no delay
- FileManager
- Emacs (text editor)
- Calendar
- ProcessMonitor
- Loaded when browser is idle
- No artificial delay

**LOW (3)** - Secondary features loaded on idle after 2s
- Netscape (browser)
- Lynx (text browser)
- ManViewer (documentation)
- Terminal (command line)
- Loaded after initial UI is ready
- 2-second delay before loading

**IDLE (4)** - Optional features loaded on idle after 5s
- TimeManager
- AppManager
- Lowest priority
- 5-second delay before loading

### Why 5 Tiers?

The multi-tier system prevents:
- UI blocking during startup
- Network congestion
- CPU spikes
- Race conditions between dependencies

Simplifying to 2 tiers would:
- Change timing behavior
- Risk race conditions
- Reduce control over load distribution
- Impact perceived performance

## Module Registration

### Registration API

```typescript
moduleLoader.register(
  name: string,
  loader: () => Promise<any>,
  options?: {
    priority?: LoadPriority;
    dependencies?: string[];
    preload?: boolean;
  }
)
```

### Registration Examples

**Critical Module:**
```typescript
moduleLoader.register('vfs', () => import('../core/vfs'), {
  priority: LoadPriority.CRITICAL,
  preload: true,
});
```

**Module with Dependencies:**
```typescript
moduleLoader.register('filemanager', () => import('../features/filemanager'), {
  priority: LoadPriority.MEDIUM,
  dependencies: ['vfs', 'windowmanager'],
});
```

**Idle Module:**
```typescript
moduleLoader.register('timemanager', () => import('../features/timemanager'), {
  priority: LoadPriority.IDLE,
  dependencies: ['windowmanager'],
});
```

## Module Metadata

Each registered module stores metadata:

```typescript
interface ModuleMetadata {
  name: string;                    // Module identifier
  priority: LoadPriority;          // Loading priority (0-4)
  loader: () => Promise<any>;      // Dynamic import function
  dependencies?: string[];         // Required modules
  preload?: boolean;               // Force preload
  loaded: boolean;                 // Load status
  loading: boolean;                // Currently loading
  module?: any;                    // Loaded module reference
  loadTime?: number;               // Load duration (ms)
}
```

## Loading Strategies

### Synchronous Loading (CRITICAL/HIGH)

Loaded during boot sequence before desktop appears:

```typescript
// In boot/init.ts
await initPerformanceOptimizations();
// Loads CRITICAL and HIGH priority modules
```

**Process:**
1. Load CRITICAL modules first (VFS, WindowManager)
2. Wait for completion
3. Load HIGH modules (Desktop, StyleManager)
4. Wait for completion
5. Show desktop

### Idle Loading (MEDIUM/LOW/IDLE)

Loaded when browser is idle using `requestIdleCallback`:

```typescript
moduleLoader.loadOnIdle(['filemanager', 'emacs', 'calendar', 'processmonitor']);
```

**Process:**
1. Wait for browser idle time
2. Load next module in queue
3. Wait for completion
4. Schedule next module load
5. Repeat until queue empty

**Timing:**
- MEDIUM: Immediate when idle
- LOW: 2-second delay
- IDLE: 5-second delay

### Preload by Priority

Load all modules up to a specific priority:

```typescript
await moduleLoader.preloadByPriority(LoadPriority.HIGH);
// Loads CRITICAL and HIGH priority modules
```

**Use Cases:**
- Boot sequence optimization
- Prefetch critical modules
- Warm up cache

## Dependency Resolution

### Dependency Graph

Modules can declare dependencies that must load first:

```typescript
moduleLoader.register('filemanager', () => import('../features/filemanager'), {
  dependencies: ['vfs', 'windowmanager'],
});
```

**Resolution Process:**
1. Check if module already loaded → return cached
2. Check if module currently loading → wait
3. Load dependencies recursively
4. Load module
5. Cache result

### Circular Dependencies

The system does not detect circular dependencies. Avoid:

```typescript
// BAD: Circular dependency
moduleA depends on moduleB
moduleB depends on moduleA
```

### Dependency Loading Order

Dependencies are loaded in parallel:

```typescript
await Promise.all(module.dependencies.map(dep => this.load(dep)));
```

## Loading Process

### Load Flow

```typescript
async load(name: string): Promise<any>
```

**Steps:**
1. Check if module exists in registry
2. Return cached module if already loaded
3. Wait if currently loading
4. Load dependencies (parallel)
5. Execute loader function (dynamic import)
6. Measure load time
7. Cache module
8. Return module

### Load States

**Not Started:**
- `loaded: false`
- `loading: false`

**Loading:**
- `loaded: false`
- `loading: true`

**Loaded:**
- `loaded: true`
- `loading: false`
- `module: <cached>`
- `loadTime: <ms>`

### Wait for Loading Module

If a module is already loading, subsequent calls wait:

```typescript
private async waitForModule(name: string): Promise<any> {
  const module = this.modules.get(name);
  while (module.loading) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return module.module;
}
```

## Performance Monitoring

### Load Statistics

```typescript
moduleLoader.getStats()
```

**Returns:**
```typescript
{
  total: number;              // Total registered modules
  loaded: number;             // Successfully loaded
  loading: number;            // Currently loading
  avgLoadTime: number;        // Average load time (ms)
  byPriority: {               // Count by priority
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    IDLE: number;
  }
}
```

**Usage:**
```typescript
const stats = moduleLoader.getStats();
console.log(`Loaded ${stats.loaded}/${stats.total} modules`);
console.log(`Average load time: ${stats.avgLoadTime.toFixed(2)}ms`);
```

### Load Time Tracking

Each module tracks its load time:

```typescript
const startTime = performance.now();
module.module = await module.loader();
module.loadTime = performance.now() - startTime;
```

**Logged Output:**
```
[ModuleLoader] Loaded: filemanager (45.23ms)
```

## Integration with Boot Sequence

### Boot Flow

```typescript
// 1. Mark boot start
performance.mark('boot-start');

// 2. Initialize DI container
initializeContainer();

// 3. Register all modules
registerModules();

// 4. Load critical modules
await initPerformanceOptimizations();

// 5. Initialize VFS
const vfsModule = await moduleLoader.load('vfs');
vfsModule.VFS.init();

// 6. Initialize WindowManager
const wmModule = await moduleLoader.load('windowmanager');
wmModule.WindowManager.init();

// 7. Load Desktop
const desktopModule = await moduleLoader.load('desktop');
desktopModule.DesktopManager.init();

// 8. Schedule idle loading
moduleLoader.loadOnIdle(['filemanager', 'emacs', 'calendar', 'processmonitor']);
setTimeout(() => {
  moduleLoader.loadOnIdle(['netscape', 'lynx', 'manviewer', 'terminal']);
}, 2000);
setTimeout(() => {
  moduleLoader.loadOnIdle(['timemanager', 'appmanager']);
}, 5000);
```

## Registered Modules

### Complete Module Registry

```typescript
// CRITICAL (0)
vfs                 // Virtual File System
windowmanager       // Window Management

// HIGH (1)
desktop            // Desktop Icons
stylemanager       // Theme System

// MEDIUM (2)
filemanager        // File Browser
emacs              // Text Editor
calendar           // Calendar Widget
processmonitor     // Process Monitor

// LOW (3)
netscape           // Web Browser
lynx               // Text Browser
manviewer          // Man Pages
terminal           // Terminal Lab

// IDLE (4)
timemanager        // Time Settings
appmanager         // App Launcher
```

## Code Splitting

### Dynamic Imports

Each module uses dynamic imports for code splitting:

```typescript
() => import('../features/filemanager')
```

**Benefits:**
- Separate bundle per module
- Lazy loading
- Reduced initial bundle size
- Parallel downloads

### Bundle Structure

```
dist/_astro/
├── layout.[hash].js          # Main bundle (~200KB)
├── vfs.[hash].js            # VFS module
├── windowmanager.[hash].js  # Window manager
├── filemanager.[hash].js    # File manager
├── emacs.[hash].js          # Emacs editor
└── ...
```

## Error Handling

### Load Failures

```typescript
try {
  await moduleLoader.load('filemanager');
} catch (error) {
  logger.error('[ModuleLoader] Failed to load filemanager:', error);
  // Module remains unloaded
  // Application continues without it
}
```

### Graceful Degradation

- Failed modules don't crash the application
- Other modules continue loading
- UI shows error or hides feature

## Usage Examples

### Manual Module Loading

```typescript
// Load module on demand
const emacs = await moduleLoader.load('emacs');
if (emacs && emacs.Emacs) {
  emacs.Emacs.open();
}
```

### Preload Critical Modules

```typescript
// Preload before showing UI
await moduleLoader.preloadByPriority(LoadPriority.HIGH);
// Now CRITICAL and HIGH modules are loaded
```

### Check Load Status

```typescript
const module = moduleLoader.modules.get('filemanager');
if (module?.loaded) {
  console.log('FileManager is ready');
  console.log(`Loaded in ${module.loadTime}ms`);
}
```

## Performance Optimization

### Initial Load Optimization

```typescript
async optimizeInitialLoad(): Promise<void> {
  // Load critical modules
  await moduleLoader.preloadByPriority(LoadPriority.CRITICAL);
  await moduleLoader.preloadByPriority(LoadPriority.HIGH);
  
  // Schedule idle loading
  moduleLoader.loadOnIdle(['filemanager', 'emacs', 'calendar', 'processmonitor']);
  
  // Delayed loading
  setTimeout(() => {
    moduleLoader.loadOnIdle(['netscape', 'lynx', 'manviewer', 'terminal']);
  }, 2000);
  
  setTimeout(() => {
    moduleLoader.loadOnIdle(['timemanager', 'appmanager']);
  }, 5000);
}
```

### Browser Idle Detection

Uses `requestIdleCallback` when available:

```typescript
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => loadNext(0), { timeout: 2000 });
} else {
  setTimeout(() => loadNext(0), 1000);
}
```

**Benefits:**
- Loads during browser idle time
- Doesn't block user interactions
- Fallback for unsupported browsers

## Configuration

### Priority Constants

```typescript
export enum LoadPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  IDLE = 4,
}
```

### Timing Configuration

```typescript
// Idle loading delays
MEDIUM: 0ms      // Immediate when idle
LOW: 2000ms      // 2-second delay
IDLE: 5000ms     // 5-second delay

// Wait polling interval
WAIT_INTERVAL: 50ms  // Check every 50ms if module loaded
```

## Further Reading

- [Architecture Overview](./architecture.md)
- [Boot Sequence](./boot-sequence.md)
- [Performance Monitoring](./performance-monitoring.md)
- [Dependency Injection](./dependency-injection.md)
