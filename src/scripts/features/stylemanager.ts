// src/scripts/features/stylemanager.ts

import { CONFIG } from '../core/config';
import { logger } from '../utilities/logger';
import { ThemeModule } from './style/theme';
import { FontModule } from './style/font';
import { MouseModule } from './style/mouse';
import { KeyboardModule } from './style/keyboard';
import { BeepModule } from './style/beep';
import { BackdropModule } from './style/backdrop';
import { WindowModule } from './style/windowmodule';
import { ScreenModule } from './style/screen';
import { StartupModule } from './style/startup';
import { container } from '../core/container';
import type { ISettingsManager } from '../core/interfaces/settings-manager.interface';
import { WindowManager } from '../core/windowmanager';

/**
 * CDE Style Manager for system customization.
 * Orchestrates multiple specialized modules.
 */
export class StyleManager {
  public theme: ThemeModule;
  public font: FontModule;
  public mouse: MouseModule;
  public keyboard: KeyboardModule;
  public beep: BeepModule;
  public backdrop: BackdropModule;
  public windowBehavior: WindowModule;
  public screen: ScreenModule;
  public startup: StartupModule;
  private settingsManager: ISettingsManager;

  constructor() {
    this.settingsManager = container.get<ISettingsManager>('settings');
    this.theme = new ThemeModule();
    this.font = new FontModule();
    this.mouse = new MouseModule();
    this.keyboard = new KeyboardModule();
    this.beep = new BeepModule();
    this.backdrop = new BackdropModule();
    this.windowBehavior = new WindowModule();
    this.screen = new ScreenModule();
    this.startup = new StartupModule();
  }

  // Getters for backward compatibility
  public get styles() {
    return this.theme.styles;
  }
  public get fontStyles() {
    return this.font.fontStyles;
  }
  public get cdePalettes() {
    return this.theme.cdePalettes;
  }
  public get fontPresets() {
    return this.font.fontPresets;
  }

  /**
   * Initializes the Style Manager and all its modules.
   */
  public init(): void {
    const themeSettings = this.settingsManager.getSection('theme');

    // If no saved colors, apply LateSummer as the system default
    if (!themeSettings.colors || Object.keys(themeSettings.colors).length === 0) {
      this.theme.applyCdePalette('latesummer');
    } else {
      this.theme.loadSavedColors(themeSettings.colors);
      // Restore the palette ID if it was saved
      if (themeSettings.paletteId) {
        this.theme.currentPaletteId = themeSettings.paletteId;
      }
    }
    this.font.loadSavedFonts(themeSettings.fonts || {});

    this.mouse.load();
    this.keyboard.load();
    this.beep.load();
    this.backdrop.load();
    this.windowBehavior.load();
    this.screen.load();
    this.startup.load();

    this.bindEvents();
    this.setupColorInputs();
    this.setupFontControls();

    this.theme.updateUI();
    this.font.updateFontControls();
  }

  private bindEvents(): void {
    const styleManagerIcon = document.querySelector(
      '.cde-icon img[src*="appearance"]'
    )?.parentElement;
    if (styleManagerIcon) {
      styleManagerIcon.addEventListener('click', (e) => {
        e.preventDefault();
        this.openMain();
      });
    }

    const closeButtons = {
      '#styleManagerMain .close-btn': () => this.closeMain(),
      '#styleManagerColor .close-btn': () => this.closeColor(),
      '#styleManagerFont .close-btn': () => this.closeFont(),
      '#styleManagerBackdrop .close-btn': () => this.closeBackdrop(),
      '#styleManagerMouse .close-btn': () => this.closeMouse(),
      '#styleManagerKeyboard .close-btn': () => this.closeKeyboard(),
      '#styleManagerWindow .close-btn': () => this.closeWindow(),
      '#styleManagerScreen .close-btn': () => this.closeScreen(),
      '#styleManagerBeep .close-btn': () => this.closeBeep(),
      '#styleManagerStartup .close-btn': () => this.closeStartup(),
    };

    Object.entries(closeButtons).forEach(([selector, action]) => {
      const btn = document.querySelector(selector);
      if (btn) btn.addEventListener('click', action);
    });

    this.bindButton('#styleManagerColor .cde-btn-default', () => this.applyColor());
    this.bindButton('#styleManagerColor .cde-btn:nth-child(2)', () => this.resetColor());
    this.bindButton('#styleManagerColor .cde-btn:nth-child(3)', () => this.saveColor());

    this.bindButton('#styleManagerFont .cde-btn-default', () => this.applyFont());
    this.bindButton('#styleManagerFont .cde-btn:nth-child(2)', () => this.resetFont());
    this.bindButton('#styleManagerFont .cde-btn:nth-child(3)', () => this.saveFont());

    document.querySelectorAll('.cde-preset[data-scheme]').forEach((btn) => {
      btn.addEventListener('click', this.handlePresetClick);
    });

    document.querySelectorAll('.cde-preset[data-preset]').forEach((btn) => {
      btn.addEventListener('click', this.handleFontPresetClick);
    });
  }

