import type { VFSNode } from './types';

export class VFSSearch {
  constructor(private getChildren: (path: string) => Record<string, VFSNode> | null) {}

  /** Searches for files and folders by name or content. */
  async search(basePath: string, query: string, recursive = false): Promise<string[]> {
    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    const searchDir = (path: string) => {
      const children = this.getChildren(path);
      if (!children) return;

      for (const [name, node] of Object.entries(children)) {
        const fullPath = path + name + (node.type === 'folder' ? '/' : '');

        if (name.toLowerCase().includes(lowerQuery)) {
          results.push(fullPath);
        }

        if (node.type === 'file' && node.content.toLowerCase().includes(lowerQuery)) {
          if (!results.includes(fullPath)) {
            results.push(fullPath);
          }
        }

        if (recursive && node.type === 'folder') {
          searchDir(fullPath);
        }
      }
    };

    searchDir(basePath);
    return results;
  }
}
