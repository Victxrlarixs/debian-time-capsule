import type { VFSNode, VFSFile } from '../../core/vfs';

/**
 * Renders file icons with drag & drop, double-click, and long-press support.
 */
export class FileRenderer {
  private lastTapTime = 0;
  private longPressTimer: number | null = null;
  private tapStartX = 0;
  private tapStartY = 0;

  public renderIconView(
    container: HTMLElement,
    items: Array<{ name: string; node: VFSNode }>,
    currentPath: string,
    selectedFile: string | null,
    onFileSelect: (name: string) => void,
    onFileOpen: (name: string, node: VFSNode) => void,
    onContextMenu: (e: MouseEvent, name: string) => void,
    onFileDrop: (sourcePath: string, targetName: string) => Promise<void>
  ): void {
    const fragment = document.createDocumentFragment();

    items.forEach(({ name, node }) => {
      const div = document.createElement('div');
      div.className = 'fm-file';
      if (selectedFile === name) div.classList.add('selected');
      div.dataset.name = name;

      this.setupFileEvents(
        div,
        name,
        node,
        currentPath,
        onFileSelect,
        onFileOpen,
        onContextMenu,
        onFileDrop
      );

      const img = document.createElement('img');
      img.src = this.getFileIcon(node);
      img.draggable = false;

      const span = document.createElement('span');
      span.textContent = name;

      div.appendChild(img);
      div.appendChild(span);
      fragment.appendChild(div);
    });

    container.replaceChildren(fragment);
  }

  private getFileIcon(node: VFSNode): string {
    if (node.type === 'folder') {
      return '/icons/apps/filemanager.png';
    }

    const fileNode = node as VFSFile;
    const isEmpty = !fileNode.content || fileNode.content.trim() === '';
    return isEmpty ? '/icons/mimetypes/document.png' : '/icons/mimetypes/gtk-file.png';
  }

  private setupFileEvents(
    div: HTMLElement,
    name: string,
    node: VFSNode,
    currentPath: string,
    onFileSelect: (name: string) => void,
    onFileOpen: (name: string, node: VFSNode) => void,
    onContextMenu: (e: MouseEvent, name: string) => void,
    onFileDrop: (sourcePath: string, targetName: string) => Promise<void>
  ): void {
    div.draggable = true;

    div.addEventListener('dragstart', (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData(
          'text/plain',
          currentPath + name + (node.type === 'folder' ? '/' : '')
        );
        e.dataTransfer.effectAllowed = 'move';
      }
      div.classList.add('dragging');
    });

    div.addEventListener('dragend', () => {
      div.classList.remove('dragging');
    });

    if (node.type === 'folder') {
      div.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        div.classList.add('drag-over');
      });

      div.addEventListener('dragleave', () => {
        div.classList.remove('drag-over');
      });

      div.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        div.classList.remove('drag-over');
        const sourcePath = e.dataTransfer?.getData('text/plain');
        if (sourcePath && sourcePath !== currentPath + name + '/') {
          await onFileDrop(sourcePath, name);
        }
      });
    }

    div.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      document
        .querySelectorAll('.fm-file, .fm-list-item')
        .forEach((el) => el.classList.remove('selected'));
      div.classList.add('selected');
      onFileSelect(name);

      if (this.longPressTimer) clearTimeout(this.longPressTimer);
      this.tapStartX = e.clientX;
      this.tapStartY = e.clientY;
      this.longPressTimer = window.setTimeout(() => {
        if (
          Math.abs(e.clientX - this.tapStartX) < 10 &&
          Math.abs(e.clientY - this.tapStartY) < 10
        ) {
          onContextMenu(e as unknown as MouseEvent, name);
        }
        this.longPressTimer = null;
      }, 500);

      const now = Date.now();
      if (now - this.lastTapTime < 300) {
        if (this.longPressTimer) clearTimeout(this.longPressTimer);
        if (node.type === 'folder') {
          const img = div.querySelector('img');
          if (img) img.src = '/icons/places/folder_open.png';
          setTimeout(() => onFileOpen(name, node), 50);
        } else {
          setTimeout(() => onFileOpen(name, node), 50);
        }
        this.lastTapTime = 0;
        return;
      }
      this.lastTapTime = now;
    });

    div.addEventListener('pointermove', (e) => {
      if (
        this.longPressTimer &&
        (Math.abs(e.clientX - this.tapStartX) > 10 || Math.abs(e.clientY - this.tapStartY) > 10)
      ) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    });

    div.addEventListener('pointerup', () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    });
  }

  public updateStatusBar(itemCount: number, searchQuery: string): void {
    const status = document.getElementById('fmStatus');
    if (status) {
      status.textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}${searchQuery ? ' (filtered)' : ''}`;
    }
  }
}
