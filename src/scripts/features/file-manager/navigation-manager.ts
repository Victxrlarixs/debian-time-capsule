import { CONFIG } from '../../core/config';

/**
 * Manages navigation history, breadcrumbs, and path input.
 */
export class NavigationManager {
  private history: string[] = [];
  private historyIndex: number = -1;
  private currentPath: string = CONFIG.FS.HOME;

  public getCurrentPath(): string {
    return this.currentPath;
  }

  public navigate(path: string): void {
    if (this.history.length > 0 && this.history[this.historyIndex] === path) return;

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(path);
    this.historyIndex++;
    this.currentPath = path;
  }

  public goBack(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.currentPath = this.history[this.historyIndex];
      return true;
    }
    return false;
  }

  public goForward(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.currentPath = this.history[this.historyIndex];
      return true;
    }
    return false;
  }

  public goUp(): string | null {
    const parts = this.currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      return '/' + parts.join('/') + (parts.length > 0 ? '/' : '');
    }
    return null;
  }

  public goHome(): string {
    return CONFIG.FS.HOME;
  }

  public canGoBack(): boolean {
    return this.historyIndex > 0;
  }

  public canGoForward(): boolean {
    return this.historyIndex < this.history.length - 1;
  }

  public renderBreadcrumbs(onNavigate: (path: string) => void): void {
    const container = document.getElementById('fmBreadcrumbs');
    if (!container) return;

    const parts = this.currentPath.split('/').filter(Boolean);
    const fragment = document.createDocumentFragment();

    const root = document.createElement('span');
    root.className = 'fm-breadcrumb-segment';
    root.textContent = '/';
    root.onclick = (e) => {
      e.stopPropagation();
      onNavigate('/');
    };
    fragment.appendChild(root);

    let full = '/';
    parts.forEach(() => {
      const sep = document.createElement('span');
      sep.className = 'fm-breadcrumb-separator';
      sep.textContent = '>';
      fragment.appendChild(sep);

      full += parts.shift() + '/';
      const segment = document.createElement('span');
      segment.className = 'fm-breadcrumb-segment';
      segment.textContent =
        parts.length > 0
          ? full.split('/').filter(Boolean).pop() || ''
          : full.split('/').filter(Boolean).pop() || '';
      const thisPath = full;
      segment.onclick = (e) => {
        e.stopPropagation();
        onNavigate(thisPath);
      };
      fragment.appendChild(segment);
    });

    container.replaceChildren(fragment);
  }

  public updatePathInput(): void {
    const pathInput = document.getElementById('fmPath') as HTMLInputElement | null;
    if (pathInput) {
      pathInput.value = this.currentPath;
    }
  }

  public togglePathInput(show: boolean): void {
    const breadcrumbs = document.getElementById('fmBreadcrumbs');
    const pathInput = document.getElementById('fmPath');
    if (!breadcrumbs || !pathInput) return;

    if (show) {
      breadcrumbs.classList.add('fm-hidden');
      pathInput.classList.remove('fm-hidden');
      (pathInput as HTMLInputElement).value = this.currentPath;
      pathInput.focus();
    } else {
      breadcrumbs.classList.remove('fm-hidden');
      pathInput.classList.add('fm-hidden');
    }
  }
}
