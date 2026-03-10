// src/scripts/shared/module-loader.ts
// Advanced module loading system with code splitting and lazy loading

import { logger } from '../utilities/logger';

/**
 * Module loading priority levels
 *
 * The 5-tier system provides fine-grained control over module loading timing:
 * - CRITICAL (0): Core systems loaded synchronously during boot (VFS, WindowManager)
 * - HIGH (1): Essential UI loaded synchronously (Desktop, StyleManager)
 * - MEDIUM (2): Features loaded on idle with no delay (FileManager, Emacs, Calendar, ProcessMonitor)
 * - LOW (3): Secondary features loaded on idle after 2s (Netscape, Lynx, ManViewer, Terminal)
 * - IDLE (4): Optional features loaded on idle after 5s (AppManager)
 *
 * This staggered loading prevents UI blocking and distributes network/CPU load.
 * Simplifying to 2 tiers would change timing behavior and risk race conditions.
 */
export enum LoadPriority {
  CRITICAL = 0, // Must load immediately (VFS, WindowManager)
  HIGH = 1, // Load early (Desktop, StyleManager)
  MEDIUM = 2, // Load when needed (FileManager, Emacs)
  LOW = 3, // Load on demand (Netscape, Lynx)
  IDLE = 4, // Load when browser is idle
}

/**
 * Module metadata
 */
interface ModuleMetadata {
  name: string;
  priority: LoadPriority;
  loader: () => Promise<any>;
  dependencies?: string[];
  preload?: boolean;
  loaded: boolean;
  loading: boolean;
  module?: any;
  loadTime?: number;
}

/**
 * Advanced module loader with dependency management and code splitting
 */
class ModuleLoader {
  private modules: Map<string, ModuleMetadata> = new Map();

  /**
   * Register a module for lazy loading
   */
  register(
    name: string,
    loader: () => Promise<any>,
    options: {
      priority?: LoadPriority;
      dependencies?: string[];
      preload?: boolean;
    } = {}
  ): void {
    const { priority = LoadPriority.MEDIUM, dependencies = [], preload = false } = options;

    this.modules.set(name, {
      name,
      priority,
      loader,
      dependencies,
      preload,
      loaded: false,
      loading: false,
    });

    logger.log(`[ModuleLoader] Registered: ${name} (priority: ${LoadPriority[priority]})`);
  }

  /**
   * Load a module and its dependencies
   */
  async load(name: string): Promise<any> {
    const module = this.modules.get(name);

    if (!module) {
      logger.warn(`[ModuleLoader] Module not found: ${name}`);
      return null;
    }

    // Already loaded
    if (module.loaded) {
      return module.module;
    }

    // Already loading - wait for it
    if (module.loading) {
      return this.waitForModule(name);
    }

    // Load dependencies first
    if (module.dependencies && module.dependencies.length > 0) {
      logger.log(`[ModuleLoader] Loading dependencies for ${name}:`, module.dependencies);
      await Promise.all(module.dependencies.map((dep) => this.load(dep)));
    }

    // Load the module
    try {
      module.loading = true;
      const startTime = performance.now();

      logger.log(`[ModuleLoader] Loading: ${name}...`);
      module.module = await module.loader();

      module.loadTime = performance.now() - startTime;
      module.loaded = true;
      module.loading = false;

      logger.log(`[ModuleLoader] Loaded: ${name} (${module.loadTime.toFixed(2)}ms)`);

      return module.module;
    } catch (error) {
      module.loading = false;
      logger.error(`[ModuleLoader] Failed to load ${name}:`, error);
      throw error;
    }
  }

  /**
   * Wait for a module that's currently loading
   */
  private async waitForModule(name: string): Promise<any> {
    const module = this.modules.get(name);
    if (!module) return null;

    while (module.loading) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return module.module;
  }

  /**
   * Preload modules based on priority
   */
  async preloadByPriority(maxPriority: LoadPriority = LoadPriority.HIGH): Promise<void> {
    const toPreload: string[] = [];

    this.modules.forEach((module, name) => {
      if (
        module.priority <= maxPriority &&
        (module.preload || module.priority === LoadPriority.CRITICAL)
      ) {
        toPreload.push(name);
      }
    });

    // Sort by priority
    toPreload.sort((a, b) => {
      const modA = this.modules.get(a)!;
      const modB = this.modules.get(b)!;
      return modA.priority - modB.priority;
    });

    logger.log(`[ModuleLoader] Preloading ${toPreload.length} modules by priority`);

    for (const name of toPreload) {
      try {
        await this.load(name);
      } catch (error) {
        logger.warn(`[ModuleLoader] Preload failed for ${name}:`, error);
      }
    }
  }

