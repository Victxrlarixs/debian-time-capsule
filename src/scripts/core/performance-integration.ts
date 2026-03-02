// src/scripts/core/performance-integration.ts
// Integration layer for all performance optimizations

import { logger } from '../utilities/logger';
import { indexedDBManager } from '../utilities/indexeddb-manager';
import { performanceMonitor } from './performance-monitor';
import { moduleLoader } from '../shared/module-loader';

/**
 * Initialize all performance optimizations
 */
export async function initPerformanceOptimizations(): Promise<void> {
  logger.log('[Performance] Initializing optimizations...');

  try {
    // 1. Start performance monitoring
    performanceMonitor.init();
    performanceMonitor.mark('perf-init-start');

    // 2. Initialize storage adapter (IndexedDB with localStorage fallback)
    const { storageAdapter } = await import('../utilities/storage-adapter');
    await storageAdapter.init();
    logger.log('[Performance] Storage adapter initialized');

    // 3. Initialize IndexedDB
    await indexedDBManager.init();

    const migrated = localStorage.getItem('cde-indexeddb-migrated');
    if (!migrated) {
      await indexedDBManager.migrateFromLocalStorage();
      localStorage.setItem('cde-indexeddb-migrated', 'true');
      logger.log('[Performance] Migrated to IndexedDB');
    }

    // 5. Optimize initial load with module loader
    await performanceMonitor.optimizeInitialLoad();

    // 6. Cleanup old cache entries
    await indexedDBManager.cleanupCache();

    performanceMonitor.mark('perf-init-end');
    const duration = performanceMonitor.measure('perf-init', 'perf-init-start', 'perf-init-end');

    logger.log(`[Performance] Optimizations initialized in ${duration.toFixed(2)}ms`);

    // 7. Log storage usage
    const estimate = await indexedDBManager.getStorageEstimate();
    const usageMB = (estimate.usage / 1024 / 1024).toFixed(2);
    const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
    logger.log(`[Performance] Storage: ${usageMB}MB / ${quotaMB}MB`);

    // 8. Schedule performance report
    setTimeout(() => {
      performanceMonitor.logReport();
    }, 10000);
  } catch (error) {
    logger.error('[Performance] Failed to initialize optimizations:', error);
  }
}

/**
 * Get performance report
 */
export function getPerformanceReport(): {
  metrics: any;
  moduleLoading: any;
  storage: Promise<any>;
  memory: any;
} {
  return {
    metrics: performanceMonitor.getMetrics(),
    moduleLoading: moduleLoader.getStats(),
    storage: indexedDBManager.getStorageEstimate(),
    memory: performanceMonitor.getMemoryUsage(),
  };
}

/**
 * Log complete performance report
 */
export async function logPerformanceReport(): Promise<void> {
  console.log('='.repeat(60));
  console.log('CDE PERFORMANCE REPORT');
  console.log('='.repeat(60));

  // Metrics
  performanceMonitor.logSummary();

  // Storage
  const storage = await indexedDBManager.getStorageEstimate();
  console.log('\n=== Storage ===');
  console.log(`Used: ${(storage.usage / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Quota: ${(storage.quota / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Available: ${((storage.quota - storage.usage) / 1024 / 1024).toFixed(2)} MB`);

  // Memory
  const memory = performanceMonitor.getMemoryUsage();
  if (memory) {
    console.log('\n=== Memory (Chrome) ===');
    console.log(`Used: ${(memory.used / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total: ${(memory.total / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Limit: ${(memory.limit / 1024 / 1024).toFixed(2)} MB`);
  }

  console.log('='.repeat(60));
}

// Global exposure for debugging
if (typeof window !== 'undefined') {
  (window as any).getPerformanceReport = getPerformanceReport;
  (window as any).logPerformanceReport = logPerformanceReport;
}
