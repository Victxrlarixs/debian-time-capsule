import type { NSElements, NSPage } from './netscape-types';

export class NetscapeRenderer {
  constructor(private elements: NSElements) {}

  public updateUIForInternal(page: NSPage): void {
    if (this.elements.urlInput) this.elements.urlInput.value = page.url;
    if (this.elements.title) this.elements.title.textContent = page.title;

    if (this.elements.content) this.elements.content.style.display = 'block';
    if (this.elements.externalView) {
      this.elements.externalView.style.display = 'none';
      this.elements.externalView.src = 'about:blank';
    }

    this.updateDirectoryButtons(page.url);
  }

  public updateUIForExternal(target: string): void {
    if (this.elements.urlInput) this.elements.urlInput.value = target;
    if (this.elements.title) this.elements.title.textContent = `${target} — Netscape`;

    if (this.elements.content) this.elements.content.style.display = 'none';
    if (this.elements.externalView) {
      this.elements.externalView.style.display = 'block';
    }

    this.updateDirectoryButtons(target);
  }

  private updateDirectoryButtons(url: string): void {
    const dirBtns = document.querySelectorAll('.ns-dir-btn');
    dirBtns.forEach((btn) => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.ns-dir-btn[onclick*="${url}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  public setContent(html: string): void {
    if (this.elements.content) {
      this.elements.content.innerHTML = html;
      this.elements.content.scrollTop = 0;
    }
  }

  public setStatus(text: string): void {
    if (this.elements.statusText) {
      this.elements.statusText.textContent = text;
    }
  }

  public setProgress(value: number): void {
    if (this.elements.progressBar) {
      this.elements.progressBar.style.width = `${value}%`;
    }
  }

  public updateNavButtons(canBack: boolean, canForward: boolean): void {
    if (this.elements.backBtn) this.elements.backBtn.disabled = !canBack;
    if (this.elements.forwardBtn) this.elements.forwardBtn.disabled = !canForward;
  }

  public toggleStopBtn(enabled: boolean): void {
    if (this.elements.stopBtn) this.elements.stopBtn.disabled = !enabled;
  }
}
