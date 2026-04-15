import { logger } from '../utilities/logger';
import { WindowManager } from '../core/windowmanager';
import { appRegistry } from '../core/app-registry';
import type { AppCategory, AppManifest } from '../core/interfaces/application.interface';

export class AppManager {
  private id = 'appManager';
  private currentView: 'main' | string = 'main';

  constructor() {
    this.init();
  }

  private init(): void {
    logger.log('[AppManager] Initializing dynamic system...');

    const menuBtn = document.querySelector('.cde-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    }

    this.setupNavigation();
    this.setupMenuBar();
  }

  private setupMenuBar(): void {
    setTimeout(() => {
      const menuButtons = document.querySelectorAll('#appManager .menu-button');
      menuButtons.forEach((button) => {
        const buttonText = button.textContent?.trim();
        button.addEventListener('click', () => {
          if (buttonText === 'File') this.close();
        });
      });
    }, 100);
  }

  private setupNavigation(): void {
    // Handle folder clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const groupItem = target.closest('.app-group-item') as HTMLElement;

      if (groupItem && groupItem.dataset.group) {
        this.openGroup(groupItem.dataset.group as AppCategory);
      }
    });

    // Handle back button clicks (delegated)
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.go-up-item')) {
        this.goBack();
      }
    });
  }

  private renderAppItem(manifest: AppManifest): string {
    return `
      <div class="app-action-item" data-app-id="${manifest.id}">
        <img src="${manifest.icon}" alt="${manifest.name}" class="action-icon" />
        <span>${manifest.name}</span>
      </div>
    `;
  }

  private openGroup(category: AppCategory): void {
    const mainView = document.getElementById('appManagerMainView');
    const dynamicView = document.getElementById('appGroupDynamicView');
    const statusLeft = document.getElementById('appManagerStatus');
    const statusRight = document.getElementById('appManagerPath');

    if (mainView && dynamicView) {
      const apps = appRegistry.getManifestsByCategory(category);

      // Build internal HTML
      let html = `
        <div class="app-action-item go-up-item">
          <img src="/icons/actions/go-up.png" alt="Go Up" class="action-icon" />
          <span>.. (go up)</span>
        </div>
      `;

      html += apps.map((app) => this.renderAppItem(app)).join('');

      dynamicView.innerHTML = html;

      // Add event listeners to app items
      dynamicView.querySelectorAll('.app-action-item[data-app-id]').forEach((el) => {
        el.addEventListener('click', () => {
          const id = (el as HTMLElement).dataset.appId;
          if (id) {
            appRegistry.launch(id);
            if (window.innerWidth < 768) this.close();
          }
        });
      });

      // UI Swapping
      mainView.style.display = 'none';
      dynamicView.style.display = 'grid';

      this.currentView = category;

      // Status Updates
      if (statusLeft) statusLeft.textContent = `${apps.length} Items`;
      if (statusRight) statusRight.textContent = `/var/dt/appconfig/appmanager/C/${category}`;

      // Window Title
      const titlebar = document.querySelector('#appManagerTitlebar .titlebar-text');
      if (titlebar) titlebar.textContent = `Application Manager - ${category}`;

      logger.log(`[AppManager] Rendered category: ${category}`);
    }
  }

  public goBack(): void {
    if (this.currentView === 'main') return;

    this.goBackToMain();
  }

  private goBackToMain(): void {
    const mainView = document.getElementById('appManagerMainView');
    const dynamicView = document.getElementById('appGroupDynamicView');
    const statusLeft = document.getElementById('appManagerStatus');
    const statusRight = document.getElementById('appManagerPath');
    const titlebar = document.querySelector('#appManagerTitlebar .titlebar-text');

    if (mainView && dynamicView) {
      dynamicView.style.display = 'none';
      mainView.style.display = 'grid';
      this.currentView = 'main';

      const folderCount = mainView.querySelectorAll('.app-group-item').length;
      if (statusLeft) statusLeft.textContent = `${folderCount} Folders`;
      if (statusRight) statusRight.textContent = '/var/dt/appconfig/appmanager/C';
      if (titlebar) titlebar.textContent = 'Application Manager';

      logger.log('[AppManager] Returned to main menu');
    }
  }

  public open(): void {
    const win = document.getElementById(this.id);
    if (win) {
      this.goBackToMain();
      win.style.display = 'flex';

      requestAnimationFrame(() => {
        WindowManager.centerWindow(win);
        if (window.focusWindow) window.focusWindow(this.id);
      });

      if (window.AudioManager) window.AudioManager.windowOpen();
    }
  }

  public close(): void {
    const win = document.getElementById(this.id);
    if (win) {
      win.style.display = 'none';
      if (window.AudioManager) window.AudioManager.windowClose();
    }
  }
}

if (typeof window !== 'undefined') {
  window.appManager = new AppManager();
}
