// src/scripts/features/netscape.ts
import { WindowManager } from '../core/windowmanager';
import { logger } from '../utilities/logger';
import { openWindow, closeWindow } from '../shared/window-helpers';
import { HistoryManager } from '../shared/history-manager';
import { getEngineUrl } from '../shared/browser-engine';

import netscapePages from '../../data/netscape-pages.json';

interface NSPage {
  title: string;
  url: string;
  content: () => string;
}

const NS_PAGES: Record<string, NSPage> = {};
Object.entries(netscapePages).forEach(([key, value]) => {
  NS_PAGES[key] = {
    title: value.title,
    url: value.url,
    content: () => value.content,
  };
});

// ─── Netscape Navigator class ────────────────────────────────────────────────

class NetscapeNavigator {
  private id = 'netscape';
  private history: HistoryManager<string>;
  private currentPage = 'whats-new';
  private isLoading = false;
  private animationFrame: number | null = null;
  private starInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.history = new HistoryManager<string>('whats-new');
    this.init();
  }

  private init(): void {
    logger.log('[Netscape] Initializing...');
    this.renderPage('whats-new', false);
    this.setupScrollThumb();
  }

  // ── Window controls ─────────────────────────────────────────────────────

  public open(): void {
    openWindow({
      id: this.id,
      zIndex: 10000,
      center: true,
      playSound: false, // Netscape doesn't use standard window sound
    });
    logger.log('[Netscape] Window opened');
  }

  public close(): void {
    closeWindow(this.id);
    logger.log('[Netscape] Window closed');
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  public navigate(path: string): void {
    const target = this.normalizeUrl(path);
    if (target === this.currentPage) return;

    this.history.push(target);
    this.renderPage(target, true);
    this.updateHistoryMenu();
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    const target = url.trim();

    if (target === 'net-search') return 'https://duckduckgo.com/';

    if (NS_PAGES[target] || target.startsWith('about:')) return target;

    if (!target.includes('.') || target.includes(' ')) {
      return `https://duckduckgo.com/?q=${encodeURIComponent(target)}`;
    }

    return target.startsWith('http') ? target : `https://${target}`;
  }


  public goBack(): void {
    const prev = this.history.back();
    if (prev) {
      this.renderPage(prev, true);
    }
  }

  public goForward(): void {
    if (window.AudioManager) window.AudioManager.click();
    const next = this.history.forward();
    if (next) {
      this.renderPage(next, true);
    }
  }

  public goHome(): void {
    if (window.AudioManager) window.AudioManager.click();
    this.navigate('welcome');
  }

  public reload(): void {
    if (window.AudioManager) window.AudioManager.click();
    this.renderPage(this.currentPage, true);
  }

  private renderPage(target: string, animate: boolean): void {
    // Determine if we're loading an internal page or external URL
    const internalKey = Object.keys(NS_PAGES).find((k) => k === target || NS_PAGES[k].url === target);
    const nsContent = document.getElementById('nsContent');
    const nsExternalView = document.getElementById('nsExternalView') as HTMLIFrameElement;
    const urlInput = document.getElementById('nsUrlInput') as HTMLInputElement;
    const title = document.getElementById('netscape-title');

    this.currentPage = target;

    if (internalKey) {
      const page = NS_PAGES[internalKey];
      if (urlInput) urlInput.value = page.url;
      if (title) title.textContent = page.title;

      // Toggle views
      if (nsContent) nsContent.style.display = 'block';
      if (nsExternalView) {
        nsExternalView.style.display = 'none';
        nsExternalView.src = 'about:blank';
      }

      // Active dir button
      const dirBtns = document.querySelectorAll('.ns-dir-btn');
      dirBtns.forEach((btn) => btn.classList.remove('active'));
      const activeBtn = document.querySelector(`.ns-dir-btn[onclick*="${internalKey}"]`);
      if (activeBtn) activeBtn.classList.add('active');

      if (animate) {
        this.startLoading(() => {
          if (nsContent) {
            nsContent.innerHTML = page.content();
            nsContent.scrollTop = 0;
          }
        });
      } else {
        if (nsContent) nsContent.innerHTML = page.content();
        this.setStatus('Document: Done');
      }
    } else {
      if (urlInput) urlInput.value = target;
      if (title) title.textContent = `${target} — Netscape`;

      if (nsContent) nsContent.style.display = 'none';
      if (nsExternalView) {
        nsExternalView.style.display = 'block';
      }

      const dirBtns = document.querySelectorAll('.ns-dir-btn');
      if (dirBtns) dirBtns.forEach((btn) => (btn as HTMLElement).classList.remove('active'));

      // Restauramos el "Motor Invisible" que permite cargar Google/GNU
      const engineUrl = `https://web.archive.org/web/2d_/${target}`;
      this.setStatus(`Loading ${target}...`);

      if (animate) {
        this.startLoadingExternal(engineUrl);
      } else {
        if (nsExternalView) nsExternalView.src = engineUrl;
        this.setStatus('Document: Done');
      }
    }

    // Update nav buttons state
    const backBtn = document.getElementById('ns-btn-back') as HTMLButtonElement | null;
    const fwdBtn = document.getElementById('ns-btn-forward') as HTMLButtonElement | null;
    if (backBtn) backBtn.disabled = !this.history.canGoBack();
    if (fwdBtn) fwdBtn.disabled = !this.history.canGoForward();
  }

  private startLoading(onComplete: () => void): void {
    if (this.isLoading) this.stopLoading();
    this.isLoading = true;

    this.toggleLoadingUI(true);
    this.setStatus('Connecting...');
    this.animateProgress(0);

    const steps = [
      { delay: 100, status: 'Connecting to host...', prog: 10 },
      { delay: 250, status: 'Host contacted. Waiting for reply...', prog: 30 },
      { delay: 450, status: 'Receiving data...', prog: 60 },
      { delay: 650, status: 'Loading page...', prog: 80 },
      { delay: 850, status: 'Transferring data...', prog: 95 },
      { delay: 1000, status: 'Document: Done', prog: 100 },
    ];

    steps.forEach(({ delay, status, prog }) => {
      setTimeout(() => {
        if (!this.isLoading) return;
        this.setStatus(status);
        this.animateProgress(prog);
        if (prog === 100) {
          onComplete();
          this.stopLoading();
        }
      }, delay);
    });
  }

  private startLoadingExternal(url: string): void {
    if (this.isLoading) this.stopLoading();
    this.isLoading = true;

    this.toggleLoadingUI(true);
    this.setStatus(`Looking for site: ${url}...`);
    this.animateProgress(10);

    const nsExternalView = document.getElementById('nsExternalView') as HTMLIFrameElement;

    // Security Notice for Users
    if (url.includes('google.com') || url.includes('github.com')) {
      setTimeout(() => {
        this.setStatus('NOTICE: Site may block vintage view. Try a search term instead.');
      }, 1500);
    }

    if (nsExternalView) {
      setTimeout(() => {
        if (!this.isLoading) return;
        this.setStatus('Connect: Contacting host...');
        this.animateProgress(30);
      }, 400);

      setTimeout(() => {
        if (!this.isLoading) return;
        this.setStatus('Waiting for reply...');
        this.animateProgress(50);
        nsExternalView.src = url;
      }, 800);

      const onIframeLoad = () => {
        if (!this.isLoading) return;
        this.setStatus('Document: Done');
        this.animateProgress(100);
        setTimeout(() => this.stopLoading(), 200);
        nsExternalView.removeEventListener('load', onIframeLoad);
      };

      nsExternalView.addEventListener('load', onIframeLoad);

      // Safety stop
      setTimeout(() => {
        if (this.isLoading) {
          this.setStatus('Document: Done');
          this.animateProgress(100);
          this.stopLoading();
        }
      }, 8000);
    }
  }

  private toggleLoadingUI(active: boolean): void {
    const stopBtn = document.getElementById('ns-btn-stop') as HTMLButtonElement | null;
    if (stopBtn) stopBtn.disabled = !active;

    const nsLogo = document.getElementById('nsNLogo');
    if (nsLogo) {
      if (active) nsLogo.classList.add('ns-loading');
      else nsLogo.classList.remove('ns-loading');
    }

    if (active && !this.starInterval) {
      this.starInterval = setInterval(() => {
        const starsContainer = document.getElementById('nsNStars');
        if (!starsContainer || !this.isLoading) return;
        const star = document.createElement('div');
        star.className = 'ns-n-star';
        star.style.left = `${Math.random() * 50}px`;
        star.style.top = `${Math.random() * 10}px`;
        star.style.width = `${Math.random() > 0.5 ? 3 : 2}px`;
        star.style.height = star.style.width;
        starsContainer.appendChild(star);
        setTimeout(() => star.remove(), 800);
      }, 100);
    } else if (!active && this.starInterval) {
      clearInterval(this.starInterval);
      this.starInterval = null;
    }
  }

  private stopLoading(): void {
    this.isLoading = false;
    const stopBtn = document.getElementById('ns-btn-stop') as HTMLButtonElement | null;
    if (stopBtn) stopBtn.disabled = true;

    const nsLogo = document.getElementById('nsNLogo');
    if (nsLogo) nsLogo.classList.remove('ns-loading');

    if (this.starInterval) {
      clearInterval(this.starInterval);
      this.starInterval = null;
    }

    setTimeout(() => this.animateProgress(0), 500);
  }

  public stop(): void {
    if (window.AudioManager) window.AudioManager.click();
    this.stopLoading();
    this.setStatus('Transfer interrupted.');
  }

  private animateProgress(value: number): void {
    const bar = document.getElementById('nsProgressBar');
    if (bar) bar.style.width = `${value}%`;
  }

  private setStatus(text: string): void {
    const el = document.getElementById('nsStatusText');
    if (el) el.textContent = text;
  }

  // ── URL bar ─────────────────────────────────────────────────────────────

  public handleUrlKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      const input = e.target as HTMLInputElement;
      const url = input.value.trim();
      if (url) {
        this.navigate(url);
      }
    }
  }

  // ── Location dialog ─────────────────────────────────────────────────────

  public openLocation(): void {
    const urlInput = document.getElementById('nsUrlInput') as HTMLInputElement;
    if (urlInput) {
      urlInput.focus();
      urlInput.select();
    }
  }

  public openFile(): void {
    this.setStatus('Open File: not supported in this environment.');
  }

  public savePage(): void {
    const content = document.getElementById('nsContent');
    if (!content) return;
    const blob = new Blob([`<html><body>${content.innerHTML}</body></html>`], {
      type: 'text/html',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.currentPage}.html`;
    a.click();
    this.setStatus('Page saved.');
  }

  public printPage(): void {
    window.print();
  }

  public findInPage(): void {
    const term = window.prompt('Find in page:');
    if (!term) return;
    const content = document.getElementById('nsContent');
    if (!content) return;
    const html = content.innerHTML;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    content.innerHTML = html.replace(
      regex,
      '<mark style="background:#ffff00;color:#000">$1</mark>'
    );
    this.setStatus(`Found: "${term}"`);
  }

  public viewSource(): void {
    const content = document.getElementById('nsContent');
    if (!content) return;
    const src = content.innerHTML;
    const w = window.open('', '_blank', 'width=600,height=400');
    if (w) {
      w.document.write(
        `<pre style="font:12px monospace;white-space:pre-wrap">${src.replace(/</g, '&lt;')}</pre>`
      );
    }
  }

  public newWindow(): void {
    this.open();
    this.setStatus('New window opened.');
  }

  public loadImages(): void {
    this.setStatus('Images loaded.');
  }

  // ── Bookmarks ───────────────────────────────────────────────────────────

  public addBookmark(): void {
    const page = NS_PAGES[this.currentPage];
    if (!page) return;
    const placeholder = document.getElementById('ns-bookmarks-placeholder');
    if (placeholder) {
      placeholder.style.display = 'none';
      const menu = placeholder.parentElement;
      if (menu) {
        const item = document.createElement('div');
        item.className = 'ns-item';
        item.textContent = page.title;
        const p = this.currentPage;
        item.onclick = () => this.navigate(p);
        menu.appendChild(item);
      }
    }
    this.setStatus(`Bookmark added: ${page.title}`);
  }

  // ── Toolbar visibility ──────────────────────────────────────────────────

  public toggleToolbar(): void {
    const bar = document.getElementById('nsToolbar');
    if (bar) bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
  }

  public toggleLocation(): void {
    const bar = document.getElementById('nsLocationBar');
    if (bar) bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
  }

  public toggleDirectory(): void {
    const bar = document.getElementById('nsDirBar');
    if (bar) bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
  }

  // ── Scroll thumb ────────────────────────────────────────────────────────

  private setupScrollThumb(): void {
    const content = document.getElementById('nsContent');
    const thumb = document.getElementById('nsScrollThumb');
    if (!content || !thumb) return;
    content.addEventListener('scroll', () => {
      const ratio = content.scrollTop / (content.scrollHeight - content.clientHeight || 1);
      const trackHeight = 200;
      thumb.style.top = `${ratio * (trackHeight - 30)}px`;
    });
  }

  // ── History menu ────────────────────────────────────────────────────────

  private updateHistoryMenu(): void {
    const placeholder = document.getElementById('ns-history-placeholder');
    if (!placeholder) return;
    placeholder.style.display = 'none';
    const menu = placeholder.parentElement;
    if (!menu) return;

    // Remove old dynamic history items
    menu.querySelectorAll('.ns-history-item').forEach((el) => el.remove());

    const sep = document.createElement('div');
    sep.className = 'ns-separator';
    menu.appendChild(sep);

    const recentHistory = this.history.getRecent(10);
    const currentIndex = this.history.getCurrentIndex();
    const totalLength = this.history.length();

    recentHistory.forEach((key, idx) => {
      const page = NS_PAGES[key];
      const item = document.createElement('div');
      item.className = 'ns-item ns-history-item';
      const actualIndex = totalLength - 1 - idx;
      if (actualIndex === currentIndex) {
        item.style.fontWeight = 'bold';
      }

      // If internal page, show its title. If URL, show the truncated URL.
      if (page) {
        item.textContent = page.title.replace(' - Netscape', '');
      } else {
        item.textContent = key.length > 30 ? key.substring(0, 27) + '...' : key;
      }

      item.onclick = () => {
        const histItem = this.history.jumpTo(actualIndex);
        if (histItem) {
          this.renderPage(histItem, true);
        }
      };
      menu.appendChild(item);
    });
  }
}

// ─── Global exposure ─────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  const netscape = new NetscapeNavigator();
  (window as any).Netscape = netscape;

  // Global open function
  (window as any).openNetscape = () => netscape.open();
}

export { };
