import { WindowManager } from '../core/windowmanager';
import { logger } from '../utilities/logger';
import lynxPagesData from '../../data/lynx-pages.json';
import { openWindow, closeWindow } from '../shared/window-helpers';
import { HistoryManager } from '../shared/history-manager';
import { fetchExternalContent } from '../shared/browser-engine';


interface LynxLink {
  num: number;
  text: string;
  url: string;
}

interface LynxPage {
  title: string;
  url: string;
  content: string;
  links: LynxLink[];
}

interface HistoryEntry {
  url: string;
  title: string;
}


const LYNX_PAGES: Record<string, LynxPage> = lynxPagesData as Record<string, LynxPage>;


class LynxBrowser {
  private id = 'lynx';
  private currentUrl = 'about:lynx';
  private currentPage: LynxPage | null = null;
  private selectedLink = 0;
  private history: HistoryManager<HistoryEntry>;
  private bookmarks: string[] = ['about:lynx', 'gnu.org', 'debian.org'];
  private inputMode: 'navigation' | 'prompt' = 'navigation';
  private promptCallback: ((value: string) => void) | null = null;
  private isLoading = false;

  constructor() {
    this.history = new HistoryManager<HistoryEntry>({ url: 'about:lynx', title: 'About Lynx' });
    this.init();
  }

  private init(): void {
    logger.log('[Lynx] Initializing...');
    this.navigate('about:lynx', false);
    this.setupKeyboard();
    this.setupInput();
    this.setStatus('Lynx ready');
  }


  public open(): void {
    openWindow({
      id: this.id,
      center: true,
      playSound: true,
      focus: true,
      onOpen: () => {
        setTimeout(() => {
          this.focus();
        }, 50);
      },
    });

    logger.log('[Lynx] Window opened');
  }

  public close(): void {
    closeWindow(this.id);
    logger.log('[Lynx] Window closed');
  }


  public async navigate(url: string, addToHistory = true): Promise<void> {
    if (this.isLoading) return;

    let target = url.trim();
    if (!target) return;

    // Default to https if no protocol
    if (!target.includes('://') && !target.startsWith('about:')) {
      target = `https://${target}`;
    }

    this.isLoading = true;
    this.setStatus(`Connecting to ${target}...`);

    let page: LynxPage | null = LYNX_PAGES[target] || null;

    if (target === 'lynx://bookmarks') {
      this.viewBookmarks();
      return;
    }
    if (target === 'lynx://history') {
      this.viewHistory();
      return;
    }

    if (!page && !target.startsWith('lynx://') && !target.startsWith('about:')) {
      page = await this.fetchExternalPage(target);
    }

    if (!page) {
      this.setStatus(`Error: Could not load URL — ${target}`);
      this.isLoading = false;
      return;
    }

    this.currentUrl = target;
    this.currentPage = page;
    this.selectedLink = 0;

    const isUtilityPage = target.startsWith('lynx://');
    if (addToHistory && page && !isUtilityPage) {
      this.history.push({ url: target, title: page.title });
    }

    this.render();
    this.setStatus('Document: Done');
    this.isLoading = false;
  }

  public goBack(): void {
    const prev = this.history.back();
    if (prev) {
      this.navigate(prev.url, false);
    }
  }

  public followLink(num: number): void {
    if (!this.currentPage) return;
    const link = this.currentPage.links.find((l) => l.num === num);
    if (!link) {
      this.setStatus(`Error: Link ${num} not found`);
      return;
    }

    // Navigate to the link URL
    if (link.url === 'history:back') {
      this.goBack();
      return;
    }
    this.navigate(link.url);
  }


