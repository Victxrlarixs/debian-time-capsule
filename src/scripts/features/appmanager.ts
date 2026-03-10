import { logger } from '../utilities/logger';
import { WindowManager } from '../core/windowmanager';

export class AppManager {
  private id = 'appManager';
  private currentView: 'main' | string = 'main';
  private breadcrumb: string[] = [];

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

    // Setup folder navigation
    this.setupNavigation();
    
    // Setup menu bar
    this.setupMenuBar();
  }

  private setupMenuBar(): void {
    // Wait for DOM to be ready
    setTimeout(() => {
      const menuButtons = document.querySelectorAll('#appManager .menu-button');
      
      menuButtons.forEach((button) => {
        const buttonText = button.textContent?.trim();
        
        button.addEventListener('click', () => {
          switch (buttonText) {
            case 'File':
              // File menu: Close window
              logger.log('[AppManager] File menu - Close');
              break;
            case 'Selected':
              // Selected menu: Actions on selected items
              logger.log('[AppManager] Selected menu clicked');
              break;
            case 'View':
              // View menu: Update, Set Preferences, etc
              logger.log('[AppManager] View menu clicked');
              break;
          }
        });
      });
    }, 100);
  }

  private setupNavigation(): void {
    // Handle folder double-clicks
    document.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      const groupItem = target.closest('.app-group-item') as HTMLElement;
      
      if (groupItem && groupItem.dataset.group) {
        this.openGroup(groupItem.dataset.group);
      }
    });

    // Handle back navigation (could be triggered by a back button if added)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && this.currentView !== 'main') {
        const win = document.getElementById(this.id);
        if (win && win.style.display !== 'none') {
          e.preventDefault();
          this.goBack();
        }
      }
    });
  }

  private openGroup(groupName: string): void {
    const mainView = document.getElementById('appManagerMainView');
    const groupView = document.getElementById(`appGroup_${groupName}`);
    const statusLeft = document.getElementById('appManagerStatus');
    const statusRight = document.getElementById('appManagerPath');

    if (mainView && groupView) {
      // Hide main view
      mainView.style.display = 'none';

      // Show group view
      groupView.style.display = 'grid';

      // Update current view
      this.currentView = groupName;
      this.breadcrumb.push(groupName);

      // Update status bar
      const itemCount = groupView.querySelectorAll('.app-action-item').length;
      if (statusLeft) {
        statusLeft.textContent = `${itemCount} Items`;
      }
      if (statusRight) {
        statusRight.textContent = `/var/dt/appconfig/appmanager/C/${groupName}`;
      }

      // Update window title
      const titlebar = document.querySelector('#appManagerTitlebar .titlebar-text');
      if (titlebar) {
        titlebar.textContent = `Application Manager - ${groupName}`;
      }

      logger.log(`[AppManager] Opened group: ${groupName}`);
    }
  }

  public goBack(): void {
    if (this.currentView === 'main') return;

    const mainView = document.getElementById('appManagerMainView');
    const currentGroupView = document.getElementById(`appGroup_${this.currentView}`);
    const statusLeft = document.getElementById('appManagerStatus');
    const statusRight = document.getElementById('appManagerPath');

    if (mainView && currentGroupView) {
      // Hide current group view
      currentGroupView.style.display = 'none';

      // Show main view
      mainView.style.display = 'grid';

      // Update current view
      this.breadcrumb.pop();
      this.currentView = 'main';

      // Update status bar
      const folderCount = mainView.querySelectorAll('.app-group-item').length;
      if (statusLeft) {
        statusLeft.textContent = `${folderCount} Folders`;
      }
      if (statusRight) {
        statusRight.textContent = '/var/dt/appconfig/appmanager/C';
      }

      // Update window title
      const titlebar = document.querySelector('#appManagerTitlebar .titlebar-text');
      if (titlebar) {
        titlebar.textContent = 'Application Manager';
      }

      logger.log('[AppManager] Returned to main view');
    }
  }

  public open(): void {
    const win = document.getElementById(this.id);
    if (win) {
      // Reset to main view
      this.goBackToMain();

      win.style.display = 'flex';
      // Don't set z-index here - let WindowManager's focus system handle it dynamically

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

  private goBackToMain(): void {
    // Hide all group views
    const groupViews = document.querySelectorAll('.app-group-content');
    groupViews.forEach((view) => {
      (view as HTMLElement).style.display = 'none';
    });

    // Show main view
    const mainView = document.getElementById('appManagerMainView');
    if (mainView) {
      mainView.style.display = 'grid';
    }

    // Reset state
    this.currentView = 'main';
    this.breadcrumb = [];

    // Reset UI elements
    const statusLeft = document.getElementById('appManagerStatus');
    const statusRight = document.getElementById('appManagerPath');
    const titlebar = document.querySelector('#appManagerTitlebar .titlebar-text');

    if (statusLeft) statusLeft.textContent = '7 Folders';
    if (statusRight) statusRight.textContent = '/var/dt/appconfig/appmanager/C';
    if (titlebar) titlebar.textContent = 'Application Manager';
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
