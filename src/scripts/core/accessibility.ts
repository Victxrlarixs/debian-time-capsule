// src/scripts/core/accessibility.ts

import { logger } from '../utilities/logger';
import { AudioManager } from './audiomanager';
import { WindowManager } from './windowmanager';
import { storageAdapter } from '../utilities/storage-adapter';

/**
 * Keyboard shortcut definition
 */
interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  category: string;
}

/**
 * Accessibility Manager for CDE Desktop
 * Handles keyboard navigation, shortcuts, and high contrast mode
 */
class AccessibilityManager {
  private shortcuts: KeyboardShortcut[] = [];
  private focusableElements: HTMLElement[] = [];
  private currentFocusIndex = -1;
  private highContrastMode = false;

  constructor() {
    this.init();
  }

  /**
   * Initialize accessibility features
   */
  public init(): void {
    this.registerGlobalShortcuts();
    this.setupKeyboardNavigation();
    this.loadHighContrastPreference();

    logger.log('[Accessibility] Initialized');
  }

  /**
   * Register a keyboard shortcut
   */
  public registerShortcut(shortcut: KeyboardShortcut): void {
    this.shortcuts.push(shortcut);
    logger.log(`[Accessibility] Registered shortcut: ${this.formatShortcut(shortcut)}`);
  }

