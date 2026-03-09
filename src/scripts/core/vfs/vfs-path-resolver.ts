import { CONFIG } from '../config';

export class VFSPathResolver {
  /**
   * Resolves a path relative to a current working directory.
   * Handles ~, .., and . path components.
   */
  resolvePath(cwd: string, path: string): string {
    if (path.startsWith('~')) path = CONFIG.FS.HOME + path.slice(1);
    if (!path.startsWith('/')) path = cwd + (cwd.endsWith('/') ? '' : '/') + path;

    const parts = path.split('/').filter(Boolean);
    const resolved: string[] = [];

    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        resolved.pop();
        continue;
      }
      resolved.push(part);
    }

    return '/' + resolved.join('/') + (path.endsWith('/') && resolved.length > 0 ? '/' : '');
  }
}
