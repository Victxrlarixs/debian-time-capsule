import { logger } from '../utilities/logger';
import { VFS } from '../core/vfs';
import { CDEModal } from '../ui/modals';
import { WindowManager } from '../core/windowmanager';
import { openWindow, closeWindow, createZIndexManager } from '../shared/window-helpers';

/**
 * Emacs-style Editor Manager (Rebranded)
 * Supports a splash screen and full editing mode with keybindings, mode line, and minibuffer.
 */
declare global {
  interface Window {
    openEmacs?: (filename: string, content: string, path?: string) => Promise<void>;
    closeEmacs: () => void;
    Emacs: {
      open: (filename?: string, content?: string) => Promise<void>;
      openSplash: () => void;
      openFile: () => Promise<void>;
      close: () => void;
      save: () => Promise<void>;
      saveAs: () => Promise<void>;
      newFile: () => Promise<void>;
      undo: () => void;
      cut: () => void;
      copy: () => void;
      paste: () => void;
      selectAll: () => void;
      wrapToggle: () => void;
      setFont: (size: string) => void;
      clearBuffer: () => Promise<void>;
      showHelp: () => void;
      findDialog: () => void;
      closeFindBar: () => void;
      findNext: () => void;
      findPrev: () => void;
    };
  }
}

class EmacsManager {
  private win: HTMLElement | null = null;
  private textarea: HTMLTextAreaElement | null = null;
  private minibuffer: HTMLElement | null = null;
  private minibufferContent: HTMLElement | null = null;
  private minibufferLabel: HTMLElement | null = null;
  private minibufferInput: HTMLInputElement | null = null;
  private minibufferMsg: HTMLElement | null = null;
  private splash: HTMLElement | null = null;
  private editorArea: HTMLElement | null = null;

  private isMinibufferActive: boolean = false;
  private minibufferResolver: ((val: string | null) => void) | null = null;

  private currentFilePath: string = '';
  private isModified: boolean = false;
  private zIndexManager = createZIndexManager(20000);
  private ctrlXPressed: boolean = false;
  private wordWrap: boolean = false;

