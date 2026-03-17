import { WindowManager } from '../core/windowmanager';
import { logger } from '../utilities/logger';
import { openWindow, closeWindow } from '../shared/window-helpers';
import { HistoryManager } from '../shared/history-manager';
import netscapePages from '../../data/netscape-pages.json';

import type { NSPage, NSElements } from './netscape/netscape-types';
import { NetscapeAnimator } from './netscape/netscape-animator';
import { NetscapeRenderer } from './netscape/netscape-renderer';
import { NetscapeNavigatorEngine } from './netscape/netscape-navigator-engine';

/**
 * Netscape Navigator - SOLID Implementation
 * Coordinates Navigation Engine, History, UI Rendering, and Animations.
 */
class NetscapeNavigator {
  private id = 'netscape';
  private history: HistoryManager<string>;
  private currentPage = 'whats-new';
  private isLoading = false;
  
  private nsPages: Record<string, NSPage> = {};
  private engine!: NetscapeNavigatorEngine;
  private renderer!: NetscapeRenderer;
  private animator!: NetscapeAnimator;
  private elements!: NSElements;

  constructor() {
    this.history = new HistoryManager<string>('whats-new');
    this.initPages();
    this.init();
  }

  private initPages(): void {
    Object.entries(netscapePages).forEach(([key, value]) => {
      this.nsPages[key] = {
        title: value.title,
        url: value.url,
        content: () => value.content,
      };
    });
    this.engine = new NetscapeNavigatorEngine(this.nsPages);
  }

  private init(): void {
    if (typeof document === 'undefined') return;

    this.elements = {
      win: document.getElementById('netscape'),
      content: document.getElementById('nsContent'),
      externalView: document.getElementById('nsExternalView') as HTMLIFrameElement,
      urlInput: document.getElementById('nsUrlInput') as HTMLInputElement,
      title: document.getElementById('netscape-title'),
      statusText: document.getElementById('nsStatusText'),
      progressBar: document.getElementById('nsProgressBar'),
      logo: document.getElementById('nsNLogo'),
      starsContainer: document.getElementById('nsNStars'),
      stopBtn: document.getElementById('ns-btn-stop') as HTMLButtonElement,
      backBtn: document.getElementById('ns-btn-back') as HTMLButtonElement,
      forwardBtn: document.getElementById('ns-btn-forward') as HTMLButtonElement,
      scrollThumb: document.getElementById('nsScrollThumb'),
      toolbar: document.getElementById('nsToolbar'),
      locationBar: document.getElementById('nsLocationBar'),
      dirBar: document.getElementById('nsDirBar'),
    };

    this.renderer = new NetscapeRenderer(this.elements);
    this.animator = new NetscapeAnimator(this.elements.logo, this.elements.starsContainer);

    logger.log('[Netscape] Initialized with SOLID architecture');
    this.renderPage('whats-new', false);
    this.setupScrollThumb();
  }

  // ── Window Controls ─────────────────────────────────────────────────────

  public open(): void {
    openWindow({
      id: this.id,
      zIndex: 10000,
      center: true,
      playSound: false,
    });
    logger.log('[Netscape] Window opened');
  }

  public close(): void {
    closeWindow(this.id);
    this.stopLoading();
    logger.log('[Netscape] Window closed');
  }

  // ── Navigation ──────────────────────────────────────────────────────────

  public navigate(path: string): void {
    const target = this.engine.normalizeUrl(path);
    if (target === this.currentPage) return;

    this.history.push(target);
    this.renderPage(target, true);
    this.updateHistoryMenu();
  }

  public goBack(): void {
    const prev = this.history.back();
    if (prev) this.renderPage(prev, true);
  }

  public goForward(): void {
    if ((window as any).AudioManager) (window as any).AudioManager.click();
    const next = this.history.forward();
    if (next) this.renderPage(next, true);
  }

  public goHome(): void {
    if ((window as any).AudioManager) (window as any).AudioManager.click();
    this.navigate('welcome');
  }

  public reload(): void {
    if ((window as any).AudioManager) (window as any).AudioManager.click();
    this.renderPage(this.currentPage, true);
  }

  private renderPage(target: string, animate: boolean): void {
    this.currentPage = target;
    const internalKey = this.engine.isInternalPage(target);

    if (internalKey) {
      const page = this.nsPages[internalKey];
      this.renderer.updateUIForInternal(page);

      if (animate) {
        this.startLoading(() => {
          this.renderer.setContent(page.content());
        });
      } else {
        this.renderer.setContent(page.content());
        this.renderer.setStatus('Document: Done');
      }
    } else {
      this.renderer.updateUIForExternal(target);
      const engineUrl = this.engine.getExternalUrl(target);
      this.renderer.setStatus(`Loading ${target}...`);

      if (animate) {
        this.startLoadingExternal(engineUrl);
      } else {
        if (this.elements.externalView) this.elements.externalView.src = engineUrl;
        this.renderer.setStatus('Document: Done');
      }
    }

    this.renderer.updateNavButtons(this.history.canGoBack(), this.history.canGoForward());
  }

