import { CONFIG } from '../../core/config';
import { VFS, type VFSFile } from '../../core/vfs';
import { CDEModal } from '../../ui/modals';
import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../../shared/clipboard';
import { createContextMenu, type ContextMenuItem } from '../../shared/context-menu';
import { showProperties } from './file-utils';

/**
 * Manages menu bar and context menus.
 */
export class MenuManager {
  private activeMenu: HTMLElement | null = null;
  private activeContextMenu: HTMLElement | null = null;

  constructor(
    private getCurrentPath: () => string,
    private getSelected: () => string | null,
    private onTouch: (name: string) => Promise<void>,
    private onMkdir: (name: string) => Promise<void>,
    private onRm: (name: string) => Promise<void>,
    private onRename: (oldName: string, newName: string) => Promise<void>,
    private onEmptyTrash: () => Promise<void>,
    private onRestore: (name: string) => Promise<void>,
    private onOpenPath: (path: string) => void,
    private onOpenFile: (name: string, content: string) => Promise<void>,
    private onGoBack: () => void,
    private onGoForward: () => void,
    private onGoUp: () => void,
    private onGoHome: () => void,
    private onSortBy: (sortBy: 'name' | 'size' | 'date') => void,
    private onToggleHidden: () => void,
    private onRefresh: () => void
  ) {}

