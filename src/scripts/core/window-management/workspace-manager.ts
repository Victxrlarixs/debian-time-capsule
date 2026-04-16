import { logger } from '../../utilities/logger';
import { AudioManager } from '../audiomanager';
import { $currentWorkspace } from '../../stores/workspace.store';

/**
 * Manages virtual workspaces (4 spaces)
 */
export class WorkspaceManager {
  // No longer stores state locally — truth lives in the NanoStore
  public getCurrentWorkspace(): string {
    return $currentWorkspace.get();
  }

  public switchWorkspace(id: string): void {
    const previousWorkspace = $currentWorkspace.get();
    if (id === previousWorkspace) return;

    AudioManager.click();
    logger.log(`[WorkspaceManager] Switching from workspace ${previousWorkspace} to ${id}`);

    const windows = document.querySelectorAll('.window, .cde-retro-modal');

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

    // Update reactive state — all subscribers will react automatically
    $currentWorkspace.set(id);

    // Show windows that belong to new workspace
    windows.forEach((win) => {
      const el = win as HTMLElement;
      const winWorkspace = el.getAttribute('data-workspace');

      if (winWorkspace === id) {
        if (el.getAttribute('data-was-opened') === 'true') {
          el.style.display = 'flex';
          logger.log(`[WorkspaceManager] Showing ${el.id} in WS ${id}`);
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
      `[WorkspaceManager] Workspace switch complete: ${previousWorkspace} -> ${id}`
    );
  }

  public assignWorkspaceToWindow(win: HTMLElement): void {
    const current = $currentWorkspace.get();
    if (!win.getAttribute('data-workspace')) {
      win.setAttribute('data-workspace', current);
      logger.log(`[WorkspaceManager] Assigned workspace ${current} to ${win.id}`);
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
