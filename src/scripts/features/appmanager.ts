import { logger } from '../utilities/logger';
import { WindowManager } from '../core/windowmanager';

export class AppManager {
  private id = 'appManager';

  constructor() {
    this.init();
  }

  private init(): void {
    logger.log('[AppManager] Initializing...');

    // Bind the menu button if it exists
    const menuBtn = document.querySelector('.cde-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
      logger.log('[AppManager] Menu button listener attached');
    }
  }

  public open(): void {
    const win = document.getElementById(this.id);
    if (win) {
      win.style.display = 'flex';
      win.style.zIndex = '10000';

      requestAnimationFrame(() => {
        WindowManager.centerWindow(win);
        if (window.focusWindow) {
          window.focusWindow(this.id);
        }
      });

      if (window.AudioManager) {
        window.AudioManager.windowOpen();
      }

      logger.log('[AppManager] Window opened');
    }
  }

  public close(): void {
    const win = document.getElementById(this.id);
    if (win) {
      win.style.display = 'none';

      if (window.AudioManager) {
        window.AudioManager.windowClose();
      }

      logger.log('[AppManager] Window closed');
    }
  }
}

// Global exposure
if (typeof window !== 'undefined') {
  window.appManager = new AppManager();
}