  /**
   * Format shortcut for display
   */
  private formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.meta) parts.push('Meta');
    parts.push(shortcut.key.toUpperCase());
    return parts.join('+');
  }

  /**
   * Register global keyboard shortcuts
   */
  private registerGlobalShortcuts(): void {
    // File Manager
    this.registerShortcut({
      key: 'f',
      ctrl: true,
      alt: true,
      action: () => {
        if ((window as any).toggleFileManager) {
          (window as any).toggleFileManager();
        }
      },
      description: 'Toggle File Manager',
      category: 'Applications',
    });

    // XEmacs
    this.registerShortcut({
      key: 'e',
      ctrl: true,
      alt: true,
      action: () => {
        if (window.Emacs) {
          window.Emacs.openSplash();
        }
      },
      description: 'Open XEmacs',
      category: 'Applications',
    });

    // Terminal
    this.registerShortcut({
      key: 't',
      ctrl: true,
      alt: true,
      action: () => {
        if ((window as any).TerminalLab) {
          (window as any).TerminalLab.open();
        }
      },
      description: 'Open Terminal Laboratory',
      category: 'Applications',
    });

    // Lynx
    this.registerShortcut({
      key: 'l',
      ctrl: true,
      alt: true,
      action: () => {
        if ((window as any).Lynx) {
          (window as any).Lynx.open();
        }
      },
      description: 'Open Lynx Browser',
      category: 'Applications',
    });

    // Netscape
    this.registerShortcut({
      key: 'n',
      ctrl: true,
      alt: true,
      action: () => {
        if ((window as any).Netscape) {
          (window as any).Netscape.open();
        }
      },
      description: 'Open Netscape Navigator',
      category: 'Applications',
    });

    // Style Manager
    this.registerShortcut({
      key: 's',
      ctrl: true,
      alt: true,
      action: () => {
        if ((window as any).styleManager) {
          (window as any).styleManager.openMain();
        }
      },
      description: 'Open Style Manager',
      category: 'System',
    });

    // High Contrast Toggle
    this.registerShortcut({
      key: 'h',
      ctrl: true,
      alt: true,
      action: () => {
        this.toggleHighContrast();
      },
      description: 'Toggle High Contrast Mode',
      category: 'Accessibility',
    });

    // Help / Shortcuts
    this.registerShortcut({
      key: '?',
      ctrl: true,
      shift: true,
      action: () => {
        this.showShortcutsHelp();
      },
      description: 'Show Keyboard Shortcuts',
      category: 'Help',
    });

    // Close active window
    this.registerShortcut({
      key: 'w',
      ctrl: true,
      action: () => {
        this.closeActiveWindow();
      },
      description: 'Close Active Window',
      category: 'Window Management',
    });

    // Minimize active window
    this.registerShortcut({
      key: 'm',
      ctrl: true,
      action: () => {
        this.minimizeActiveWindow();
      },
      description: 'Minimize Active Window',
      category: 'Window Management',
    });

    // Workspace switching
    for (let i = 1; i <= 4; i++) {
      this.registerShortcut({
        key: String(i),
        ctrl: true,
        alt: true,
        action: () => {
          WindowManager.switchWorkspace(String(i));
        },
        description: `Switch to Workspace ${i}`,
        category: 'Workspaces',
      });
    }

    this.registerShortcut({
      key: 'c',
      ctrl: true,
      action: () => {}, // Handled by individual components
      description: 'Copy Selected Item',
      category: 'Common',
    });
    this.registerShortcut({
      key: 'v',
      ctrl: true,
      action: () => {}, // Handled by individual components
      description: 'Paste Item',
      category: 'Common',
    });
    this.registerShortcut({
      key: 'x',
      ctrl: true,
      action: () => {}, // Handled by individual components
      description: 'Cut Selected Item',
      category: 'Common',
    });
    this.registerShortcut({
      key: 'Delete',
      action: () => {}, // Handled by individual components
      description: 'Delete Selected Item',
      category: 'Common',
    });

    // Listen for keyboard events
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Allow Escape to blur inputs
      if (e.key === 'Escape') {
        target.blur();
      }
      return;
    }

    // Check for matching shortcut
    for (const shortcut of this.shortcuts) {
      const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

      if (ctrlMatch && altMatch && shiftMatch && metaMatch && keyMatch) {
        e.preventDefault();
        e.stopPropagation();
        shortcut.action();
        if (AudioManager) AudioManager.click();
        return;
      }
    }
  }

  /**
   * Setup keyboard navigation with Tab
   */
  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        this.updateFocusableElements();

        if (this.focusableElements.length === 0) return;

        if (e.shiftKey) {
          // Shift+Tab: previous element
          this.currentFocusIndex--;
          if (this.currentFocusIndex < 0) {
            this.currentFocusIndex = this.focusableElements.length - 1;
          }
        } else {
          // Tab: next element
          this.currentFocusIndex++;
          if (this.currentFocusIndex >= this.focusableElements.length) {
            this.currentFocusIndex = 0;
          }
        }

        const element = this.focusableElements[this.currentFocusIndex];
        if (element) {
          e.preventDefault();
          element.focus();
        }
      }

      // Enter to activate focused element
      if (e.key === 'Enter') {
        const focused = document.activeElement as HTMLElement;
        if (focused && focused.classList.contains('cde-icon')) {
          e.preventDefault();
          focused.click();
        }
      }
    });
  }

  /**
   * Update list of focusable elements
   */
  private updateFocusableElements(): void {
    const selector = `
      .cde-icon,
      .menu-item,
      .cde-btn,
      .titlebar-btn,
      button:not([disabled]),
      input:not([disabled]),
      textarea:not([disabled]),
      select:not([disabled]),
      a[href],
      [tabindex]:not([tabindex="-1"])
    `;

    const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];

    this.focusableElements = elements.filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
  }

  /**
   * Toggle high contrast mode
   */
  public toggleHighContrast(): void {
    this.highContrastMode = !this.highContrastMode;

    if (this.highContrastMode) {
      document.documentElement.classList.add('high-contrast');
      storageAdapter.setItemSync('cde_high_contrast', 'true');
    } else {
      document.documentElement.classList.remove('high-contrast');
      storageAdapter.setItemSync('cde_high_contrast', 'false');
    }

    logger.log(`[Accessibility] High contrast: ${this.highContrastMode}`);
  }

  /**
   * Load high contrast preference
   */
  private loadHighContrastPreference(): void {
    const saved = storageAdapter.getItemSync('cde_high_contrast');
    if (saved === 'true') {
      this.highContrastMode = true;
      document.documentElement.classList.add('high-contrast');
    }
  }

  /**
   * Show keyboard shortcuts help dialog
   */
  public async showShortcutsHelp(): Promise<void> {
    const categories = this.groupShortcutsByCategory();

    let html = '<div class="shortcuts-help">';
    html += `
      <div class="shortcuts-header">
        <img src="/icons/apps/preferences-desktop-keyboard-shortcuts.png" alt="" />
        <div class="shortcuts-header-text">
          <h2>Keyboard Shortcuts</h2>
          <p>Use these shortcuts to navigate the Debian CDE Desktop faster.</p>
        </div>
      </div>
    `;

    html += '<div class="shortcuts-list">';

    for (const [category, shortcuts] of Object.entries(categories)) {
      html += `<h3 class="shortcuts-category">${category}</h3>`;
      html += '<table class="shortcuts-table">';

      for (const shortcut of shortcuts) {
        const keys = this.formatShortcut(shortcut);
        html += `
          <tr>
            <td><kbd>${keys}</kbd></td>
            <td>${shortcut.description}</td>
          </tr>
        `;
      }

      html += '</table>';
    }

    html += '</div></div>';

    // Use the unified CDEModal system
    if ((window as any).CDEModal) {
      (window as any).CDEModal.open('Keyboard Shortcuts', html, [
        { label: 'Accept', value: true, isDefault: true },
      ]);
    } else {
      console.warn(
        '[Accessibility] CDEModal not available, falling back to basic alert (unlikely)'
      );
      this.fallbackShowShortcuts(html);
    }
  }

  /**
   * Basic fallback for showing shortcuts if CDEModal is not ready
   */
  private fallbackShowShortcuts(html: string): void {
    const modal = document.createElement('div');
    modal.className = 'cde-retro-modal';
    modal.id = 'shortcuts-help-modal-fallback';
    modal.innerHTML = `
      <div class="titlebar">
        <span class="titlebar-text">Keyboard Shortcuts</span>
        <div class="close-btn" onclick="this.closest('.cde-retro-modal').remove()">
          <img src="/icons/ui/tab_close.png" alt="Close" />
        </div>
      </div>
      <div class="modal-body" style="padding: 20px;">
        ${html}
      </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    WindowManager.centerWindow(modal);
  }

  /**
   * Group shortcuts by category
   */
  private groupShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
    const groups: Record<string, KeyboardShortcut[]> = {};

    for (const shortcut of this.shortcuts) {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    }

    return groups;
  }

  /**
   * Close the currently active window
   */
  private closeActiveWindow(): void {
    const activeWindow = document.querySelector(
      '.window.active, .cde-retro-modal.active'
    ) as HTMLElement;
    if (activeWindow) {
      const closeBtn = activeWindow.querySelector('.close-btn') as HTMLElement;
      if (closeBtn) {
        closeBtn.click();
      }
    }
  }

  /**
   * Minimize the currently active window
   */
  private minimizeActiveWindow(): void {
    const activeWindow = document.querySelector('.window.active') as HTMLElement;
    if (activeWindow && activeWindow.id) {
      if (window.minimizeWindow) {
        window.minimizeWindow(activeWindow.id);
      }
    }
  }

  /**
   * Get all registered shortcuts
   */
  public getShortcuts(): KeyboardShortcut[] {
    return this.shortcuts;
  }

  /**
   * Check if high contrast mode is enabled
   */
  public isHighContrastEnabled(): boolean {
    return this.highContrastMode;
  }
}

// Global instance
let accessibilityManager: AccessibilityManager | null = null;

if (typeof window !== 'undefined') {
  accessibilityManager = new AccessibilityManager();
  (window as any).AccessibilityManager = accessibilityManager;
}

export default accessibilityManager;
