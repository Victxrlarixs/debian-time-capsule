import { logger } from '../../utilities/logger';
import { AudioManager } from '../audiomanager';
import type { ZIndexManager } from './z-index-manager';

/**
 * Manages window focus and active state
 */
export class WindowFocusManager {
  private lastFocusedWindowId: string | null = null;
  private zIndexManager: ZIndexManager;
  private isDragging: () => boolean;

  constructor(zIndexManager: ZIndexManager, isDragging: () => boolean) {
    this.zIndexManager = zIndexManager;
    this.isDragging = isDragging;
  }

  /**
   * Brings a window to the front and marks it as active
   */
  public focusWindow(id: string): void {
    if (id === this.lastFocusedWindowId) return;

    const win = document.getElementById(id);
    if (!win) return;

    if (!this.isDragging()) {
      if (this.lastFocusedWindowId) {
        const prevWin = document.getElementById(this.lastFocusedWindowId);
        if (prevWin) prevWin.classList.remove('active');
      }

      if (Math.random() < 0.05) {
        // Occasional garbage collection
        document.querySelectorAll('.active').forEach((el) => {
          if (el.id !== id) el.classList.remove('active');
        });
      }

      win.classList.add('active');
      this.lastFocusedWindowId = id;

      const zIndex = this.zIndexManager.getNextZIndex();
      win.style.zIndex = String(zIndex);

      AudioManager.click();
      logger.log(`[WindowFocusManager] Focused: ${id}`);
    }
  }

  public initGlobalInteraction(): void {
    // Focus and sound feedback
    document.addEventListener('pointerdown', (e) => {
      if (this.isDragging()) return;
      const target = e.target as HTMLElement;
      if (!target || typeof target.closest !== 'function') return;

      // Sound feedback
      if (
        target.closest(
          '.cde-icon, .cde-icon-btn, .menu-item, .cde-btn, .pager-workspace, .titlebar-btn'
        )
      ) {
        AudioManager.click();
      }

      // Focus management
      const win = target.closest('.window, .cde-retro-modal');
      if (win) {
        this.focusWindow(win.id);
      }

      // Button visual feedback
      this.handleButtonFeedback(target);
    });

    // Point-to-focus mode
    document.addEventListener(
      'pointerenter',
      (e) => {
        const mode = document.documentElement.getAttribute('data-focus-mode');
        if (mode !== 'point') return;

        const target = e.target as HTMLElement;
        if (!target || typeof target.closest !== 'function') return;

        const win = target.closest('.window, .cde-retro-modal');
        if (win) {
          this.focusWindow(win.id);
        }
      },
      true
    );
  }

  private handleButtonFeedback(target: HTMLElement): void {
    const minBtn = target.closest('.min-btn');
    if (minBtn) {
      const img = minBtn.querySelector('img');
      if (img) {
        const original = img.src;
        img.src = '/icons/ui/shade-toggled-inactive.png';
        const restore = () => {
          img.src = original;
          window.removeEventListener('pointerup', restore);
        };
        window.addEventListener('pointerup', restore);
      }
    }

    const maxBtn = target.closest('.max-btn');
    if (maxBtn) {
      const img = maxBtn.querySelector('img');
      if (img) {
        const original = img.src;
        img.src = '/icons/ui/maximize-toggled-inactive.png';
        const restore = () => {
          img.src = original;
          window.removeEventListener('pointerup', restore);
        };
        window.addEventListener('pointerup', restore);
      }
    }
  }
}