  // Find state
  private findIndex: number = 0;
  private lastQuery: string = '';

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof document === 'undefined') return;

    this.win = document.getElementById('emacs');
    this.textarea = document.getElementById('emacs-textarea') as HTMLTextAreaElement;
    this.minibuffer = document.getElementById('emacs-minibuffer');
    this.minibufferContent = document.getElementById('emacs-minibuffer-content');
    this.minibufferLabel = document.getElementById('emacs-minibuffer-label');
    this.minibufferInput = document.getElementById('emacs-minibuffer-input') as HTMLInputElement;
    this.minibufferMsg = document.getElementById('emacs-minibuffer-msg');
    this.splash = document.getElementById('emacs-splash');
    this.editorArea = document.getElementById('emacs-editor-area');

    if (!this.win || !this.textarea || !this.minibufferInput) return;

    this.win.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.textarea.addEventListener('input', () => this.onInput());
    this.textarea.addEventListener('keyup', () => this.updateModeLine());
    this.textarea.addEventListener('click', () => {
      this.textarea?.focus();
      this.updateModeLine();
    });

    // Minibuffer input listeners
    this.minibufferInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = this.minibufferInput?.value ?? '';
        this.resolveMinibuffer(val);
      } else if (e.key === 'Escape' || (e.ctrlKey && e.key === 'g')) {
        e.preventDefault();
        this.resolveMinibuffer(null);
      }
    });

    // Find bar enter / escape
    const findInput = document.getElementById('te-find-input') as HTMLInputElement | null;
    if (findInput) {
      findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.findNext();
        if (e.key === 'Escape') this.closeFindBar();
      });
    }

    // ── Menubar dropdown toggle ────────────────────────────────────────
    document.querySelectorAll('#emacs .te-menu-label').forEach((lbl) => {
      lbl.addEventListener('click', () => {
        const menu = lbl.parentElement as HTMLElement | null;
        if (!menu) return;
        const wasOpen = menu.classList.contains('open');
        document
          .querySelectorAll('#emacs .te-menu.open')
          .forEach((m) => m.classList.remove('open'));
        if (!wasOpen) menu.classList.add('open');
      });
    });

    document.addEventListener(
      'click',
      (e) => {
        if (!(e.target as Element).closest('#emacs .te-menubar')) {
          document
            .querySelectorAll('#emacs .te-menu.open')
            .forEach((m) => m.classList.remove('open'));
        }
      },
      true
    );

    document.querySelectorAll('#emacs .te-item').forEach((item) => {
      item.addEventListener('click', () => {
        document
          .querySelectorAll('#emacs .te-menu.open')
          .forEach((m) => m.classList.remove('open'));
      });
    });

    logger.log('[Emacs] Initialized');
  }

  // ── Show / hide splash vs editing area ───────────────────────────────────

  private showSplash(): void {
    this.splash?.classList.remove('emacs-hidden');
    this.editorArea?.classList.add('emacs-hidden');
  }

  private showEditor(): void {
    this.splash?.classList.add('emacs-hidden');
    this.editorArea?.classList.remove('emacs-hidden');
  }

  // ── Open / Close ─────────────────────────────────────────────────────────

  /** Opens the splash screen (no file). */
  public openSplash(): void {
    if (!this.win) return;
    this.currentFilePath = '';
    this.isModified = false;
    this.showSplash();
    this.updateTitle('XEmacs');
    this.updateModeLineName('*scratch*');

    // Set scratch buffer content
    if (this.textarea) {
      this.textarea.value =
        ';; This buffer is for text that is not saved, and for Lisp evaluation.\n;; To create a file, visit it with C-x C-f and enter text in its buffer.\n\n';
      this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length);
    }

    this.message('Welcome to XEmacs');

    openWindow({
      id: 'emacs',
      zIndex: this.zIndexManager.increment(),
      center: true,
      playSound: true,
      focus: true,
      onOpen: () => {
        // Reset size to defaults if they were messed up, but respecting viewport
        if (this.win) {
          this.win.style.width = 'min(800px, 90vw)';
          this.win.style.height = 'min(600px, 80vh)';
          WindowManager.centerWindow(this.win);
          this.win.focus();
        }
      },
    });
  }

  /** Opens a specific file for editing. */
  public async open(filename: string, content: string = '', path: string = ''): Promise<void> {
    if (!this.win || !this.textarea) return;

    this.currentFilePath = path || filename;
    this.textarea.value = content;
    this.isModified = false;

    this.showEditor();
    this.updateTitle(`XEmacs: ${filename}`);
    this.updateModeLineName(filename);
    this.updateModeLine();
    this.message(`Loaded: ${filename}`);

    WindowManager.showWindow('emacs');
    this.win.style.zIndex = String(WindowManager.getNextZIndex());

    // Reset size to defaults
    this.win.style.width = 'min(900px, 95vw)';
    this.win.style.height = 'min(700px, 85vh)';

    WindowManager.centerWindow(this.win);
    if (window.focusWindow) window.focusWindow('emacs');
    if (window.AudioManager) window.AudioManager.windowOpen();
    this.textarea.focus();
  }

  public close(): void {
    if (!this.win) return;
    closeWindow('emacs');
    this.currentFilePath = '';
    this.ctrlXPressed = false;
    this.closeFindBar();
  }

  private updateTitle(text: string): void {
    const titleEl = document.getElementById('emacs-title');
    if (titleEl) titleEl.textContent = text;
  }

  private updateModeLineName(name: string): void {
    const fileNameEl = document.getElementById('emacs-file-name');
    if (fileNameEl) fileNameEl.textContent = name;
  }

  // ── Minibuffer Prompter ──────────────────────────────────────────────────

  private promptMinibuffer(label: string, defaultValue: string = ''): Promise<string | null> {
    if (!this.minibufferContent || !this.minibufferLabel || !this.minibufferInput)
      return Promise.resolve(null);

    this.isMinibufferActive = true;

    // Hide messages
    if (this.minibufferMsg) this.minibufferMsg.style.display = 'none';

    this.minibufferLabel.textContent = label;
    this.minibufferInput.value = defaultValue;
    this.minibufferContent.style.display = 'flex';
    this.minibufferInput.focus();

    return new Promise((resolve) => {
      this.minibufferResolver = resolve;
    });
  }

  private resolveMinibuffer(val: string | null): void {
    if (!this.isMinibufferActive) return;

    this.isMinibufferActive = false;
    if (this.minibufferContent) this.minibufferContent.style.display = 'none';
    if (this.minibufferLabel) this.minibufferLabel.textContent = '';

    // Show messages space again
    if (this.minibufferMsg) {
      this.minibufferMsg.style.display = 'inline';
      this.minibufferMsg.textContent = '';
    }

    if (this.minibufferInput) {
      this.minibufferInput.value = '';
      this.minibufferInput.blur();
    }

    if (this.minibufferResolver) {
      this.minibufferResolver(val);
      this.minibufferResolver = null;
    }

    if (!this.editorArea?.classList.contains('emacs-hidden')) {
      this.textarea?.focus();
    } else {
      this.win?.focus();
    }
  }

  // ── File Menu ─────────────────────────────────────────────────────────────

  /** Called from splash "Open a File" link or File→Open */
  public async openFile(): Promise<void> {
    const input = await this.promptMinibuffer('Visit file: ', '');
    if (!input) {
      this.message('Quit');
      return;
    }

    let fullPath: string;
    if (input.startsWith('/')) {
      fullPath = input;
    } else {
      fullPath = `/home/victxrlarixs/Desktop/${input}`;
    }

    const node = VFS.getNode(fullPath);
    if (!node) {
      // New file
      const parts = fullPath.split('/');
      const filename = parts.pop()!;
      const parentDir = parts.join('/') + '/';
      if (!VFS.getNode(parentDir)) {
        this.message(`No such directory: ${parentDir}`);
        return;
      }
      await VFS.touch(parentDir, filename);
      await this.open(filename, '', fullPath);
      this.message(`(New file) ${fullPath}`);
      return;
    }

    if (node.type !== 'file') {
      this.message(`${fullPath} is a directory.`);
      if (window.AudioManager) window.AudioManager.error();
      return;
    }

    const filename = fullPath.split('/').pop()!;
    await this.open(filename, node.content, fullPath);
  }

  public async save(): Promise<void> {
    if (!this.currentFilePath) {
      await this.saveAs();
      return;
    }
    try {
      const existing = VFS.getNode(this.currentFilePath);
      if (!existing) {
        const parts = this.currentFilePath.split('/');
        const filename = parts.pop()!;
        const parentDir = parts.join('/') + '/';
        await VFS.touch(parentDir, filename);
      }
      await VFS.writeFile(this.currentFilePath, this.textarea!.value);
      this.isModified = false;
      this.updateModeLine();
      this.message(`Wrote ${this.currentFilePath}`);
      if (window.AudioManager) window.AudioManager.success();
    } catch {
      this.message('Error: could not save file.');
      if (window.AudioManager) window.AudioManager.error();
    }
  }

  public async saveAs(): Promise<void> {
    const defaultPath = this.currentFilePath || 'untitled.txt';
    const input = await this.promptMinibuffer('Write file: ', defaultPath);
    if (!input) {
      this.message('Quit');
      return;
    }

    const fullPath = input.startsWith('/') ? input : `/home/victxrlarixs/Desktop/${input}`;
    const parts = fullPath.split('/');
    const filename = parts.pop()!;
    const parentDir = parts.join('/') + '/';

    if (!VFS.getNode(parentDir)) {
      this.message(`No such directory: ${parentDir}`);
      if (window.AudioManager) window.AudioManager.error();
      return;
    }

    const existing = VFS.getNode(fullPath);
    if (!existing) await VFS.touch(parentDir, filename);

    this.currentFilePath = fullPath;
    this.updateTitle(`XEmacs: ${filename}`);
    this.updateModeLineName(filename);
    await this.save();
  }

  public async newFile(): Promise<void> {
    if (this.isModified) {
      const ok = await CDEModal.confirm('Discard unsaved changes and open a new buffer?');
      if (!ok) return;
    }
    this.currentFilePath = '';
    this.textarea!.value = '';
    this.isModified = false;
    this.showEditor();
    this.updateTitle('XEmacs: untitled.txt');
    this.updateModeLineName('untitled.txt');
    this.updateModeLine();
    this.message('New file.');
    this.textarea!.focus();
  }

  // ── Edit Menu ─────────────────────────────────────────────────────────────

  public undo(): void {
    document.execCommand('undo');
    this.onInput();
  }
  public cut(): void {
    document.execCommand('cut');
    this.onInput();
  }
  public copy(): void {
    document.execCommand('copy');
    this.message('Copied.');
  }

  public paste(): void {
    navigator.clipboard
      .readText()
      .then((text) => {
        const ta = this.textarea!;
        const s = ta.selectionStart,
          e = ta.selectionEnd;
        ta.value = ta.value.substring(0, s) + text + ta.value.substring(e);
        ta.selectionStart = ta.selectionEnd = s + text.length;
        this.onInput();
      })
      .catch(() => this.message('Yank: clipboard unavailable.'));
  }

  public selectAll(): void {
    this.textarea!.select();
  }

  // ── Format / Options ──────────────────────────────────────────────────────

  public wrapToggle(): void {
    this.wordWrap = !this.wordWrap;
    this.textarea!.style.whiteSpace = this.wordWrap ? 'pre-wrap' : 'pre';
    this.message(`Visual Line mode: ${this.wordWrap ? 'enabled' : 'disabled'}`);
  }

  public setFont(size: string): void {
    this.textarea!.style.fontSize = size;
    this.message(`Default font size: ${size}`);
  }

  public async clearBuffer(): Promise<void> {
    const ok = await CDEModal.confirm('Clear the entire buffer?');
    if (!ok) return;
    this.textarea!.value = '';
    this.onInput();
    this.message('Buffer cleared.');
  }

  public showHelp(): void {
    this.message('Bindings: C-x C-s Save  C-x C-c Quit  C-s Search  C-k Kill  C-_ Undo  C-g Abort');
  }

  // ── Find ──────────────────────────────────────────────────────────────────

  public findDialog(): void {
    const bar = document.getElementById('te-find-bar');
    if (!bar) return;
    const hidden = bar.classList.contains('te-find-hidden');
    bar.classList.toggle('te-find-hidden', !hidden);
    if (hidden) {
      const input = document.getElementById('te-find-input') as HTMLInputElement | null;
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  public closeFindBar(): void {
    document.getElementById('te-find-bar')?.classList.add('te-find-hidden');
    this.textarea?.focus();
  }

  public findNext(): void {
    this.find(1);
  }
  public findPrev(): void {
    this.find(-1);
  }

  private find(dir: 1 | -1): void {
    const query =
      (document.getElementById('te-find-input') as HTMLInputElement | null)?.value ?? '';
    if (!query) return;

    const text = this.textarea!.value.toLowerCase();
    const q = query.toLowerCase();
    const matches: number[] = [];
    let i = text.indexOf(q);
    while (i !== -1) {
      matches.push(i);
      i = text.indexOf(q, i + 1);
    }

    if (!matches.length) {
      this.message(`Search failed: ${query}`);
      if (window.AudioManager) window.AudioManager.error();
      return;
    }

    if (query !== this.lastQuery) {
      this.findIndex = 0;
      this.lastQuery = query;
    } else {
      this.findIndex = (this.findIndex + dir + matches.length) % matches.length;
    }

    const pos = matches[this.findIndex];
    this.textarea!.setSelectionRange(pos, pos + query.length);
    this.textarea!.focus();
    this.message(`${this.findIndex + 1}/${matches.length}: ${query}`);
  }

  // ── Keybindings ───────────────────────────────────────────────────────────

  private handleKeydown(e: KeyboardEvent): void {
    if (this.isMinibufferActive) return; // Ignore main shortcuts when minibuffer is busy

    const isCtrl = e.ctrlKey;
    const key = e.key.toLowerCase();

    if (isCtrl && key === 'x') {
      e.preventDefault();
      this.ctrlXPressed = true;
      this.message('C-x-');
      return;
    }

    if (this.ctrlXPressed) {
      this.ctrlXPressed = false;
      this.message('');
      if (isCtrl && key === 's') {
        e.preventDefault();
        this.save();
        return;
      }
      if (isCtrl && key === 'c') {
        e.preventDefault();
        this.close();
        return;
      }
      if (isCtrl && key === 'f') {
        e.preventDefault();
        this.openFile();
        return;
      }
      if (isCtrl && key === 'w') {
        e.preventDefault();
        this.saveAs();
        return;
      }
      if (key === 'h') {
        e.preventDefault();
        this.selectAll();
        return;
      }
    }

    // M-x (Alt+x)
    if (e.altKey && key === 'x') {
      e.preventDefault();
      this.executeCommand();
      return;
    }

    if (isCtrl) {
      switch (key) {
        case 'a':
          e.preventDefault();
          this.moveCursor('home');
          break;
        case 'e':
          e.preventDefault();
          this.moveCursor('end');
          break;
        case 'p':
          e.preventDefault();
          this.moveCursor('up');
          break;
        case 'n':
          e.preventDefault();
          this.moveCursor('down');
          break;
        case 'f':
          e.preventDefault();
          this.moveCursor('right');
          break;
        case 'b':
          e.preventDefault();
          this.moveCursor('left');
          break;
        case 'd':
          e.preventDefault();
          this.deleteChar();
          break;
        case 's':
          e.preventDefault();
          this.findDialog();
          break;
        case 'k':
          e.preventDefault();
          this.killLine();
          break;
        case 'g':
          e.preventDefault();
          this.ctrlXPressed = false;
          this.message('Quit');
          break;
        case '_':
          e.preventDefault();
          this.undo();
          break;
        case 'l':
          e.preventDefault();
          this.recenter();
          break;
      }
    } else if (isCtrl || e.altKey) {
    } else if (
      document.activeElement !== this.textarea &&
      this.editorArea &&
      !this.editorArea.classList.contains('emacs-hidden')
    ) {
      // If the window is focused but not the textarea, and we are in editor mode, redirect focus
      this.textarea?.focus();
    }

    this.updateModeLine();
  }

  private onInput(): void {
    if (!this.isModified) {
      this.isModified = true;
      this.updateModeLine();
    }
  }

  private moveCursor(dir: 'home' | 'end' | 'up' | 'down' | 'left' | 'right'): void {
    if (!this.textarea) return;
    const ta = this.textarea;
    let pos = ta.selectionStart;
    const text = ta.value;

    switch (dir) {
      case 'home':
        const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
        ta.setSelectionRange(lineStart, lineStart);
        break;
      case 'end':
        const nextNL = text.indexOf('\n', pos);
        const lineEnd = nextNL === -1 ? text.length : nextNL;
        ta.setSelectionRange(lineEnd, lineEnd);
        break;
      case 'up':
      case 'down':
        const event = new KeyboardEvent('keydown', {
          key: dir === 'up' ? 'ArrowUp' : 'ArrowDown',
          bubbles: true,
        });
        ta.dispatchEvent(event);
        break;
      case 'left':
        ta.setSelectionRange(Math.max(0, pos - 1), Math.max(0, pos - 1));
        break;
      case 'right':
        ta.setSelectionRange(Math.min(text.length, pos + 1), Math.min(text.length, pos + 1));
        break;
    }
    this.updateModeLine();
  }

  private deleteChar(): void {
    if (!this.textarea) return;
    const ta = this.textarea;
    const s = ta.selectionStart,
      e = ta.selectionEnd;
    if (s === e) {
      ta.value = ta.value.substring(0, s) + ta.value.substring(s + 1);
      ta.setSelectionRange(s, s);
    } else {
      ta.value = ta.value.substring(0, s) + ta.value.substring(e);
      ta.setSelectionRange(s, s);
    }
    this.onInput();
  }

  private recenter(): void {
    this.message('Recentering locally...');
    if (this.textarea) {
      this.textarea.blur();
      this.textarea.focus();
    }
  }

  private async executeCommand(): Promise<void> {
    const cmd = await this.promptMinibuffer('M-x ', '');
    if (!cmd) {
      this.message('Quit');
      return;
    }

    switch (cmd.toLowerCase()) {
      case 'help':
        this.showHelp();
        break;
      case 'save-buffer':
        this.save();
        break;
      case 'find-file':
        this.openFile();
        break;
      case 'kill-emacs':
        this.close();
        break;
      case 'eval-buffer':
        this.message('Lisp evaluation not implemented in this workstation.');
        break;
      default:
        this.message(`[M-x] [No match]: ${cmd}`);
        break;
    }
  }

  private killLine(): void {
    const ta = this.textarea!;
    const s = ta.selectionStart,
      text = ta.value;
    const next = text.indexOf('\n', s);
    const end = s === next ? s + 1 : next === -1 ? text.length : next;
    ta.value = text.substring(0, s) + text.substring(end);
    ta.setSelectionRange(s, s);
    this.onInput();
  }

  // ── Mode Line & Minibuffer ────────────────────────────────────────────────

  private updateModeLine(): void {
    if (!this.textarea) return;
    const statusEl = document.getElementById('emacs-file-status');
    if (statusEl) statusEl.textContent = this.isModified ? '**' : '%%';

    const text = this.textarea.value;
    const pos = this.textarea.selectionStart;
    const textBefore = text.substring(0, pos);
    const lines = textBefore.split('\n');
    const lineNum = lines.length;
    const colNum = lines[lines.length - 1].length;

    const lineEl = document.getElementById('emacs-line');
    const colEl = document.getElementById('emacs-col');
    if (lineEl) lineEl.textContent = String(lineNum);
    if (colEl) colEl.textContent = String(colNum);
  }

  private message(msg: string): void {
    if (!this.minibufferMsg) return;
    this.minibufferMsg.textContent = msg;
    if (msg && !msg.endsWith('-')) {
      setTimeout(() => {
        if (this.minibufferMsg?.textContent === msg) this.minibufferMsg.textContent = '';
      }, 5000);
    }
  }
}

// ── Singleton & Global Exposure ───────────────────────────────────────────────

let editorInstance: EmacsManager | null = null;
function getInstance(): EmacsManager {
  if (!editorInstance) editorInstance = new EmacsManager();
  return editorInstance;
}

export async function openEmacs(filename: string, content: string, path = ''): Promise<void> {
  await getInstance().open(filename, content, path);
}

export function closeEmacs(): void {
  getInstance().close();
}

if (typeof window !== 'undefined') {
  (window as any).openEmacs = openEmacs;
  (window as any).closeEmacs = closeEmacs;
  (window as any).Emacs = {
    // Splash / lifecycle
    open: (f?: string, c?: string) => getInstance().open(f || 'untitled.txt', c || ''),
    openSplash: () => getInstance().openSplash(),
    openFile: () => getInstance().openFile(),
    close: () => getInstance().close(),
    // File menu
    save: () => getInstance().save(),
    saveAs: () => getInstance().saveAs(),
    newFile: () => getInstance().newFile(),
    // Edit menu
    undo: () => getInstance().undo(),
    cut: () => getInstance().cut(),
    copy: () => getInstance().copy(),
    paste: () => getInstance().paste(),
    selectAll: () => getInstance().selectAll(),
    // Options
    wrapToggle: () => getInstance().wrapToggle(),
    setFont: (s: string) => getInstance().setFont(s),
    clearBuffer: () => getInstance().clearBuffer(),
    showHelp: () => getInstance().showHelp(),
    // Find
    findDialog: () => getInstance().findDialog(),
    closeFindBar: () => getInstance().closeFindBar(),
    findNext: () => getInstance().findNext(),
    findPrev: () => getInstance().findPrev(),
  };
}
