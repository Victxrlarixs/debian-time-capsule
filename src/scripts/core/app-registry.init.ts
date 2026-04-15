// src/scripts/core/app-registry.init.ts

import { appRegistry } from './app-registry';
import type { IApplication } from './interfaces/application.interface';
import { logger } from '../utilities/logger';

/**
 * Initialize the application registry with all built-in apps.
 * This should be called early in the boot sequence.
 */
export function initializeAppRegistry(): void {
  logger.log('[AppRegistry] Initializing built-in applications...');

  // 1. Accessories
  appRegistry.register(
    {
      id: 'calendar',
      name: 'Calendar',
      icon: '/icons/system/calendar.png',
      category: 'Accessories',
      description: 'Manage your appointments and events.',
    },
    async () => {
      // Legacy wrapper for apps that only expose a global window.openApp()
      return {
        open: () => (window as any).openCalendar && (window as any).openCalendar(),
      };
    }
  );

  appRegistry.register(
    {
      id: 'screenshooter',
      name: 'Screenshooter',
      icon: '/icons/apps/org.xfce.screenshooter.png',
      category: 'Accessories',
      description: 'Capture screenshot.',
    },
    async () => ({
      open: () =>
        (window as any).captureFullPageScreenshot && (window as any).captureFullPageScreenshot(),
    })
  );

  appRegistry.register(
    {
      id: 'shortcuts',
      name: 'Keyboard Shortcuts',
      icon: '/icons/apps/preferences-desktop-keyboard-shortcuts.png',
      category: 'Accessories',
      description: 'View shortcuts.',
    },
    async () => ({ open: () => (window as any).AccessibilityManager?.showShortcutsHelp() })
  );

  // 2. Internet
  appRegistry.register(
    {
      id: 'netscape',
      name: 'Netscape Navigator',
      icon: '/icons/apps/netscape_classic.png',
      category: 'Internet',
      description: 'The premier browser for the modern web.',
    },
    async () => {
      // Netscape is already initialized as a singleton on window
      return {
        open: () => (window as any).Netscape?.open(),
      };
    }
  );

  appRegistry.register(
    {
      id: 'lynx',
      name: 'Lynx Browser',
      icon: '/icons/apps/Lynx.svg',
      category: 'Internet',
      description: 'Text-based web browser.',
    },
    async () => {
      return {
        open: () => (window as any).Lynx?.open(),
      };
    }
  );

  // 3. Development
  appRegistry.register(
    {
      id: 'emacs',
      name: 'Text Editor',
      icon: '/icons/apps/xemacs.png',
      category: 'Development',
      description: 'XEmacs text editor.',
    },
    async () => {
      return {
        open: () => (window as any).Emacs?.openSplash(),
      };
    }
  );

  appRegistry.register(
    {
      id: 'vim',
      name: 'Vim',
      icon: '/icons/apps/vim.png',
      category: 'Development',
      description: 'Vi IMproved editor.',
    },
    async () => {
      await (window as any).moduleLoader?.load('vim');
      return {
        open: () => (window as any).Vim?.open(),
      };
    }
  );

  // 4. System
  appRegistry.register(
    {
      id: 'file-manager',
      name: 'File Manager',
      icon: '/icons/apps/filemanager.png',
      category: 'System',
      description: 'Navigate and manage your files.',
    },
    async () => {
      return {
        open: () => (window as any).openFileManager && (window as any).openFileManager(),
      };
    }
  );

  appRegistry.register(
    {
      id: 'terminal',
      name: 'Terminal',
      icon: '/icons/apps/konsole.png',
      category: 'System',
      description: 'Unix terminal emulator.',
    },
    async () => {
      return {
        open: () => (window as any).TerminalLab?.open(),
      };
    }
  );

  // 5. Help
  appRegistry.register(
    {
      id: 'man-viewer',
      name: 'Man Pages',
      icon: '/icons/apps/man.png',
      category: 'Help',
      description: 'Unix manual page viewer.',
    },
    async () => {
      return {
        open: () => (window as any).ManViewer?.open(),
      };
    }
  );

  appRegistry.register(
    {
      id: 'process-monitor',
      name: 'Process Monitor',
      icon: '/icons/apps/org.xfce.taskmanager.png',
      category: 'System',
      description: 'View running processes.',
    },
    async () => ({
      open: () =>
        (window as any).openTaskManagerInTerminal && (window as any).openTaskManagerInTerminal(),
    })
  );

  // 6. Utilities
  appRegistry.register(
    {
      id: 'share-theme',
      name: 'Share Theme',
      icon: '/icons/apps/org.xfce.PanelProfiles.png',
      category: 'Utilities',
      description: 'Share your current theme.',
    },
    async () => ({
      open: () =>
        (window as any).shareThemeToDiscussions && (window as any).shareThemeToDiscussions(),
    })
  );

  // 7. Preferences
  appRegistry.register(
    {
      id: 'style-manager',
      name: 'Style Manager',
      icon: '/icons/apps/org.xfce.settings.manager.png',
      category: 'Preferences',
      description: 'Customize the desktop style.',
    },
    async () => ({ open: () => (window as any).styleManager?.openMain() })
  );

  appRegistry.register(
    {
      id: 'style-color',
      name: 'Color',
      icon: '/icons/apps/org.xfce.settings.appearance.png',
      category: 'Preferences',
      description: 'Customize desktop colors.',
    },
    async () => ({ open: () => (window as any).styleManager?.openColor() })
  );

  appRegistry.register(
    {
      id: 'style-font',
      name: 'Font',
      icon: '/icons/mimetypes/font-x-generic.png',
      category: 'Preferences',
      description: 'Customize desktop fonts.',
    },
    async () => ({ open: () => (window as any).styleManager?.openFont() })
  );

  appRegistry.register(
    {
      id: 'style-backdrop',
      name: 'Backdrop',
      icon: '/icons/places/desktop.png',
      category: 'Preferences',
      description: 'Customize desktop backdrop.',
    },
    async () => ({ open: () => (window as any).styleManager?.openBackdrop() })
  );

  appRegistry.register(
    {
      id: 'style-mouse',
      name: 'Mouse',
      icon: '/icons/apps/org.xfce.settings.mouse.png',
      category: 'Preferences',
      description: 'Customize mouse behavior.',
    },
    async () => ({ open: () => (window as any).styleManager?.openMouse() })
  );

  appRegistry.register(
    {
      id: 'style-keyboard',
      name: 'Keyboard',
      icon: '/icons/apps/org.xfce.settings.keyboard.png',
      category: 'Preferences',
      description: 'Customize keyboard settings.',
    },
    async () => ({ open: () => (window as any).styleManager?.openKeyboard() })
  );

  appRegistry.register(
    {
      id: 'style-window',
      name: 'Window',
      icon: '/icons/apps/org.xfce.xfwm4.png',
      category: 'Preferences',
      description: 'Customize window behavior.',
    },
    async () => ({ open: () => (window as any).styleManager?.openWindow() })
  );

  appRegistry.register(
    {
      id: 'style-beep',
      name: 'Beep',
      icon: '/icons/devices/audio-volume-low.png',
      category: 'Preferences',
      description: 'Customize system sounds.',
    },
    async () => ({ open: () => (window as any).styleManager?.openBeep() })
  );

  appRegistry.register(
    {
      id: 'style-screen',
      name: 'Screen',
      icon: '/icons/devices/display.png',
      category: 'Preferences',
      description: 'Customize screen settings.',
      hidden: true, // Sub-panel only
    },
    async () => ({ open: () => (window as any).styleManager?.openScreen() })
  );

  appRegistry.register(
    {
      id: 'style-startup',
      name: 'Startup',
      icon: '/icons/system/gcr-key.png',
      category: 'Preferences',
      description: 'Customize startup behaviors.',
      hidden: true, // Sub-panel only
    },
    async () => ({ open: () => (window as any).styleManager?.openStartup() })
  );

  logger.log('[AppRegistry] Built-in applications registered');
}