  private render(): void {
    if (!this.currentPage) return;

    const content = document.getElementById('lynxContent');
    const title = document.getElementById('lynx-title');

    if (title) title.textContent = `Lynx: ${this.currentPage.title}`;

    if (content) {
      let html = `<div class="lynx-line" style="color: #ffffff; font-weight: bold;">${this.escapeHtml(this.currentPage.url)}</div>`;
      html += `<div class="lynx-line"></div>`;

      const lines = this.currentPage.content.trim().split('\n');

      lines.forEach((line) => {
        const linkMatch = line.match(/\[(\d+)\]([^\[]+)/g);
        if (linkMatch) {
          let processedLine = line;
          linkMatch.forEach((match) => {
            const numMatch = match.match(/\[(\d+)\]/);
            if (numMatch) {
              const num = parseInt(numMatch[1]);
              const isSelected = num === this.selectedLink + 1;
              const className = isSelected ? 'lynx-link lynx-link-selected' : 'lynx-link';
              processedLine = processedLine.replace(
                match,
                `<span class="${className}" data-link="${num}">${match}</span>`
              );
            }
          });
          html += `<div class="lynx-line">${processedLine}</div>`;
        } else {
          html += `<div class="lynx-line">${this.escapeHtml(line)}</div>`;
        }
      });

      content.innerHTML = html;

      // Add click handlers to links
      content.querySelectorAll('.lynx-link').forEach((el) => {
        el.addEventListener('click', () => {
          const linkNum = parseInt((el as HTMLElement).dataset.link || '0');
          this.followLink(linkNum);
        });
      });

      content.scrollTop = 0;
    }
  }


  private setupKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      const win = document.getElementById(this.id);
      if (!win || win.style.display === 'none') return;

      const content = document.getElementById('lynxContent');
      const inputLine = document.getElementById('lynxInputLine');

      if (this.inputMode === 'prompt' && inputLine?.style.display !== 'none') {
        return;
      }

      if (!content || document.activeElement !== content) return;

      this.handleKey(e);
    });
  }

  private setupInput(): void {
    const input = document.getElementById('lynxInput') as HTMLInputElement;
    if (!input) return;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = input.value.trim();
        input.value = '';
        this.hidePrompt();

        if (this.promptCallback) {
          this.promptCallback(value);
          this.promptCallback = null;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        input.value = '';
        this.hidePrompt();
        this.promptCallback = null;
        this.setStatus('Cancelled');
      }
    });
  }

  private showPrompt(promptText: string, callback: (value: string) => void): void {
    const inputLine = document.getElementById('lynxInputLine');
    const inputPrompt = document.getElementById('lynxInputPrompt');
    const input = document.getElementById('lynxInput') as HTMLInputElement;

    if (!inputLine || !inputPrompt || !input) return;

    this.inputMode = 'prompt';
    this.promptCallback = callback;

    inputPrompt.textContent = promptText;
    inputLine.style.display = 'flex';
    input.value = '';
    input.focus();
  }

  private hidePrompt(): void {
    const inputLine = document.getElementById('lynxInputLine');
    if (inputLine) inputLine.style.display = 'none';

    this.inputMode = 'navigation';
    this.focus();
  }

  private handleKey(e: KeyboardEvent): void {
    if (!this.currentPage) return;

    const key = e.key.toLowerCase();

    switch (key) {
      case 'arrowdown':
      case 'j':
        e.preventDefault();
        this.selectNextLink();
        break;
      case 'arrowup':
      case 'k':
        e.preventDefault();
        this.selectPrevLink();
        break;
      case 'enter':
      case 'arrowright':
        e.preventDefault();
        this.followSelectedLink();
        break;
      case 'arrowleft':
        e.preventDefault();
        this.goBack();
        break;
      case 'g':
        e.preventDefault();
        this.openLocation();
        break;
      case 'o':
        e.preventDefault();
        this.navigate('lynx://options');
        break;
      case 'p':
        e.preventDefault();
        this.printPage();
        break;
      case 'm':
        e.preventDefault();
        this.goHome();
        break;
      case 'q':
        e.preventDefault();
        this.quit();
        break;
      case 'h':
      case '?':
        e.preventDefault();
        this.navigate('lynx://help');
        break;
      case 'v':
        e.preventDefault();
        this.navigate('lynx://bookmarks');
        break;
      case '/':
        e.preventDefault();
        this.search();
        break;
      case 'delete':
        e.preventDefault();
        this.navigate('lynx://history');
        break;
      case 'backspace':
        e.preventDefault();
        this.goBack();
        break;
      default:
        // Number keys for direct link access
        if (key >= '0' && key <= '9') {
          e.preventDefault();
          this.followLink(parseInt(key));
        }
        break;
    }
  }

  private selectNextLink(): void {
    if (!this.currentPage) return;
    this.selectedLink = (this.selectedLink + 1) % this.currentPage.links.length;
    this.render();
    this.scrollToSelected();
  }

  private selectPrevLink(): void {
    if (!this.currentPage) return;
    this.selectedLink =
      (this.selectedLink - 1 + this.currentPage.links.length) % this.currentPage.links.length;
    this.render();
    this.scrollToSelected();
  }

  private followSelectedLink(): void {
    if (!this.currentPage) return;
    const link = this.currentPage.links[this.selectedLink];
    if (link) this.followLink(link.num);
  }

  private scrollToSelected(): void {
    const selected = document.querySelector('.lynx-link-selected');
    if (selected) {
      selected.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }


  public openLocation(): void {
    this.showPrompt('URL to open: ', (url) => {
      if (!url) {
        this.setStatus('Cancelled');
        return;
      }
      this.navigate(url);
    });
  }

  private async fetchExternalPage(url: string): Promise<LynxPage | null> {
    try {
      const html = await fetchExternalContent(url);
      if (!html) return null;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const links: LynxLink[] = [];
      let linkCounter = 1;
      const processNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
          return this.escapeHtml(node.textContent || '');
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tagName = el.tagName.toLowerCase();

          // Skip non-content tags
          if (['script', 'style', 'head', 'meta', 'link', 'svg', 'canvas', 'iframe'].includes(tagName)) {
            return '';
          }

          // Handle links
          if (tagName === 'a') {
            const href = el.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
              const num = linkCounter++;
              const linkText = this.escapeHtml(el.textContent?.trim() || 'Link');

              let absoluteUrl = href;
              try {
                absoluteUrl = new URL(href, url).href;
              } catch (e) { }

              links.push({ num, text: linkText, url: absoluteUrl });
              return ` [${num}]${linkText} `;
            }
          }

          // Handle images (text version)
          if (tagName === 'img') {
            const alt = el.getAttribute('alt');
            return alt ? ` [IMAGE: ${alt}] ` : '[IMAGE]';
          }

          // Process children
          let childrenText = '';
          node.childNodes.forEach((child) => {
            childrenText += processNode(child);
          });

          // Block level elements add spacing
          if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'li', 'tr', 'header', 'footer', 'nav', 'section'].includes(tagName)) {
            return `\n${childrenText}\n`;
          }

          if (tagName === 'br') return '\n';

          return childrenText;
        }

        return '';
      };

      const rawContent = processNode(doc.body);

      // Clean up whitespace and newlines for Lynx-like look
      const cleanContent = rawContent
        .split('\n')
        .map(line => line.trim())
        .filter((line, i, arr) => line !== '' || (arr[i - 1] !== '')) // Max 1 empty line
        .join('\n');

      return {
        title: doc.title || url,
        url: url,
        content: cleanContent,
        links: links,
      };
    } catch (e) {
      logger.error(`[Lynx] Fetch error: ${e}`);
      return null;
    }
  }

  public printPage(): void {
    this.setStatus('Print options not available in browser version');
  }

  public goHome(): void {
    this.navigate('about:lynx');
  }

  public quit(): void {
    this.showPrompt('Are you sure you want to quit? (y/n) ', (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        this.close();
      } else {
        this.setStatus('Cancelled');
      }
    });
  }

  public viewBookmarks(): void {
    let content = '\n  BOOKMARKS\n  =========\n\n';
    this.bookmarks.forEach((url, i) => {
      content += `  [${i + 1}]${url}\n`;
    });
    content += '\n  Enter number to visit, or press any other key to return';

    const bookmarksPage: LynxPage = {
      title: 'Bookmarks',
      url: 'lynx://bookmarks',
      content,
      links: this.bookmarks.map((url, i) => ({
        num: i + 1,
        text: url,
        url: url,
      })),
    };

    const previousPage = this.currentPage;
    const previousUrl = this.currentUrl;

    this.currentPage = bookmarksPage;
    this.currentUrl = 'lynx://bookmarks';
    this.selectedLink = 0;
    this.render();
    this.setStatus('Select bookmark or press any key to return');
  }

  public viewHistory(): void {
    const allHistory = this.history.getAll();
    const currentIndex = this.history.getCurrentIndex();

    // Authentic Lynx History Page Layout
    let content = '<div style="float: right; color: #ff00ff; font-weight: bold;">History Page</div>\n';
    content += '<div style="clear: both;"></div>\n';

    content += '<div style="text-align: center; margin: 10px 0;">\n';
    content += '  <span style="background: #00aaaa; color: #000; padding: 0 15px; font-weight: bold;">History Page (Lynx Version 2.8.9rel.1)</span>\n';
    content += '</div>\n\n';

    content += 'You selected:\n';

    const links: LynxLink[] = [];
    // Lynx shows history newest first usually in this view
    const reversed = [...allHistory].reverse();
    const totalCount = allHistory.length;

    reversed.forEach((entry, i) => {
      const num = totalCount - 1 - i;
      const isCurrent = num === currentIndex;
      const displayNum = num.toString().padStart(2, ' ');
      const linkNum = i + 1;

      // Lynx uses white/yellow for titles and grey for URLs in this view
      const titleColor = isCurrent ? '#ffff00' : '#ffffff';
      content += `  ${displayNum}. <span style="color: ${titleColor};">[${linkNum}]${entry.title}</span>\n`;
      content += `      <span style="color: #cccccc;">${entry.url}</span>\n`;

      links.push({ num: linkNum, text: entry.title, url: entry.url });
    });

    // Right-aligned status messages placeholder (authentic look)
    content += '\n<div style="float: right; color: #00aaaa; font-weight: bold;">[Your recent statusline messages]</div>\n';
    content += '<div style="clear: both;"></div>\n';

    // Status bar at bottom (integrated into content for authenticity)
    content += '\n<div style="background: #00aaaa; color: #000; padding: 2px 5px; width: 100%; position: sticky; bottom: 0;">Commands: Use arrow keys to move, \'?\' for help, \'q\' to quit, \'&lt;-\' to go back.</div>';

    const historyPage: LynxPage = {
      title: 'History Page',
      url: 'lynx://history',
      content,
      links: links,
    };

    this.currentPage = historyPage;
    this.currentUrl = 'lynx://history';
    this.selectedLink = 0;
    this.render();
    this.setStatus('History Page - Select a page to visit');
  }

  public search(): void {
    this.showPrompt('Search for: ', (term) => {
      if (!term) {
        this.setStatus('Cancelled');
        return;
      }

      const content = document.getElementById('lynxContent');
      if (!content) return;

      const text = content.textContent || '';
      const idx = text.toLowerCase().indexOf(term.toLowerCase());

      if (idx >= 0) {
        this.setStatus(`Found: "${term}"`);
        // Simple highlight
        const html = content.innerHTML;
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        content.innerHTML = html.replace(regex, '<mark>$1</mark>');
      } else {
        this.setStatus(`Not found: "${term}"`);
      }
    });
  }


  private focus(): void {
    const content = document.getElementById('lynxContent');
    if (content) content.focus();
  }

  private setStatus(text: string): void {
    const el = document.getElementById('lynxStatus');
    if (el) el.textContent = text;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}


if (typeof window !== 'undefined') {
  const lynx = new LynxBrowser();
  (window as any).Lynx = lynx;
  (window as any).openLynx = () => lynx.open();
}

export { };
