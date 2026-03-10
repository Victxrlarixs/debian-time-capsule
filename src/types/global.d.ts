// Global type declarations for CDE Desktop Environment
// Consolidates all window.* assignments for type safety

import type { VFS } from '../scripts/core/vfs';
import type { AudioManager } from '../scripts/core/audiomanager';
import type { StyleManager } from '../scripts/features/stylemanager';
import type { WindowManager } from '../scripts/core/windowmanager';
// import type { DebianRealBoot } from '../scripts/boot/init'; (Class is not exported)

/**
 * Clipboard item structure for file operations
 */
interface ClipboardItem {
  path: string;
  operation: 'copy' | 'cut';
}

/**
 * App Manager controller interface
 */
interface AppManager {
  open(): void;
  close(): void;
}

/**
 * Process Monitor interface
 */
interface ProcessMonitor {
  open(): void;
  close(): void;
}

/**
 * Calendar Manager interface
 */
interface CalendarManager {
  toggle(): void;
}

/**
 * Share Config interface
 */
interface ShareConfig {
  load(): void;
}

declare global {
  interface Window {
    // Core Systems
    VirtualFS: typeof VFS;
    AudioManager: typeof AudioManager;
    styleManager?: StyleManager;
    WindowManager: typeof WindowManager;
    DesktopManager?: any; // To be imported or typed specifically

    // Boot System
    debianBoot: any;
    initDesktop: () => void;
    initClock?: () => void;

    // Window Management
    drag: (e: PointerEvent, id: string) => void;
    focusWindow: (id: string) => void;
    centerWindow: (element: HTMLElement) => void;
    minimizeWindow: (id: string) => void;
    maximizeWindow: (id: string) => void;
    shadeWindow: (id: string) => void;

    // File Manager
    openFileManager: () => void;
    closeFileManager: () => void;
    toggleFileManager: () => void;
    isFileManagerOpen: () => boolean;
    openPath: (path: string) => void;
    goBack: () => void;
    goForward: () => void;
    goUp: () => void;
    goHome: () => void;
    createFile: (name: string, content: string) => Promise<void>;
    saveFile: (path: string, content: string) => void;
    fmClipboard: ClipboardItem | null;

    // Screenshot Utilities
    captureFullPageScreenshot: () => void;
    saveScreenshot: (url: string) => void;
    shareToDiscussions: (url: string) => void;

    // Calendar
    calendarManager?: CalendarManager;
    openCalendar: () => void;

    // Process Monitor
    ProcessMonitor?: ProcessMonitor;
    openTaskManagerInTerminal: () => void;

    // Style Manager
    updateMouseSetting: (key: string, value: any) => void;
    syncMouseControls: () => void;

    // External Links
    confirmExternalLink: (url: string) => void;

    // App Manager
    appManager: AppManager;

    // Share Config
    ShareConfig?: ShareConfig;
    shareThemeToDiscussions?: () => void;

    // Performance Debugging
    getPerformanceReport?: () => any;
    logPerformanceReport?: () => Promise<void>;

    // Emacs / Editor
    openEmacs?: (name: string, content: string, path?: string) => Promise<void>;

    // CONFIG (debugging)
    CONFIG?: import('../scripts/core/config').Config;
  }
}

export {};