  private startLoading(onComplete: () => void): void {
    if (this.isLoading) this.stopLoading();
    this.isLoading = true;

    this.toggleLoadingUI(true);
    this.renderer.setStatus('Connecting...');
    this.renderer.setProgress(0);

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
        this.renderer.setStatus(status);
        this.renderer.setProgress(prog);
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
    this.renderer.setStatus(`Looking for site: ${url}...`);
    this.renderer.setProgress(10);

    if (url.includes('google.com') || url.includes('github.com')) {
      setTimeout(() => {
        if (this.isLoading) this.renderer.setStatus('NOTICE: Site may block vintage view. Try a search term instead.');
      }, 1500);
    }

    if (this.elements.externalView) {
      setTimeout(() => { if (this.isLoading) { this.renderer.setStatus('Connect: Contacting host...'); this.renderer.setProgress(30); } }, 400);
      setTimeout(() => {
        if (this.isLoading) {
          this.renderer.setStatus('Waiting for reply...');
          this.renderer.setProgress(50);
          this.elements.externalView!.src = url;
        }
      }, 800);

      const onIframeLoad = () => {
        if (!this.isLoading) return;
        this.renderer.setStatus('Document: Done');
        this.renderer.setProgress(100);
        setTimeout(() => this.stopLoading(), 200);
        this.elements.externalView?.removeEventListener('load', onIframeLoad);
      };
      this.elements.externalView.addEventListener('load', onIframeLoad);

      setTimeout(() => { if (this.isLoading) { this.renderer.setStatus('Document: Done'); this.renderer.setProgress(100); this.stopLoading(); } }, 8000);
    }
  }

  private toggleLoadingUI(active: boolean): void {
    this.renderer.toggleStopBtn(active);
    if (active) this.animator.startLoading();
    else this.animator.stopLoading();
  }

  private stopLoading(): void {
    this.isLoading = false;
    this.toggleLoadingUI(false);
    setTimeout(() => this.renderer.setProgress(0), 500);
  }

  public stop(): void {
    if ((window as any).AudioManager) (window as any).AudioManager.click();
    this.stopLoading();
    this.renderer.setStatus('Transfer interrupted.');
  }

  // ── Browser Logic ───────────────────────────────────────────────────────

  public handleUrlKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      const url = (e.target as HTMLInputElement).value.trim();
      if (url) this.navigate(url);
    }
  }

  public openLocation(): void {
    if (this.elements.urlInput) {
      this.elements.urlInput.focus();
      this.elements.urlInput.select();
    }
  }

  public savePage(): void {
    if (!this.elements.content) return;
    const blob = new Blob([`<html><body>${this.elements.content.innerHTML}</body></html>`], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.currentPage}.html`;
    a.click();
    this.renderer.setStatus('Page saved.');
  }

  public findInPage(): void {
    const term = window.prompt('Find in page:');
    if (!term || !this.elements.content) return;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    this.elements.content.innerHTML = this.elements.content.innerHTML.replace(regex, '<mark style="background:#ffff00;color:#000">$1</mark>');
    this.renderer.setStatus(`Found: "${term}"`);
  }

  public openFile(): void { this.renderer.setStatus('Open File: not supported in this environment.'); }
  public printPage(): void { window.print(); }
  public viewSource(): void {
    if (!this.elements.content) return;
    const w = window.open('', '_blank', 'width=600,height=400');
    if (w) w.document.write(`<pre style="font:12px monospace;white-space:pre-wrap">${this.elements.content.innerHTML.replace(/</g, '&lt;')}</pre>`);
  }
  public newWindow(): void { this.open(); this.renderer.setStatus('New window opened.'); }
  public loadImages(): void { this.renderer.setStatus('Images loaded.'); }

  public addBookmark(): void {
    const page = this.nsPages[this.currentPage];
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
    this.renderer.setStatus(`Bookmark added: ${page.title}`);
  }

  public toggleToolbar = () => this.toggleEl(this.elements.toolbar);
  public toggleLocation = () => this.toggleEl(this.elements.locationBar);
  public toggleDirectory = () => this.toggleEl(this.elements.dirBar);

  private toggleEl(el: HTMLElement | null): void {
    if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
  }

  private setupScrollThumb(): void {
    const { content, scrollThumb } = this.elements;
    if (!content || !scrollThumb) return;
    content.addEventListener('scroll', () => {
      const ratio = content.scrollTop / (content.scrollHeight - content.clientHeight || 1);
      scrollThumb.style.top = `${ratio * 170}px`;
    });
  }

  private updateHistoryMenu(): void {
    const placeholder = document.getElementById('ns-history-placeholder');
    if (!placeholder) return;
    placeholder.style.display = 'none';
    const menu = placeholder.parentElement;
    if (!menu) return;

    menu.querySelectorAll('.ns-history-item').forEach((el) => el.remove());
    
    const sep = document.createElement('div');
    sep.className = 'ns-separator';
    menu.appendChild(sep);

    const recentHistory = this.history.getRecent(10);
    const currentIndex = this.history.getCurrentIndex();
    const totalLength = this.history.length();

    recentHistory.forEach((key, idx) => {
      const page = this.nsPages[key];
      const item = document.createElement('div');
      item.className = 'ns-item ns-history-item';
      const actualIndex = totalLength - 1 - idx;
      if (actualIndex === currentIndex) item.style.fontWeight = 'bold';
      item.textContent = page ? page.title.replace(' - Netscape', '') : (key.length > 30 ? key.substring(0, 27) + '...' : key);
      item.onclick = () => {
        const histItem = this.history.jumpTo(actualIndex);
        if (histItem) this.renderPage(histItem, true);
      };
      menu.appendChild(item);
    });
  }
}

// ── Singleton & Global Exposure ─────────────────────────────────────────────

if (typeof window !== 'undefined') {
  const netscape = new NetscapeNavigator();
  (window as any).Netscape = netscape;
  (window as any).openNetscape = () => netscape.open();
}

export {};