  private bindButton(selector: string, action: () => void): void {
    const btn = document.querySelector(selector);
    if (btn) btn.addEventListener('click', action);
  }

  private handlePresetClick = (e: Event): void => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const scheme = target.dataset.scheme;
    if (scheme) {
      this.theme.applyPreset(scheme);
      this.theme.updateUI(); // REFRESH PICKERS
      this.highlightActivePreset(target, '[data-scheme]');
      this.saveColor();
      this.updateStatus(`Theme: ${scheme}`, 'colorStatus');

      // Clear XPM cache and re-render backdrop with new palette colors
      this.backdrop.clearCache();
      this.backdrop.apply();
      // Clear backdrop thumbnail cache
      if ((window as any).clearBackdropThumbnailCache) {
        (window as any).clearBackdropThumbnailCache();
      }
    }
  };

  private handleFontPresetClick = (e: Event): void => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const preset = target.dataset.preset;
    if (preset) {
      this.font.applyFontPreset(preset);
      this.highlightActivePreset(target, '[data-preset]');
      this.saveFont();
      this.updateStatus(`Font: ${preset}`, 'fontStatus');
    }
  };

  private highlightActivePreset(activeButton: HTMLElement, selector: string): void {
    document
      .querySelectorAll(`.cde-preset${selector}`)
      .forEach((btn) => btn.classList.remove('active'));
    activeButton.classList.add('active');
  }

  private setupColorInputs(): void {
    document.querySelectorAll('input[data-var]').forEach((input) => {
      input.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value;
        const cssVar = (e.target as HTMLElement).dataset.var;
        if (cssVar) {
          this.theme.applyStyle(cssVar, val);
          this.theme.updateSwatchForInput(e.target as HTMLInputElement);
          this.saveColor();
        }
      });
    });
  }

  private setupFontControls(): void {
    document
      .querySelectorAll('#styleManagerFont select, #styleManagerFont input')
      .forEach((ctrl) => {
        ctrl.addEventListener('input', (e) => {
          const target = e.target as HTMLInputElement;
          const cssVar = target.dataset.var;
          const unit = target.dataset.unit || '';
          const val = target.value + unit;

          if (cssVar) {
            // Apply style globally and update local map
            this.font.applyFontStyle(cssVar, val);

            // Update specific span text if it's a slider
            if (target.type === 'range') {
              const valueSpan = target.nextElementSibling as HTMLElement;
              if (valueSpan && valueSpan.classList.contains('cde-slidervalue')) {
                valueSpan.textContent = val;
              }
            }

            // Sync with Font Weight Bold if normal weight is changed
            if (cssVar === '--font-weight-normal' && parseInt(target.value) >= 600) {
              this.font.applyFontStyle(
                '--font-weight-bold',
                String(Math.min(parseInt(target.value) + 100, 900))
              );
            } else if (cssVar === '--font-weight-normal') {
              this.font.applyFontStyle('--font-weight-bold', '700');
            }

            // Refresh preview and save
            this.font.updateFontPreview();
            this.saveFont();
          }
        });
      });
  }

  // Windows
  public openMain(): void {
    this.showWindow('styleManagerMain');
  }
  public closeMain(): void {
    this.hideWindow('styleManagerMain');
  }
  public openColor(): void {
    this.showWindow('styleManagerColor');
    this.theme.updateUI();
  }
  public closeColor(): void {
    this.hideWindow('styleManagerColor');
  }
  public openFont(): void {
    this.showWindow('styleManagerFont');
    this.font.updateFontControls();
  }
  public closeFont(): void {
    this.hideWindow('styleManagerFont');
  }
  public openBackdrop(): void {
    this.showWindow('styleManagerBackdrop');
    this.backdrop.syncUI();
  }
  public closeBackdrop(): void {
    this.hideWindow('styleManagerBackdrop');
  }
  public openMouse(): void {
    this.showWindow('styleManagerMouse');
    this.mouse.syncUI();
  }
  public closeMouse(): void {
    this.hideWindow('styleManagerMouse');
  }
  public openKeyboard(): void {
    this.showWindow('styleManagerKeyboard');
    this.keyboard.syncUI();
  }
  public closeKeyboard(): void {
    this.hideWindow('styleManagerKeyboard');
  }
  public openWindow(): void {
    this.showWindow('styleManagerWindow');
    this.windowBehavior.syncUI();
  }
  public closeWindow(): void {
    this.hideWindow('styleManagerWindow');
  }
  public openScreen(): void {
    this.showWindow('styleManagerScreen');
    this.screen.syncUI();
  }
  public closeScreen(): void {
    this.hideWindow('styleManagerScreen');
  }
  public openBeep(): void {
    this.showWindow('styleManagerBeep');
    this.beep.syncUI();
  }
  public closeBeep(): void {
    this.hideWindow('styleManagerBeep');
  }
  public openStartup(): void {
    this.showWindow('styleManagerStartup');
    this.startup.syncUI();
  }
  public closeStartup(): void {
    this.hideWindow('styleManagerStartup');
  }

  private showWindow(id: string): void {
    WindowManager.showWindow(id);

    const win = document.getElementById(id);
    if (win) {
      win.style.zIndex = '10000';
    }
  }

  private hideWindow(id: string): void {
    const win = document.getElementById(id);
    if (win) win.style.display = 'none';
  }

  public applyColor(): void {
    this.theme.applyColor();
    this.showMessage('Colors applied.');
    // Clear XPM cache and re-render backdrop with new colors
    this.backdrop.clearCache();
    this.backdrop.apply();
    // Clear backdrop thumbnail cache
    if ((window as any).clearBackdropThumbnailCache) {
      (window as any).clearBackdropThumbnailCache();
    }
  }
  public applyFont(): void {
    this.font.applyFont();
    this.showMessage('Fonts applied.');
  }
  public resetColor(): void {
    this.theme.resetColor();
    this.theme.updateUI();
    this.saveColor();
    // Clear XPM cache and re-render backdrop with reset colors
    this.backdrop.clearCache();
    this.backdrop.apply();
    // Clear backdrop thumbnail cache
    if ((window as any).clearBackdropThumbnailCache) {
      (window as any).clearBackdropThumbnailCache();
    }
  }
  public resetFont(): void {
    this.font.resetFont();
    this.font.updateFontControls();
    this.saveFont();
  }

  public saveColor(): void {
    const theme = this.settingsManager.getSection('theme');
    theme.colors = this.theme.styles;
    theme.paletteId = this.theme.currentPaletteId || undefined;
    this.settingsManager.setSection('theme', theme);
  }

  public saveFont(): void {
    const theme = this.settingsManager.getSection('theme');
    theme.fonts = this.font.fontStyles;
    this.settingsManager.setSection('theme', theme);
  }

  private updateStatus(msg: string, id: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  public showMessage(message: string): void {
    const msgBox = document.createElement('div');
    msgBox.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: var(--modal-bg, #c0c0c0); border: 2px solid; padding: 20px; z-index: 100000;
      font-family: var(--font-family-base, monospace); font-size: 12px;
      box-shadow: 4px 4px 0 var(--shadow-color, #000000); min-width: 200px; text-align: center;
    `;
    msgBox.innerHTML = `<div>${message}</div>`;
    document.body.appendChild(msgBox);
    setTimeout(() => msgBox.remove(), 2000);
  }
}

// Global exposure
declare global {
  interface Window {
    updateMouseSetting: (k: string, v: any) => void;
    syncMouseControls: () => void;
  }
}

const manager = new StyleManager();
window.styleManager = manager;
window.updateMouseSetting = (k, v) =>
  manager.mouse.update(k as keyof typeof manager.mouse.settings, v);
window.syncMouseControls = () => manager.mouse.syncUI();
