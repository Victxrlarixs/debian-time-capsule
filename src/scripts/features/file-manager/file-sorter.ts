import type { VFSNode } from '../../core/vfs';
import { VFS } from '../../core/vfs';

export type SortBy = 'name' | 'size' | 'date';
export type SortOrder = 'asc' | 'desc';

/**
 * Manages file sorting and filtering logic.
 */
export class FileSorter {
  private sortBy: SortBy = 'name';
  private sortOrder: SortOrder = 'asc';
  private showHidden: boolean = false;

  public setSortBy(sortBy: SortBy): void {
    if (this.sortBy === sortBy) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = sortBy;
      this.sortOrder = 'asc';
    }
  }

  public setSortOrder(order: SortOrder): void {
    this.sortOrder = order;
  }

  public toggleSortOrder(): void {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
  }

  public setShowHidden(show: boolean): void {
    this.showHidden = show;
  }

  public toggleShowHidden(): void {
    this.showHidden = !this.showHidden;
  }

  public getShowHidden(): boolean {
    return this.showHidden;
  }

  /**
   * Filters and sorts file entries. Folders always appear first.
   */
  public filterAndSort(
    items: Record<string, VFSNode>,
    currentPath: string,
    searchQuery: string = ''
  ): Array<{ name: string; node: VFSNode }> {
    let entries = Object.entries(items)
      .filter(([name]) => this.showHidden || !name.startsWith('.'))
      .filter(([name]) => !searchQuery || name.toLowerCase().includes(searchQuery))
      .map(([name, node]) => ({ name, node }));

    entries.sort((a, b) => {
      if (a.node.type === 'folder' && b.node.type === 'file') return -1;
      if (a.node.type === 'file' && b.node.type === 'folder') return 1;

      let comparison = 0;

      switch (this.sortBy) {
        case 'name':
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          break;
        case 'size':
          const sizeA = VFS.getSize(currentPath + a.name + (a.node.type === 'folder' ? '/' : ''));
          const sizeB = VFS.getSize(currentPath + b.name + (b.node.type === 'folder' ? '/' : ''));
          comparison = sizeA - sizeB;
          break;
        case 'date':
          const dateA = new Date(a.node.metadata?.mtime || 0).getTime();
          const dateB = new Date(b.node.metadata?.mtime || 0).getTime();
          comparison = dateA - dateB;
          break;
      }

      return this.sortOrder === 'asc' ? comparison : -comparison;
    });

    return entries;
  }
}
