import { logger } from '../../utilities/logger';
import { AudioManager } from '../audiomanager';

/**
 * WorkspaceManager: Manages virtual workspaces (4 spaces)
 * Extracted from WindowManager to follow SRP
 */
export class WorkspaceManager {
  private currentWorkspace: string = '1';

  /**
   * Gets the current active workspace
   */
  public getCurrentWorkspace(): string {
    return this.currentWorkspace;
  }

  /**
   * Switches to a different workspace
   */
  public switchWorkspace(id: string): void {
    if (id === this.currentWorkspace) return;

    AudioManager.click();
    logger.log(`[WorkspaceManager] Switching from workspace ${this.currentWorkspace} to ${id}`);

    const windows = document.querySelectorAll('.window, .cde-retro-modal');

    // Hide all windows of current workspace and remember which ones were open
    windows.forEach((win) => {
      const el = win as HTMLElement;
      const winWorkspace = el.getAttribute('data-workspace');

      if (winWorkspace === this.currentWorkspace) {
        const isVisible = window.getComputedStyle(el).display !== 'none';
        if (isVisible) {
          el.setAttribute('data-was-opened', 'true');
          el.style.display = 'none';
        }
      }
    });

    const previousWorkspace = this.currentWorkspace;
    this.currentWorkspace = id;

    // Show windows that belong to new workspace
    windows.forEach((win) => {
      const el = win as HTMLElement;
      const winWorkspace = el.getAttribute('data-workspace');

      if (winWorkspace === this.currentWorkspace) {
        if (el.getAttribute('data-was-opened') === 'true') {
          el.style.display = 'flex';
        }
      } else {
        if (window.getComputedStyle(el).display !== 'none') {
          el.style.display = 'none';
        }
      }
    });

    // Update pager UI
    const pagerItems = document.querySelectorAll('.pager-workspace');
    pagerItems.forEach((item) => {
      if ((item as HTMLElement).dataset.workspace === id) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    logger.log(`[WorkspaceManager] Workspace switch complete: ${previousWorkspace} -> ${this.currentWorkspace}`);
  }

  /**
   * Assigns a workspace to a window if not already assigned
   */
  public assignWorkspaceIfNeeded(win: HTMLElement): void {
    if (!win.getAttribute('data-workspace')) {
      win.setAttribute('data-workspace', this.currentWorkspace);
      logger.log(`[WorkspaceManager] Assigned workspace ${this.currentWorkspace} to ${win.id}`);
    }
  }
}
