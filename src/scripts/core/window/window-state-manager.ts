import { logger } from '../../utilities/logger';
import { AudioManager } from '../audiomanager';
import type { ISessionStorage } from '../interfaces/window-manager.interface';

/**
 * WindowState: Stores previous state of windows to restore position and size
 */
interface WindowState {
  display?: string;
  left?: string;
  top?: string;
  width?: string;
  height?: string;
  maximized: boolean;
}

/**
 * WindowStateManager: Manages window states (maximize, minimize, shade)
 * Extracted from WindowManager to follow SRP
 */
export class WindowStateManager {
  private windowStates: Record<string, WindowState> = {};

  constructor(private sessionStorage: ISessionStorage) {}

  /**
   * Minimizes a window
   */
  public minimizeWindow(id: string): void {
    const win = document.getElementById(id);
    if (!win) return;

    if (win.style.display !== 'none') {
      this.windowStates[id] = {
        display: win.style.display,
        left: win.style.left,
        top: win.style.top,
        width: win.style.width,
        height: win.style.height,
        maximized: win.classList.contains('maximized'),
      };

      win.classList.add('window-closing');
      if (window.AudioManager) window.AudioManager.windowMinimize();

      win.addEventListener(
        'animationend',
        () => {
          win.style.display = 'none';
          win.classList.remove('window-closing');
        },
        { once: true }
      );
    }
  }

  /**
   * Shades/unshades a window (CDE behavior)
   */
  public shadeWindow(id: string): void {
    const win = document.getElementById(id);
    if (!win) return;

    const titlebar = win.querySelector('.titlebar') as HTMLElement;
    if (!titlebar) return;

    const isMaximized = win.classList.contains('maximized');

    if (win.classList.contains('shaded')) {
      // Unshade
      win.classList.remove('shaded');

      if (isMaximized) {
        win.style.height = '';
      } else if (this.windowStates[id]?.height) {
        win.style.height = this.windowStates[id].height!;
      }

      if (window.AudioManager) window.AudioManager.windowShade();
      logger.log(`[WindowStateManager] Window "${id}" unshaded`);
    } else {
      // Shade
      if (!isMaximized) {
        this.windowStates[id] = {
          ...this.windowStates[id],
          height: win.style.height || getComputedStyle(win).height,
        };
      }

      win.classList.add('shaded');
      win.style.height = titlebar.offsetHeight + 'px';

      if (window.AudioManager) window.AudioManager.windowShade();
      logger.log(`[WindowStateManager] Window "${id}" shaded`);
    }
  }

  /**
   * Maximizes/restores a window
   */
  public maximizeWindow(id: string, focusCallback: (id: string) => void): void {
    const win = document.getElementById(id);
    if (!win || win.hasAttribute('data-no-maximize')) return;

    if (win.classList.contains('maximized')) {
      // Restore
      win.classList.remove('maximized');
      if (window.AudioManager) window.AudioManager.windowMaximize();

      const maxBtnImg = win.querySelector('.max-btn img') as HTMLImageElement;
      if (maxBtnImg) maxBtnImg.src = '/icons/ui/maximize-inactive.png';

      if (this.windowStates[id]) {
        win.style.left = this.windowStates[id].left || '';
        win.style.top = this.windowStates[id].top || '';
        win.style.width = this.windowStates[id].width || '';
        win.style.height = this.windowStates[id].height || '';
      }
      focusCallback(id);

      this.sessionStorage.saveWindowState(id, {
        left: win.style.left,
        top: win.style.top,
        display: win.style.display,
        maximized: false,
      });
      logger.log(`[WindowStateManager] Window "${id}" restored`);
    } else {
      // Maximize
      this.windowStates[id] = {
        left: win.style.left,
        top: win.style.top,
        width: win.style.width,
        height: win.style.height,
        maximized: false,
      };
      win.classList.add('maximized');
      if (window.AudioManager) window.AudioManager.windowMaximize();

      const maxBtnImg = win.querySelector('.max-btn img') as HTMLImageElement;
      if (maxBtnImg) maxBtnImg.src = '/icons/ui/maximize-toggled-inactive.png';

      focusCallback(id);

      this.sessionStorage.saveWindowState(id, {
        left: win.style.left,
        top: win.style.top,
        display: win.style.display,
        maximized: true,
      });
      logger.log(`[WindowStateManager] Window "${id}" maximized`);
    }
  }
}