  /**
   * Load modules when browser is idle
   */
  loadOnIdle(names: string[]): void {
    const loadNext = (index: number) => {
      if (index >= names.length) return;

      const name = names[index];
      const module = this.modules.get(name);

      if (!module || module.loaded || module.loading) {
        loadNext(index + 1);
        return;
      }

      this.load(name)
        .then(() => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => loadNext(index + 1), { timeout: 2000 });
          } else {
            setTimeout(() => loadNext(index + 1), 100);
          }
        })
        .catch(() => loadNext(index + 1));
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => loadNext(0), { timeout: 2000 });
    } else {
      setTimeout(() => loadNext(0), 1000);
    }

    logger.log(`[ModuleLoader] Scheduled ${names.length} modules for idle loading`);
  }

  /**
   * Get loading statistics
   */
  getStats(): {
    total: number;
    loaded: number;
    loading: number;
    avgLoadTime: number;
    byPriority: Record<string, number>;
  } {
    let loaded = 0;
    let loading = 0;
    let totalLoadTime = 0;
    let loadedCount = 0;
    const byPriority: Record<string, number> = {};

    this.modules.forEach((module) => {
      if (module.loaded) {
        loaded++;
        if (module.loadTime) {
          totalLoadTime += module.loadTime;
          loadedCount++;
        }
      }
      if (module.loading) loading++;

      const priorityName = LoadPriority[module.priority];
      byPriority[priorityName] = (byPriority[priorityName] || 0) + 1;
    });

    return {
      total: this.modules.size,
      loaded,
      loading,
      avgLoadTime: loadedCount > 0 ? totalLoadTime / loadedCount : 0,
      byPriority,
    };
  }
}

// Singleton instance
export const moduleLoader = new ModuleLoader();

/**
 * Register all application modules
 */
export function registerModules(): void {
  // CRITICAL - Must load immediately
  moduleLoader.register('vfs', () => import('../core/vfs'), {
    priority: LoadPriority.CRITICAL,
    preload: true,
  });

  moduleLoader.register('windowmanager', () => import('../core/windowmanager'), {
    priority: LoadPriority.CRITICAL,
    preload: true,
  });

  // HIGH - Load early
  moduleLoader.register('desktop', () => import('../features/desktop'), {
    priority: LoadPriority.HIGH,
    dependencies: ['vfs'],
    preload: true,
  });

  moduleLoader.register('stylemanager', () => import('../features/stylemanager'), {
    priority: LoadPriority.HIGH,
    dependencies: ['windowmanager'],
    preload: true,
  });

  // MEDIUM - Load when needed
  moduleLoader.register('filemanager', () => import('../features/filemanager'), {
    priority: LoadPriority.MEDIUM,
    dependencies: ['vfs', 'windowmanager'],
  });

  moduleLoader.register('emacs', () => import('../features/emacs'), {
    priority: LoadPriority.MEDIUM,
    dependencies: ['vfs', 'windowmanager'],
  });

  moduleLoader.register('calendar', () => import('../features/calendar'), {
    priority: LoadPriority.MEDIUM,
    dependencies: ['windowmanager'],
  });

  moduleLoader.register('processmonitor', () => import('../features/processmonitor'), {
    priority: LoadPriority.MEDIUM,
    dependencies: ['windowmanager'],
  });

  // LOW - Load on demand
  moduleLoader.register('netscape', () => import('../features/netscape'), {
    priority: LoadPriority.LOW,
    dependencies: ['windowmanager'],
  });

  moduleLoader.register('lynx', () => import('../features/lynx'), {
    priority: LoadPriority.LOW,
    dependencies: ['windowmanager'],
  });

  moduleLoader.register('manviewer', () => import('../features/manviewer'), {
    priority: LoadPriority.LOW,
    dependencies: ['windowmanager'],
  });

  moduleLoader.register('terminal', () => import('../features/lab'), {
    priority: LoadPriority.LOW,
    dependencies: ['vfs', 'windowmanager'],
  });

  // IDLE - Load when browser is idle
  moduleLoader.register('appmanager', () => import('../features/appmanager'), {
    priority: LoadPriority.IDLE,
    dependencies: ['windowmanager'],
  });

  logger.log('[ModuleLoader] All modules registered');
}
