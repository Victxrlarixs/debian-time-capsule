// src/scripts/core/performance-monitor.ts
// Unified Performance monitoring, optimization and Web Vitals tracking

import { logger } from '../utilities/logger';
import { moduleLoader, LoadPriority } from '../shared/module-loader';

export interface PerformanceMetrics {
  // Web Vitals
  fcp?: number; // First Contentful Paint
  fp?: number; // First Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  tti?: number; // Time to Interactive

  // Navigation & Load
  domContentLoaded?: number;
  loadComplete?: number;
  bootTime?: number;

  // Module stats
  modulesLoaded?: number;
  avgModuleLoadTime?: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private observers: PerformanceObserver[] = [];

  /**
   * Initialize performance monitoring
   */
  init(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      logger.warn('[PerformanceMonitor] PerformanceObserver not supported');
      return;
    }

    this.setupObservers();
    this.measureTTFB();
    this.measureBootTime();
    this.measureLoadTime();

    logger.log('[PerformanceMonitor] Initialized');
  }

  /**
   * Setup all performance observers
   */
  private setupObservers(): void {
    try {
      // Paint timing (FCP, FP)
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime;
            logger.log(`[PerformanceMonitor] FCP: ${entry.startTime.toFixed(2)}ms`);
            this.reportMetric('FCP', entry.startTime);
          } else if (entry.name === 'first-paint') {
            this.metrics.fp = entry.startTime;
            logger.log(`[PerformanceMonitor] FP: ${entry.startTime.toFixed(2)}ms`);
          }
        }
      });
      paintObserver.observe({ type: 'paint', buffered: true });
      this.observers.push(paintObserver);

      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
        logger.log(`[PerformanceMonitor] LCP: ${lastEntry.startTime.toFixed(2)}ms`);
        this.reportMetric('LCP', lastEntry.startTime);
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(lcpObserver);

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidEntry = entry as any;
          this.metrics.fid = fidEntry.processingStart - fidEntry.startTime;
          logger.log(`[PerformanceMonitor] FID: ${this.metrics.fid!.toFixed(2)}ms`);
          this.reportMetric('FID', this.metrics.fid!);
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as any;
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
          }
        }
        this.metrics.cls = clsValue;
        logger.log(`[PerformanceMonitor] CLS: ${clsValue.toFixed(4)}`);
        this.reportMetric('CLS', clsValue);
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(clsObserver);

      // Navigation timing
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const navEntry = entry as PerformanceNavigationTiming;
          this.metrics.domContentLoaded = navEntry.domContentLoadedEventEnd;
          this.metrics.loadComplete = navEntry.loadEventEnd;
          logger.log(`[PerformanceMonitor] DCL: ${navEntry.domContentLoadedEventEnd.toFixed(2)}ms`);
          logger.log(`[PerformanceMonitor] Load: ${navEntry.loadEventEnd.toFixed(2)}ms`);
        }
      });
      navObserver.observe({ type: 'navigation', buffered: true });
      this.observers.push(navObserver);
    } catch (error) {
      logger.warn('[PerformanceMonitor] Failed to setup observers:', error);
    }
  }

  /**
   * Measure Time to First Byte
   */
  private measureTTFB(): void {
    try {
      const navigationEntry = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        this.metrics.ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
        logger.log(`[PerformanceMonitor] TTFB: ${this.metrics.ttfb.toFixed(2)}ms`);
        this.reportMetric('TTFB', this.metrics.ttfb);
      }
    } catch (error) {
      logger.warn('[PerformanceMonitor] Failed to measure TTFB:', error);
    }
  }

  /**
   * Measure boot time
   */
  private measureBootTime(): void {
    const bootStart = performance.getEntriesByName('boot-start')[0];
    if (bootStart) {
      this.metrics.bootTime = performance.now() - bootStart.startTime;
      logger.log(`[PerformanceMonitor] Boot Time: ${this.metrics.bootTime.toFixed(2)}ms`);
    }
  }

  /**
   * Measure page load time
   */
  private measureLoadTime(): void {
    window.addEventListener('load', () => {
      const loadTime = performance.now();
      this.metrics.loadComplete = loadTime;
      logger.log(`[PerformanceMonitor] Page Load: ${loadTime.toFixed(2)}ms`);
      this.reportMetric('PageLoad', loadTime);
    });
  }

  /**
   * Optimize initial load by prioritizing modules
   */
  async optimizeInitialLoad(): Promise<void> {
    logger.log('[PerformanceMonitor] Optimizing initial load...');

    // Load critical and high priority modules sequence
    await moduleLoader.preloadByPriority(LoadPriority.CRITICAL);
    await moduleLoader.preloadByPriority(LoadPriority.HIGH);

    // Idle load groups
    moduleLoader.loadOnIdle(['filemanager', 'emacs', 'calendar', 'processmonitor']);

    setTimeout(() => {
      moduleLoader.loadOnIdle(['netscape', 'lynx', 'manviewer', 'terminal']);
    }, 2000);

    setTimeout(() => {
      moduleLoader.loadOnIdle(['appmanager']);
    }, 5000);

    logger.log('[PerformanceMonitor] Initial load optimization complete');
  }

  /**
   * Report metric to analytics (placeholder)
   */
  private reportMetric(name: string, value: number): void {
    if (import.meta.env.DEV) {
      console.log(`📊 [Metric] ${name}: ${value.toFixed(2)}`);
    }
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): PerformanceMetrics {
    const moduleStats = moduleLoader.getStats();
    return {
      ...this.metrics,
      modulesLoaded: moduleStats.loaded,
      avgModuleLoadTime: moduleStats.avgLoadTime,
    };
  }

  /**
   * Get performance summary string
   */
  getSummary(): string {
    const m = this.getMetrics();
    const stats = moduleLoader.getStats();

    return [
      '=== Performance Summary ===',
      `FCP: ${m.fcp?.toFixed(2) || 'N/A'}ms`,
      `LCP: ${m.lcp?.toFixed(2) || 'N/A'}ms`,
      `FID: ${m.fid?.toFixed(2) || 'N/A'}ms`,
      `CLS: ${m.cls?.toFixed(4) || 'N/A'}`,
      `TTFB: ${m.ttfb?.toFixed(2) || 'N/A'}ms`,
      `Boot: ${m.bootTime?.toFixed(2) || 'N/A'}ms`,
      `DCL: ${m.domContentLoaded?.toFixed(2) || 'N/A'}ms`,
      `Modules: ${stats.loaded}/${stats.total}`,
      `Avg Mod Load: ${stats.avgLoadTime.toFixed(2)}ms`,
      '========================',
    ].join('\n');
  }

  logReport(): void {
    console.log(this.getSummary());
  }

  logSummary(): void {
    this.logReport();
  }

  mark(name: string): void {
    performance.mark(name);
    logger.log(`[PerformanceMonitor] Mark: ${name}`);
  }

  measure(name: string, startMark: string, endMark: string): number {
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name)[0];
    logger.log(`[PerformanceMonitor] Measure ${name}: ${measure.duration.toFixed(2)}ms`);
    return measure.duration;
  }

  getMemoryUsage(): { used: number; total: number; limit: number } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      };
    }
    return null;
  }

  destroy(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
    logger.log('[PerformanceMonitor] Destroyed');
  }
}

export const performanceMonitor = new PerformanceMonitor();

if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
}
