import type { NSPage } from './netscape-types';

export class NetscapeNavigatorEngine {
  constructor(private nsPages: Record<string, NSPage>) {}

  public normalizeUrl(url: string): string {
    if (!url) return '';
    const target = url.trim();

    if (target === 'net-search') return 'https://duckduckgo.com/';

    if (this.nsPages[target] || target.startsWith('about:')) return target;

    if (!target.includes('.') || target.includes(' ')) {
      return `https://duckduckgo.com/?q=${encodeURIComponent(target)}`;
    }

    return target.startsWith('http') ? target : `https://${target}`;
  }

  public getExternalUrl(url: string): string {
    return `https://web.archive.org/web/2d_/${url}`;
  }

  public isInternalPage(target: string): string | undefined {
    return Object.keys(this.nsPages).find(
      (k) => k === target || this.nsPages[k].url === target
    );
  }
}
