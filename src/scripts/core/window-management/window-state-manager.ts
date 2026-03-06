import { logger } from '../../utilities/logger';
import { AudioManager } from '../audiomanager';
import type { ISessionStorage } from '../interfaces/window-manager.interface';

interface WindowState {
  display?: string;
  left?: string;
  top?: string;
  width?: string;
  height?: string;
  maximized: boolean;
}

/**
 * Manages window states (minimize, maximize, shade)
 */
export class WindowStateManager {
  private windowStates: Record<string, WindowState> = {};
  private sessionStorage: ISessionStorage;
  private onFocusWindow: (id: string) => void;

  constructor(sessionStorage: ISessionStorage, onFocusWindow: (id: string) => void) {
    this.sessionStorage = sessionStorage;
    this.onFocusWindow = onFocusWindow;
  }

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
      AudioManager.windowMinimize();

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

  public maximizeWindow(id: string): void {
    const win = document.getElementById(id);
    if (!win || win.hasAttribute('data-no-maximize')) return;

    if (win.classList.contains('maximized')) {
      // Restore
      win.classList.remove('maximized');
      AudioManager.windowMaximize();

      const maxBtnImg = win.querySelector('.max-btn img') as HTMLImageElement;
      if (maxBtnImg) maxBtnImg.src = '/icons/ui/maximize-inactive.png';

      if (this.windowStates[id]) {
        win.style.left = this.windowStates[id].left || '';
        win.style.top = this.windowStates[id].top || '';
        win.style.width = this.windowStates[id].width || '';
        win.style.height = this.windowStates[id].height || '';
      }

      this.onFocusWindow(id);

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
      AudioManager.windowMaximize();

      const maxBtnImg = win.querySelector('.max-btn img') as HTMLImageElement;
      if (maxBtnImg) maxBtnImg.src = '/icons/ui/maximize-toggled-inactive.png';

      this.onFocusWindow(id);

      this.sessionStorage.saveWindowState(id, {
        left: win.style.left,
        top: win.style.top,
        display: win.style.display,
        maximized: true,
      });

      logger.log(`[WindowStateManager] Window "${id}" maximized`);
    }
  }

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

      AudioManager.windowShade();
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

      AudioManager.windowShade();
      logger.log(`[WindowStateManager] Window "${id}" shaded`);
    }
  }
}
