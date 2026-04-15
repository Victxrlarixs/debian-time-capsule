// src/scripts/init.ts

import { CONFIG } from '../core/config';
import { initClock } from '../utilities/clock';
import type { StyleManager } from '../features/stylemanager';
import '../utilities/screenshot'; // side-effect: registers window.captureFullPageScreenshot
import '../ui/external-links';
import { logger } from '../utilities/logger';
import VersionManager from '../core/version-manager';
import { settingsManager } from '../core/settingsmanager';
import { initPerformanceOptimizations } from '../core/performance-integration';
import { registerModules, moduleLoader } from '../shared/module-loader';
import { initWorkspacePreview } from '../features/workspace-preview';
import { initializeContainer } from '../core/container.init';
import { initializeCDENamespace } from '../core/cde-namespace';
import { initializeAppRegistry } from '../core/app-registry.init';

/**
 * Global interface declarations for CDE desktop environment.
 */
import bootMessagesData from '../../data/boot-messages.json';
import updateMessagesData from '../../data/update-messages.json';

type BootMessagesData = typeof bootMessagesData;

/**
 * Global interface declarations for CDE desktop environment.
 */
declare global {
  interface Window {
    debianBoot: DebianRealBoot;
    initDesktop: () => void;
    DebianRealBoot: typeof DebianRealBoot;
    initClock?: () => void; // Kept for backward compatibility
    styleManager?: StyleManager;
  }
}

let desktopInitialized = false;

/**
 * Simulates a Debian system boot with CDE.
 */
class DebianRealBoot {
  private currentStep: number = 0;
  private logo: string;
  private bootSequence: Array<{ delay: number; text: string; type: string }> = [];
  private bootLog: string[] = [];
  private container: HTMLElement | null;
  private bootScreen: HTMLElement | null;
  private progressBar: HTMLElement | null;
  private isUpdateMode: boolean = false;

  constructor(isUpdateMode: boolean = false) {
    this.isUpdateMode = isUpdateMode;
    this.logo = CONFIG.BOOT.LOGO; // Always show logo
    this.container = document.getElementById('boot-log-container');
    this.bootScreen = document.getElementById('debian-boot-screen');
    this.progressBar = document.getElementById('boot-progress-bar');

    this.generateDynamicSequence();

    if (!this.container) {
      console.error('[DebianRealBoot] Boot container #boot-log-container not found');
    }
  }

  /**
   * Generates a randomized boot sequence based on phases.
   */
  private generateDynamicSequence(): void {
    const messagesData: BootMessagesData = this.isUpdateMode
      ? updateMessagesData
      : bootMessagesData;
    const phases = messagesData.phases;
    let totalTime = 0;

    phases.forEach((phase) => {
      // Pick random number of messages between min and max
      const count = Math.floor(Math.random() * (phase.max - phase.min + 1)) + phase.min;
      const selected = this.getRandomSubset(phase.messages, count);

      selected.forEach((msg) => {
        // Increment global boot time (seconds)
        const increment = Math.random() * 0.3 + 0.05;
        totalTime += increment;

        // Format text based on mode
        let text: string;
        if (this.isUpdateMode) {
          text = msg.text;
        } else {
          // Boot mode: add timestamps for kernel/system messages
          const timestamp = totalTime.toFixed(6).padStart(12, ' ');
          text =
            phase.name === 'kernel' ||
              phase.name === 'cpu' ||
              phase.name === 'fs' ||
              phase.name === 'memory'
              ? `[ ${timestamp} ] ${msg.text}`
              : msg.text;
        }

        this.bootSequence.push({
          text,
          type: msg.type,
          delay: Math.floor(Math.random() * 200) + 50, // Varied delay between lines
        });
      });
    });

    // Add final success message
    const finalMessage = this.isUpdateMode
      ? '[    OK    ] System update completed successfully'
      : '[    OK    ] CDE Desktop ready ....';

    this.bootSequence.push({
      text: finalMessage,
      type: 'desktop',
      delay: 500,
    });
  }

