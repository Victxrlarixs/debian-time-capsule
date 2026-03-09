import { logger } from '../../utilities/logger';
import { AudioManager } from '../audiomanager';

/**
 * Manages virtual workspaces (4 spaces)
 */
export class WorkspaceManager {
  private currentWorkspace: string = '1';

  public getCurrentWorkspace(): string {
    return this.currentWorkspace;
  }

  public switchWorkspace(id: string): void {
    if (id === this.currentWorkspace) return;

    AudioManager.click();
    logger.log(`[WorkspaceManager] Switching from workspace ${this.currentWorkspace} to ${id}`);

    const windows = document.querySelectorAll('.window, .cde-retro-modal');
    const previousWorkspace = this.currentWorkspace;

    // Hide all windows of current workspace and remember which ones were open
    windows.forEach((win) => {
      const el = win as HTMLElement;
      const winWorkspace = el.getAttribute('data-workspace');

      if (winWorkspace === previousWorkspace) {
        const isVisible = window.getComputedStyle(el).display !== 'none';
        if (isVisible) {
          el.setAttribute('data-was-opened', 'true');
          el.style.display = 'none';
        }
      }
    });

    // Update current workspace
    this.currentWorkspace = id;

    // Show windows that belong to new workspace
    windows.forEach((win) => {
      const el = win as HTMLElement;
      const winWorkspace = el.getAttribute('data-workspace');

      if (winWorkspace === this.currentWorkspace) {
        if (el.getAttribute('data-was-opened') === 'true') {
          el.style.display = 'flex';
          logger.log(`[WorkspaceManager] Showing ${el.id} in WS ${this.currentWorkspace}`);
        }
      } else {
        if (window.getComputedStyle(el).display !== 'none') {
          el.style.display = 'none';
        }
      }
    });

    // Update pager UI
    this.updatePagerUI(id);

    logger.log(
      `[WorkspaceManager] Workspace switch complete: ${previousWorkspace} -> ${this.currentWorkspace}`
    );
  }

  public assignWorkspaceToWindow(win: HTMLElement): void {
    if (!win.getAttribute('data-workspace')) {
      win.setAttribute('data-workspace', this.currentWorkspace);
      logger.log(`[WorkspaceManager] Assigned workspace ${this.currentWorkspace} to ${win.id}`);
    }
  }

  private updatePagerUI(activeWorkspace: string): void {
    const pagerItems = document.querySelectorAll('.pager-workspace');
    pagerItems.forEach((item) => {
      if ((item as HTMLElement).dataset.workspace === activeWorkspace) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  public initPager(): void {
    const pagerItems = document.querySelectorAll('.pager-workspace');
    pagerItems.forEach((item) => {
      item.addEventListener('click', () => {
        const ws = (item as HTMLElement).dataset.workspace;
        if (ws) this.switchWorkspace(ws);
      });
    });
  }
}
