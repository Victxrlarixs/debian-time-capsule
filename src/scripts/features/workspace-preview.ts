// src/scripts/features/workspace-preview.ts

import { logger } from '../utilities/logger';

/**
 * Workspace Preview Manager
 * Generates miniature previews of each workspace showing open windows
 */

interface WindowInfo {
  id: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export class WorkspacePreview {
  private previewContainer: HTMLElement | null = null;
  private currentHoveredWorkspace: string | null = null;
  private previewTimeout: number | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    // Create preview container
    this.previewContainer = document.createElement('div');
    this.previewContainer.id = 'workspace-preview-container';
    this.previewContainer.className = 'workspace-preview-container';
    document.body.appendChild(this.previewContainer);

    // Attach hover listeners to pager items
    this.attachPagerListeners();

    logger.log('[WorkspacePreview] Initialized');
  }

  private attachPagerListeners(): void {
    const pagerItems = document.querySelectorAll('.pager-workspace');

    pagerItems.forEach((item) => {
      const workspaceId = (item as HTMLElement).dataset.workspace;
      if (!workspaceId) return;

      item.addEventListener('mouseenter', () => {
        this.previewTimeout = window.setTimeout(() => {
          this.showPreview(workspaceId, item as HTMLElement);
        }, 300); // 300ms delay before showing preview
      });

      item.addEventListener('mouseleave', () => {
        if (this.previewTimeout) {
          clearTimeout(this.previewTimeout);
          this.previewTimeout = null;
        }
        this.hidePreview();
      });
    });
  }

  private showPreview(workspaceId: string, pagerItem: HTMLElement): void {
    if (!this.previewContainer) return;

    this.currentHoveredWorkspace = workspaceId;

    // Get windows in this workspace
    const windows = this.getWorkspaceWindows(workspaceId);

    // Generate preview
    const preview = this.generatePreview(workspaceId, windows);

    // Position preview above pager item
    const rect = pagerItem.getBoundingClientRect();
    const previewWidth = 200; // Compact width
    const previewHeight = 150; // Compact height

    // Center horizontally relative to pager item
    const left = rect.left + rect.width / 2 - previewWidth / 2;

    this.previewContainer.style.left = `${left}px`;
    this.previewContainer.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    this.previewContainer.style.width = `${previewWidth}px`;

    // Set content and show
    this.previewContainer.innerHTML = preview;
    this.previewContainer.classList.add('visible');

    logger.log(
      `[WorkspacePreview] Showing preview for workspace ${workspaceId} with ${windows.length} windows`
    );
  }

  private hidePreview(): void {
    if (!this.previewContainer) return;

    this.previewContainer.classList.remove('visible');
    this.currentHoveredWorkspace = null;
  }

  private getWorkspaceWindows(workspaceId: string): WindowInfo[] {
    const windows: WindowInfo[] = [];
    const windowElements = document.querySelectorAll('.window, .cde-retro-modal');

    windowElements.forEach((el) => {
      const element = el as HTMLElement;
      const ws = element.getAttribute('data-workspace');
      const wasOpened = element.getAttribute('data-was-opened');

      if (ws === workspaceId && wasOpened === 'true') {
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);

        windows.push({
          id: element.id,
          title: this.getWindowTitle(element),
          icon: this.getWindowIcon(element.id),
          x: parseInt(element.style.left || '0'),
          y: parseInt(element.style.top || '0'),
          width: rect.width,
          height: rect.height,
          zIndex: parseInt(computedStyle.zIndex || '0'),
        });
      }
    });

    // Sort by z-index (bottom to top)
    return windows.sort((a, b) => a.zIndex - b.zIndex);
  }

  private getWindowIcon(windowId: string): string {
    const iconMap: Record<string, string> = {
      emacs: '/icons/apps/xemacs.png',
      'terminal-lab': '/icons/apps/konsole.png',
      fm: '/icons/apps/filemanager.png',
      netscape: '/icons/apps/netscape_classic.png',
      styleManagerMain: '/icons/apps/org.xfce.settings.manager.png',
      styleManagerColor: '/icons/apps/org.xfce.settings.appearance.png',
      styleManagerFont: '/icons/mimetypes/font-x-generic.png',
      styleManagerBackdrop: '/icons/places/desktop.png',
      styleManagerMouse: '/icons/apps/org.xfce.settings.mouse.png',
      styleManagerKeyboard: '/icons/apps/org.xfce.settings.keyboard.png',
      styleManagerWindow: '/icons/apps/org.xfce.xfwm4.png',
      styleManagerScreen: '/icons/devices/display.png',
      styleManagerBeep: '/icons/devices/audio-volume-low.png',
      styleManagerStartup: '/icons/apps/org.xfce.session.png',
      'process-monitor': '/icons/apps/org.xfce.taskmanager.png',
      'calendar-window': '/icons/system/calendar.png',
      appManager: '/icons/system/applications-other.png',
    };

    return iconMap[windowId] || '/icons/mimetypes/gtk-file.png';
  }

  private getWindowTitle(element: HTMLElement): string {
    const titleBar = element.querySelector('.titlebar-title');
    return titleBar?.textContent?.trim() || 'Untitled';
  }

  private generatePreview(workspaceId: string, windows: WindowInfo[]): string {
    const scale = 0.1;
    const previewWidth = 200;
    const previewHeight = 120;

    let windowsHTML = '';

    if (windows.length === 0) {
      windowsHTML = '<div class="preview-empty">Empty</div>';
    } else {
      windows.forEach((win) => {
        const scaledX = Math.max(0, Math.min(win.x * scale, previewWidth - 20));
        const scaledY = Math.max(0, Math.min(win.y * scale, previewHeight - 15));
        const scaledWidth = Math.max(20, Math.min(win.width * scale, previewWidth - scaledX));
        const scaledHeight = Math.max(15, Math.min(win.height * scale, previewHeight - scaledY));

        windowsHTML += `
          <div class="preview-window" style="
            left: ${scaledX}px;
            top: ${scaledY}px;
            width: ${scaledWidth}px;
            height: ${scaledHeight}px;
            z-index: ${win.zIndex};
          " title="${win.title}">
            <div class="preview-window-titlebar"></div>
            <div class="preview-window-content">
              <img src="${win.icon}" alt="${win.title}" class="preview-window-icon" />
            </div>
          </div>
        `;
      });
    }

    return `
      <div class="preview-header">Workspace ${workspaceId}</div>
      <div class="preview-content" style="width: ${previewWidth}px; height: ${previewHeight}px;">
        ${windowsHTML}
      </div>
      <div class="preview-footer">${windows.length} window${windows.length !== 1 ? 's' : ''}</div>
    `;
  }

  public refresh(): void {
    // Refresh preview if currently showing
    if (this.currentHoveredWorkspace) {
      const pagerItem = document.querySelector(
        `.pager-workspace[data-workspace="${this.currentHoveredWorkspace}"]`
      ) as HTMLElement;

      if (pagerItem) {
        this.showPreview(this.currentHoveredWorkspace, pagerItem);
      }
    }
  }

  public destroy(): void {
    if (this.previewContainer) {
      this.previewContainer.remove();
      this.previewContainer = null;
    }

    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }

    logger.log('[WorkspacePreview] Destroyed');
  }
}

// Global instance
let workspacePreviewInstance: WorkspacePreview | null = null;

export function initWorkspacePreview(): void {
  if (!workspacePreviewInstance) {
    workspacePreviewInstance = new WorkspacePreview();
  }
}

export function getWorkspacePreview(): WorkspacePreview | null {
  return workspacePreviewInstance;
}