  public setupMenuBar(): void {
    const menuBar = document.querySelector('.fm-menubar');
    if (!menuBar) return;

    menuBar.querySelectorAll('span').forEach((span) => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeMenu();

        const name = span.textContent?.trim() || '';
        let items = this.getMenuItems(name);

        if (name === 'File') {
          const normalize = (p: string) => (p.endsWith('/') ? p : p + '/');
          const isTrash = normalize(this.getCurrentPath()) === normalize(CONFIG.FS.TRASH);
          items = items.filter((item) => item.label !== 'Empty Trash' || isTrash);
        }

        if (!items || items.length === 0) return;

        const menu = document.createElement('div');
        menu.className = 'fm-dropdown';
        menu.style.zIndex = String(CONFIG.DROPDOWN.Z_INDEX);

        items.forEach((item) => {
          const option = document.createElement('div');
          option.className = 'fm-dropdown-item';
          option.textContent = item.label;
          option.addEventListener('click', async () => {
            await item.action();
            this.closeMenu();
          });
          menu.appendChild(option);
        });

        document.body.appendChild(menu);
        const rect = span.getBoundingClientRect();
        menu.style.left = rect.left + 'px';
        menu.style.top = rect.bottom + 'px';
        this.activeMenu = menu;
      });
    });
  }

  public closeMenu(): void {
    if (this.activeMenu) {
      this.activeMenu.remove();
      this.activeMenu = null;
    }
  }

  public handleContextMenu(e: MouseEvent): void {
    e.preventDefault();
    if (this.activeContextMenu) this.activeContextMenu.remove();

    const target = e.target as HTMLElement;
    const fileEl =
      target && typeof target.closest === 'function'
        ? (target.closest('.fm-file') as HTMLElement | null)
        : null;

    let items: ContextMenuItem[] = [];

    if (fileEl) {
      const name = fileEl.dataset.name;
      if (!name) return;

      const isTrashDir = this.getCurrentPath().includes('/.trash/');
      const currentPath = this.getCurrentPath();

      items = [
        {
          label: isTrashDir ? 'Restore' : 'Open',
          icon: '/icons/apps/org.xfce.catfish.png',
          action: () => {
            if (isTrashDir) {
              this.onRestore(name);
            } else {
              const item = VFS.getNode(
                currentPath + name + (VFS.getNode(currentPath + name + '/') ? '/' : '')
              );
              if (item) {
                if (item.type === 'folder') this.onOpenPath(currentPath + name + '/');
                else this.onOpenFile(name, (item as VFSFile).content);
              }
            }
          },
        },
        {
          label: 'Copy',
          icon: '/icons/actions/edit-copy.png',
          action: () => {
            const fullPath =
              currentPath + name + (VFS.getNode(currentPath + name + '/') ? '/' : '');
            copyToClipboard(fullPath);
          },
        },
        {
          label: 'Cut',
          icon: '/icons/actions/edit-cut.png',
          action: () => {
            const fullPath =
              currentPath + name + (VFS.getNode(currentPath + name + '/') ? '/' : '');
            cutToClipboard(fullPath);
          },
        },
        {
          label: 'Rename',
          icon: '/icons/actions/edit-text.png',
          action: async () => {
            const newName = await CDEModal.prompt('New name:', name);
            if (newName) await this.onRename(name, newName);
          },
        },
        {
          label: 'Properties',
          icon: '/icons/system/system-search.png',
          action: () => showProperties(currentPath + name),
        },
        {
          label: 'Delete',
          icon: '/icons/actions/edit-delete.png',
          action: () => this.onRm(name),
        },
      ];
    } else {
      items = [
        {
          label: 'Paste',
          icon: '/icons/actions/edit-paste.png',
          disabled: !window.fmClipboard,
          action: async () => {
            await pasteFromClipboard(this.getCurrentPath());
          },
        },
        ...this.getMenuItems('File'),
      ];
    }

    this.activeContextMenu = createContextMenu(items, e.clientX, e.clientY);
  }

  public closeContextMenu(): void {
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
  }

  private getMenuItems(menuName: string): ContextMenuItem[] {
    const menus: Record<string, ContextMenuItem[]> = {
      File: [
        {
          label: 'New File',
          icon: '/icons/mimetypes/document.png',
          action: async () => {
            const name = await CDEModal.prompt('File name:');
            if (name) await this.onTouch(name);
          },
        },
        {
          label: 'New Folder',
          icon: '/icons/places/folder_open.png',
          action: async () => {
            const name = await CDEModal.prompt('Folder name:');
            if (name) await this.onMkdir(name);
          },
        },
        {
          label: 'Empty Trash',
          icon: '/icons/places/user-trash-full.png',
          action: this.onEmptyTrash,
        },
      ],
      Edit: [
        {
          label: 'Copy',
          icon: '/icons/actions/edit-copy.png',
          action: async () => {
            const selected = this.getSelected();
            if (!selected) return;
            const currentPath = this.getCurrentPath();
            const fullPath =
              currentPath + selected + (VFS.getNode(currentPath + selected + '/') ? '/' : '');
            copyToClipboard(fullPath);
          },
        },
        {
          label: 'Cut',
          icon: '/icons/actions/edit-cut.png',
          action: async () => {
            const selected = this.getSelected();
            if (!selected) return;
            const currentPath = this.getCurrentPath();
            const fullPath =
              currentPath + selected + (VFS.getNode(currentPath + selected + '/') ? '/' : '');
            cutToClipboard(fullPath);
          },
        },
        {
          label: 'Paste',
          icon: '/icons/actions/edit-paste.png',
          action: async () => {
            await pasteFromClipboard(this.getCurrentPath());
          },
        },
        {
          label: 'Rename',
          icon: '/icons/actions/edit-copy.png',
          action: async () => {
            const selected = this.getSelected();
            if (!selected) return;
            const newName = await CDEModal.prompt('New name:', selected);
            if (newName) await this.onRename(selected, newName);
          },
        },
      ],
      View: [
        {
          label: 'Sort by Name',
          action: () => this.onSortBy('name'),
        },
        {
          label: 'Sort by Size',
          action: () => this.onSortBy('size'),
        },
        {
          label: 'Sort by Date',
          action: () => this.onSortBy('date'),
        },
        {
          label: 'Show Hidden Files',
          action: () => this.onToggleHidden(),
        },
        {
          label: 'Refresh',
          icon: '/icons/actions/view-refresh.png',
          action: () => this.onRefresh(),
        },
      ],
      Go: [
        { label: 'Back', icon: '/icons/actions/previous.png', action: this.onGoBack },
        { label: 'Forward', icon: '/icons/actions/right.png', action: this.onGoForward },
        { label: 'Up', icon: '/icons/actions/go-up.png', action: this.onGoUp },
        { label: 'Home', icon: '/icons/actions/gohome.png', action: this.onGoHome },
      ],
      Places: [
        {
          label: 'Settings',
          icon: '/icons/apps/org.xfce.settings.manager.png',
          action: () => this.onOpenPath(CONFIG.FS.HOME + 'settings/'),
        },
        {
          label: 'Documentation',
          icon: '/icons/system/help.png',
          action: () => this.onOpenPath(CONFIG.FS.HOME + 'documentation/'),
        },
        {
          label: 'Desktop',
          icon: '/icons/places/desktop.png',
          action: () => this.onOpenPath(CONFIG.FS.DESKTOP),
        },
      ],
    };

    return menus[menuName] || [];
  }
}
