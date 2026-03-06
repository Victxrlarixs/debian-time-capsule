import { CONFIG } from '../config';
import { logger } from '../../utilities/logger';

/**
 * Manages window positioning (centering, normalization)
 */
export class WindowPositionManager {
  private isMobile(): boolean {
    return window.innerWidth < 768;
  }

  /**
   * Centers a window in the viewport
   */
  public centerWindow(win: HTMLElement): void {
    const winWidth = win.offsetWidth;
    const winHeight = win.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const TOP_BAR_HEIGHT = CONFIG.WINDOW.TOP_BAR_HEIGHT;
    const PANEL_HEIGHT = this.isMobile() ? 65 : 85;

    let left = (viewportWidth - winWidth) / 2;
    let top = (viewportHeight - winHeight) / 2;

    const minX = 0;
    const maxX = Math.max(0, viewportWidth - winWidth);
    const minY = TOP_BAR_HEIGHT;
    const maxY = Math.max(minY, viewportHeight - winHeight - PANEL_HEIGHT);

    left = Math.max(minX, Math.min(left, maxX));
    top = Math.max(minY, Math.min(top, maxY));

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    win.style.position = 'absolute';
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    win.style.transform = 'none';
    win.style.margin = '0';

    logger.log(`[WindowPositionManager] Centered window "${win.id}" at ${win.style.left}, ${win.style.top}`);
  }

  /**
   * Normalizes a window's position to ensure it is draggable and within viewport
   */
  public normalizeWindowPosition(win: HTMLElement): void {
    if (window.getComputedStyle(win).display === 'none') {
      return;
    }

    const rect = win.getBoundingClientRect();
    const TOP_BAR_HEIGHT = CONFIG.WINDOW.TOP_BAR_HEIGHT;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    win.style.position = 'absolute';

    const minY = TOP_BAR_HEIGHT;
    const minX = 0;
    const maxX = Math.max(0, viewportWidth - rect.width);
    const maxY = Math.max(minY, viewportHeight - rect.height);

    let newTop = Math.max(rect.top, minY);
    newTop = Math.min(newTop, maxY);

    let newLeft = Math.max(rect.left, minX);
    newLeft = Math.min(newLeft, maxX);

    // Force centering on mobile
    if (this.isMobile()) {
      newLeft = (viewportWidth - rect.width) / 2;
      newTop = (viewportHeight - rect.height) / 2;
    }

    win.style.top = Math.max(minY, Math.min(maxY, newTop)) + 'px';
    win.style.left = Math.max(0, Math.min(maxX, newLeft)) + 'px';
    win.style.transform = 'none';

    logger.log(`[WindowPositionManager] Normalized "${win.id}" to top: ${win.style.top}, left: ${win.style.left}`);
  }

  /**
   * Normalizes all visible windows on viewport resize
   */
  public normalizeAllWindows(): void {
    logger.log('[WindowPositionManager] Normalizing all window positions...');
    document.querySelectorAll('.window, .cde-retro-modal').forEach((win) => {
      if (win instanceof HTMLElement) {
        if (this.isMobile()) {
          this.centerWindow(win);
        } else {
          this.normalizeWindowPosition(win);
        }
      }
    });
  }
}
