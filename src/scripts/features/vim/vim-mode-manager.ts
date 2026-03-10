import type { VimMode, VimElements } from './vim-types.js';

/**
 * Mode Manager - Single Responsibility: Handle mode transitions and UI updates
 */
export class VimModeManager {
  private mode: VimMode = 'normal';
  private visualStartPos: number = 0;

  constructor(private elements: VimElements) {}

  setMode(mode: VimMode): void {
    this.mode = mode;

    if (!this.elements.textarea || !this.elements.modeDisplay) return;

    // Remove all mode classes
    this.elements.textarea.classList.remove(
      'vim-normal-mode', 
      'vim-insert-mode', 
      'vim-visual-mode', 
      'vim-visual-line-mode'
    );

    switch (mode) {
      case 'normal':
        this.setNormalMode();
        break;
      case 'insert':
        this.setInsertMode();
        break;
      case 'visual':
        this.setVisualMode();
        break;
      case 'visual-line':
        this.setVisualLineMode();
        break;
      case 'command':
        this.setCommandMode();
        break;
    }
  }

  private setNormalMode(): void {
    this.elements.textarea!.readOnly = false;
    this.elements.textarea!.classList.add('vim-normal-mode');
    this.elements.modeDisplay!.textContent = '';
    if (this.elements.commandLine) this.elements.commandLine.style.display = 'none';
    setTimeout(() => this.elements.textarea?.focus(), 10);
  }

  private setInsertMode(): void {
    this.elements.textarea!.readOnly = false;
    this.elements.textarea!.classList.add('vim-insert-mode');
    this.elements.modeDisplay!.textContent = '-- INSERT --';
    if (this.elements.commandLine) this.elements.commandLine.style.display = 'none';
    setTimeout(() => this.elements.textarea?.focus(), 10);
  }

  private setVisualMode(): void {
    this.elements.textarea!.readOnly = false;
    this.elements.textarea!.classList.add('vim-visual-mode');
    this.elements.modeDisplay!.textContent = '-- VISUAL --';
    this.visualStartPos = this.elements.textarea!.selectionStart;
    if (this.elements.commandLine) this.elements.commandLine.style.display = 'none';
    setTimeout(() => this.elements.textarea?.focus(), 10);
  }

  private setVisualLineMode(): void {
    this.elements.textarea!.readOnly = false;
    this.elements.textarea!.classList.add('vim-visual-line-mode');
    this.elements.modeDisplay!.textContent = '-- VISUAL LINE --';
    this.selectCurrentLine();
    if (this.elements.commandLine) this.elements.commandLine.style.display = 'none';
    setTimeout(() => this.elements.textarea?.focus(), 10);
  }

  private setCommandMode(): void {
    this.elements.textarea!.readOnly = false;
    if (this.elements.commandLine) {
      this.elements.commandLine.style.display = 'flex';
      setTimeout(() => this.elements.commandInput?.focus(), 10);
    }
  }

  private selectCurrentLine(): void {
    if (!this.elements.textarea) return;
    const ta = this.elements.textarea;
    const pos = ta.selectionStart;
    const text = ta.value;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const lineEnd = text.indexOf('\n', pos);
    const end = lineEnd === -1 ? text.length : lineEnd + 1;
    
    this.visualStartPos = lineStart;
    ta.setSelectionRange(lineStart, end);
  }

  getMode(): VimMode {
    return this.mode;
  }

  getVisualStartPos(): number {
    return this.visualStartPos;
  }

  isVisualMode(): boolean {
    return this.mode === 'visual' || this.mode === 'visual-line';
  }
}