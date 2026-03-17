export class NetscapeAnimator {
  private starInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private logo: HTMLElement | null,
    private starsContainer: HTMLElement | null
  ) {}

  public startLoading(): void {
    if (this.logo) {
      this.logo.classList.add('ns-loading');
    }

    if (!this.starInterval && this.starsContainer) {
      this.starInterval = setInterval(() => {
        if (!this.starsContainer) return;
        const star = document.createElement('div');
        star.className = 'ns-n-star';
        star.style.left = `${Math.random() * 50}px`;
        star.style.top = `${Math.random() * 10}px`;
        star.style.width = `${Math.random() > 0.5 ? 3 : 2}px`;
        star.style.height = star.style.width;
        this.starsContainer.appendChild(star);
        setTimeout(() => star.remove(), 800);
      }, 100);
    }
  }

  public stopLoading(): void {
    if (this.logo) {
      this.logo.classList.remove('ns-loading');
    }

    if (this.starInterval) {
      clearInterval(this.starInterval);
      this.starInterval = null;
    }
  }
}