  private getRandomSubset(array: any[], count: number): any[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Inserts the Debian ASCII logo at the beginning of the container.
   */
  private insertLogo(): void {
    if (!this.container || !this.logo) return;

    const logoDiv = document.createElement('div');
    logoDiv.className = 'boot-logo';
    logoDiv.style.whiteSpace = 'pre';
    logoDiv.style.fontFamily = 'monospace';
    logoDiv.style.color = '#ff8888';
    logoDiv.style.marginBottom = '20px';
    logoDiv.style.lineHeight = '1.2';
    logoDiv.textContent = this.logo;

    this.container.appendChild(logoDiv);
    this.bootLog.push('[LOGO] Debian ASCII art');
    logger.log('[DebianRealBoot] Logo inserted');
  }

  /**
   * Starts the boot sequence.
   */
  public start(): void {
    this.currentStep = 0;
    this.bootLog = [];

    if (!this.container) {
      console.error('[DebianRealBoot] Cannot start boot sequence: container missing');
      this.completeBoot();
      return;
    }

    this.container.innerHTML = '';

    // Always insert logo
    this.insertLogo();

    const mode = this.isUpdateMode ? 'update' : 'boot';
    logger.log(`[DebianRealBoot] ${mode} sequence started`);
    this.startBootSequence();
  }

  private updateProgress(): void {
    const total = this.bootSequence.length;
    const pct = Math.round((this.currentStep / total) * 100);
    if (this.progressBar) this.progressBar.style.width = `${pct}%`;
  }

  private startBootSequence(): void {
    this.updateProgress();
    const showNextStep = () => {
      if (this.currentStep >= this.bootSequence.length) {
        if (this.progressBar) this.progressBar.style.width = '100%';
        setTimeout(() => this.completeBoot(), CONFIG.BOOT.FINAL_DELAY);
        return;
      }

      const step = this.bootSequence[this.currentStep];
      const line = document.createElement('div');
      line.className = this.getLineClass(step.type);
      line.style.cssText = `
        opacity: 0;
        animation: bootLineAppear 0.1s forwards;
        white-space: pre-wrap;
      `;
      line.textContent = step.text;

      this.container!.appendChild(line);
      this.container!.scrollTop = this.container!.scrollHeight;

      this.currentStep++;
      this.updateProgress();
      setTimeout(showNextStep, step.delay);
    };
    showNextStep();
  }

  /**
   * Returns the CSS class name based on message type.
   * @param type - Message type
   * @returns CSS class name
   * @private
   */
  private getLineClass(type: string): string {
    const map: Record<string, string> = {
      kernel: 'boot-kernel',
      cpu: 'boot-cpu',
      memory: 'boot-memory',
      fs: 'boot-fs',
      systemd: 'boot-systemd',
      service: 'boot-service',
      drm: 'boot-drm',
      desktop: 'boot-desktop',
      package: 'boot-package',
      download: 'boot-download',
      install: 'boot-install',
    };
    return map[type] || 'boot-default';
  }

  /**
   * Finalizes the boot process.
   * @private
   */
  private async completeBoot(): Promise<void> {
    logger.log('[DebianRealBoot] Completing boot process');

    // If this was an update sequence, clear the pending flag
    if (this.isUpdateMode) {
      VersionManager.clearPendingUpdate();
      logger.log('[DebianRealBoot] Update sequence completed, flag cleared');
    }

    // 1. Reveal desktop behind the boot screen (it has lower z-index)
    const desktop = document.getElementById('desktop-ui');
    if (desktop) {
      desktop.style.display = 'block';
    }

    // 2. Initialize asynchronous settings
    try {
      await settingsManager.init();
      logger.log('[DebianRealBoot] Asynchronous settings initialized');
    } catch (error) {
      logger.error('[DebianRealBoot] Failed to initialize settings:', error);
    }

    // 3. Initialize all desktop modules (including backdrop rendering)
    await initDesktop();

    // 4. Wait a small cushion to let the initial backdrop render start
    setTimeout(() => {
      if (this.bootScreen) {
        this.bootScreen.style.transition = 'opacity 0.8s ease-out';
        this.bootScreen.style.opacity = '0';

        // Remove loading cursor from body
        document.body.classList.remove('loading');

        setTimeout(() => {
          this.bootScreen!.style.display = 'none';
          logger.log('[DebianRealBoot] Boot screen removed');
        }, 800);
      }
    }, 400); // 400ms is enough for most XPM renders to start seeing content
  }
}

/**
 * Initializes all CDE desktop modules.
 */
async function initDesktop(): Promise<void> {
  if (desktopInitialized) {
    logger.log('[initDesktop] Desktop already initialized, skipping');
    return;
  }
  logger.log('[initDesktop] Initializing desktop modules...');

  if (typeof window.captureFullPageScreenshot === 'function') {
    logger.log('[Init] Screenshot utility available');
  }

  // ProcessMonitor is loaded dynamically via module loader
  if ((window as any).ProcessMonitor) {
    logger.log('[Init] ProcessMonitor module loaded');
    const ProcessMonitor = (window as any).ProcessMonitor;
    if (typeof ProcessMonitor.open === 'function' && typeof ProcessMonitor.close === 'function') {
      logger.log('[Init]   - ProcessMonitor API ready (open/close)');
    }
  }

  try {
    // 0. Initialize Dependency Injection Container
    initializeContainer();
    logger.log('[initDesktop] DI Container initialized');

    // 0.1. Initialize CDE Namespace
    initializeCDENamespace();
    logger.log('[initDesktop] CDE Namespace initialized');

    // 0.1.1. Initialize Application Registry
    initializeAppRegistry();
    logger.log('[initDesktop] Application Registry initialized');

    // 0.2. Register all modules for lazy loading
    registerModules();
    logger.log('[initDesktop] Modules registered for lazy loading');

    // 1. Initialize performance optimizations and load critical modules
    await initPerformanceOptimizations();
    logger.log('[initDesktop] Performance optimizations initialized');

    // 2. Load VFS module (CRITICAL priority)
    const vfsModule = await moduleLoader.load('vfs');
    if (vfsModule && vfsModule.VFS) {
      vfsModule.VFS.init();
      logger.log('[initDesktop] Virtual Filesystem initialized');
    }

    initClock();
    logger.log('[initDesktop] Clock initialized');

    // Play startup sound
    if (window.AudioManager) {
      window.AudioManager.playStartupChime();
    }

    const { applyPreloadedBackdrop } = await import('../boot/backdrop-preloader');
    await applyPreloadedBackdrop();
    logger.log('[initDesktop] Preloaded backdrop applied');

    // 4. Load WindowManager module (CRITICAL priority)
    const wmModule = await moduleLoader.load('windowmanager');
    if (wmModule && wmModule.WindowManager) {
      wmModule.WindowManager.init();
      logger.log('[initDesktop] Window manager initialized');
    }

    // Initialize workspace preview (miniatures on hover)
    initWorkspacePreview();
    logger.log('[initDesktop] Workspace preview initialized');

    // 5. Load Desktop module (HIGH priority)
    const desktopModule = await moduleLoader.load('desktop');
    if (desktopModule && desktopModule.DesktopManager) {
      desktopModule.DesktopManager.init();
      logger.log('[initDesktop] Desktop icons initialized');
    }

    // 6. Load Calendar module (MEDIUM priority, but load now for immediate use)
    const calendarModule = await moduleLoader.load('calendar');
    if (calendarModule && calendarModule.CalendarManager) {
      calendarModule.CalendarManager.init();
      logger.log('[initDesktop] Calendar initialized');
    }

    // 7. Load StyleManager module (HIGH priority)
    const styleModule = await moduleLoader.load('stylemanager');
    if (styleModule && window.styleManager) {
      window.styleManager.init();
      logger.log('[initDesktop] Style manager initialized');
    }

    // Load shared theme from URL if present (after StyleManager is ready)
    setTimeout(() => {
      if (window.ShareConfig) {
        window.ShareConfig.load();
      }
    }, 500); // Reduced from 1500ms to 500ms

    desktopInitialized = true;
    logger.log('[initDesktop] Desktop initialization completed successfully');
  } catch (error) {
    console.error('[initDesktop] Error during desktop initialization:', error);
  }
}

// ---------------------------------------------------------------------
// Automatic boot start
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  logger.log('[Boot] DOM Content Loaded, starting boot sequence');

  // Mark boot start for performance tracking
  performance.mark('boot-start');

  try {
    await VersionManager.checkVersion();
  } catch (error) {
    logger.error('[Boot] Version check failed:', error);
  }

  // Check if we need to show update sequence
  const isUpdateMode = VersionManager.hasPendingUpdate();

  if (isUpdateMode) {
    logger.log('[Boot] Pending update detected, showing update sequence');
  }

  try {
    window.debianBoot = new DebianRealBoot(isUpdateMode);
    window.debianBoot.start();
    logger.log(`[Boot] ${isUpdateMode ? 'Update' : 'Boot'} sequence initiated`);
  } catch (error) {
    console.error('[Boot] Failed to start boot sequence:', error);
    // Fallback: try to initialize desktop directly
    const desktop = document.getElementById('desktop-ui');
    if (desktop) desktop.style.display = 'block';
    await initDesktop();
  }
});

// Global exposure
window.initDesktop = initDesktop;
