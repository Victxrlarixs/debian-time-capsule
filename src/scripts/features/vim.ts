import { logger } from '../utilities/logger';
import { WindowManager } from '../core/windowmanager';
import { openWindow, closeWindow, createZIndexManager } from '../shared/window-helpers';
import { container } from '../core/container';
import { SystemEvent } from '../core/system-events';
import type { EventBus } from '../core/event-bus';
import type { FileEventData } from '../core/system-events';
import type { VimMode, VimState, VimElements } from './vim/vim-types.js';
import { VimCommandHandler } from './vim/vim-command-handler.js';
import { VimCursorManager } from './vim/vim-cursor-manager.js';
import { VimEditor } from './vim/vim-editor.js';
import { VimSearchManager } from './vim/vim-search.js';
import { VimModeManager } from './vim/vim-mode-manager.js';
import { VimFileManager } from './vim/vim-file-manager.js';

/**
 * Vi IMproved (Vim) - 90s authentic modal editor
 */

declare global {
  interface Window {
    Vim: {
      open: (filename?: string, content?: string, path?: string) => Promise<void>;
      close: () => void;
    };
  }
}

class VimManager {
  private elements: VimElements = {
    win: null,
    textarea: null,
    modeDisplay: null,
    positionDisplay: null,
    fileInfoDisplay: null,
    commandLine: null,
    commandInput: null
  };

  private state: VimState = {
    mode: 'normal',
    currentFilePath: '',
    isModified: false,
    visualStartPos: 0,
    isModifiable: true,
    clipboard: '',
    lastCommand: '',
    searchTerm: '',
    searchDirection: 'forward',
    showLineNumbers: false
  };

  private eventBus: EventBus | null = null;
  private unsubscribe: (() => void)[] = [];
  private zIndexManager = createZIndexManager(20000);

  private commandHandler!: VimCommandHandler;
  private cursorManager!: VimCursorManager;
  private editor!: VimEditor;
  private searchManager!: VimSearchManager;
  private modeManager!: VimModeManager;
  private fileManager!: VimFileManager;

  constructor() {
    this.init();
    this.subscribeToEvents();
  }

  private subscribeToEvents(): void {
    // Vim should NOT subscribe to FILE_OPENED events
    // Let Emacs handle all file opening from file manager/desktop
    this.eventBus = container.has('eventBus') ? container.get<EventBus>('eventBus') : null;
    if (this.eventBus) {
      logger.log('[Vim] EventBus available but not subscribing to FILE_OPENED (Emacs handles it)');
    }
  }

  private init(): void {
    if (typeof document === 'undefined') return;

    // Initialize DOM elements
    this.elements.win = document.getElementById('vim');
    this.elements.textarea = document.getElementById('vim-textarea') as HTMLTextAreaElement;
    this.elements.modeDisplay = document.getElementById('vim-mode');
    this.elements.positionDisplay = document.getElementById('vim-position');
    this.elements.fileInfoDisplay = document.getElementById('vim-file-info');
    this.elements.commandLine = document.getElementById('vim-command');
    this.elements.commandInput = document.getElementById('vim-command-input') as HTMLInputElement;

    if (!this.elements.win || !this.elements.textarea) return;

    this.initializeManagers();
    this.setupEventListeners();

    this.modeManager.setMode('normal');
    logger.log('[Vim] Initialized');
  }

  private initializeManagers(): void {
    this.commandHandler = new VimCommandHandler(
      (mode) => this.handleModeChange(mode),
      (direction) => this.handleMoveCursor(direction),
      (action) => this.handleEdit(action),
      () => this.handleSearch()
    );

    this.cursorManager = new VimCursorManager(this.elements.textarea!);

    this.editor = new VimEditor(this.elements.textarea!, () => this.onInput());

    this.searchManager = new VimSearchManager(
      this.elements.textarea!,
      this.elements.commandInput!,
      this.elements.commandLine!,
      (msg, isError) => this.showMessage(msg, isError),
      (mode) => this.modeManager.setMode(mode as VimMode)
    );

    this.modeManager = new VimModeManager(this.elements);

    this.fileManager = new VimFileManager(
      this.elements.textarea!,
      (msg, isError) => this.showMessage(msg, isError),
      (path, modified) => this.onFileChange(path, modified),
      (title) => this.updateTitle(title)
    );
  }

  private setupEventListeners(): void {
    this.elements.textarea!.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.elements.textarea!.addEventListener('click', () => this.updatePosition());
    this.elements.textarea!.addEventListener('input', () => this.onInput());

    if (this.elements.commandInput) {
      this.elements.commandInput.addEventListener('keydown', (e) => this.handleCommandKeydown(e));
    }
  }

  private handleModeChange(mode: VimMode): void {
    if (!this.state.isModifiable && ['insert', 'visual', 'visual-line'].includes(mode)) {
      this.showMessage("E21: Cannot make changes, 'modifiable' is off", true);
      return;
    }
    
    // Only clear splash for modes that actually modify content
    if (['insert', 'visual', 'visual-line'].includes(mode)) {
      this.clearSplashIfNeeded();
    }
    
    this.modeManager.setMode(mode);
    this.state.mode = mode;
    this.updatePosition();
  }

  private handleMoveCursor(direction: string): void {
    this.cursorManager.moveCursor(direction);
  }

  private handleEdit(action: string): void {
    if (!this.state.isModifiable && !['searchNext', 'searchPrev', 'repeat'].includes(action)) {
      this.showMessage("E21: Cannot make changes, 'modifiable' is off", true);
      return;
    }

    switch (action) {
      case 'deleteChar':
        this.editor.deleteChar();
        break;
      case 'deleteLine':
        this.editor.deleteLine();
        break;
      case 'deleteToEnd':
        this.editor.deleteToEnd();
        break;
      case 'yankLine':
        this.editor.yankLine();
        this.showMessage('1 line yanked');
        break;
      case 'paste':
        this.editor.paste();
        break;
      case 'pasteBefore':
        this.editor.pasteBefore();
        break;
      case 'replaceChar':
        this.waitForReplaceChar();
        break;
      case 'changeWord':
        this.editor.changeWord();
        this.handleModeChange('insert');
        break;
      case 'newLineBelow':
        this.editor.insertNewLine('below');
        break;
      case 'newLineAbove':
        this.editor.insertNewLine('above');
        break;
      case 'undo':
        this.editor.undo();
        break;
      case 'searchNext':
        this.searchManager.searchNext();
        break;
      case 'searchPrev':
        this.searchManager.searchPrev();
        break;
      case 'repeat':
        this.repeatLastCommand();
        break;
    }
  }

  private handleSearch(): void {
    this.searchManager.startSearch();
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.state.mode === 'command') return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.handleModeChange('normal');
      return;
    }

    if (this.state.mode === 'normal') {
      this.handleNormalMode(e);
    } else if (this.state.mode === 'insert') {
      this.onInput();
    } else if (this.modeManager.isVisualMode()) {
      this.handleVisualMode(e);
    }

    this.updatePosition();
  }

  private handleNormalMode(e: KeyboardEvent): void {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const handled = this.commandHandler.handleCommand(e.key, e.shiftKey);
      if (handled) {
        e.preventDefault();
        this.state.lastCommand = this.commandHandler.getLastCommand();
      }
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const direction = {
        'ArrowLeft': 'left',
        'ArrowRight': 'right', 
        'ArrowUp': 'up',
        'ArrowDown': 'down'
      }[e.key];
      this.cursorManager.moveCursor(direction!);
    }
  }

  private handleVisualMode(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();

    if (['h', 'j', 'k', 'l', 'arrowleft', 'arrowdown', 'arrowup', 'arrowright'].includes(key)) {
      e.preventDefault();
      const direction = { h: 'left', j: 'down', k: 'up', l: 'right', 
                         arrowleft: 'left', arrowdown: 'down', arrowup: 'up', arrowright: 'right' }[key];
      this.cursorManager.extendSelection(direction!, this.modeManager.getVisualStartPos());
    } else if (['d', 'x'].includes(key)) {
      e.preventDefault();
      this.editor.deleteSelection();
      this.handleModeChange('normal');
    } else if (key === 'y') {
      e.preventDefault();
      this.editor.yankSelection();
      this.showMessage(`${this.elements.textarea!.selectionEnd - this.elements.textarea!.selectionStart} characters yanked`);
      this.handleModeChange('normal');
    }
  }

  private handleCommandKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const command = this.elements.commandInput?.value || '';
      this.executeCommand(command);
      if (this.elements.commandInput) this.elements.commandInput.value = '';
      this.handleModeChange('normal');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (this.elements.commandInput) this.elements.commandInput.value = '';
      this.handleModeChange('normal');
    }
  }

  private async executeCommand(cmd: string): Promise<void> {
    cmd = cmd.trim();

    if (cmd === 'w' || cmd === 'write') {
      await this.fileManager.save(this.state.currentFilePath);
    } else if (cmd.startsWith('w ')) {
      const filename = cmd.substring(2).trim();
      const newPath = await this.fileManager.saveAs(filename);
      if (newPath) {
        this.state.currentFilePath = newPath;
        await this.fileManager.save(newPath);
      }
    } else if (cmd === 'wq' || cmd === 'x' || cmd === 'exit') {
      await this.fileManager.save(this.state.currentFilePath);
      this.close();
    } else if (cmd.startsWith('e ') || cmd.startsWith('edit ')) {
      const filename = cmd.substring(cmd.indexOf(' ') + 1).trim();
      if (filename === '.') {
        this.showExplorer('/home/victxrlarixs/Desktop/');
      } else {
        const fileData = await this.fileManager.openFile(filename);
        if (fileData) {
          await this.open(filename, fileData.content, fileData.path);
        }
      }
    } else if (cmd === 'e!' || cmd === 'edit!') {
      this.fileManager.reloadFile(this.state.currentFilePath);
    } else if (cmd === 'E' || cmd === 'Explore' || cmd === 'e.') {
      this.showExplorer('/home/victxrlarixs/Desktop/');
    } else if (cmd.startsWith('E ') || cmd.startsWith('Explore ')) {
      const dir = cmd.substring(cmd.indexOf(' ') + 1).trim();
      this.showExplorer(dir.endsWith('/') ? dir : dir + '/');
    } else if (cmd === 'enew') {
      if (this.state.isModified) {
        this.showMessage('E37: No write since last change (add ! to override)', true);
        return;
      }
      await this.open('', '', '');
    } else if (cmd === 'enew!') {
      await this.open('', '', '');
    } else if (cmd === 'help' || cmd === 'h') {
      this.showHelp();
    } else if (cmd.startsWith('set ')) {
      const option = cmd.substring(4).trim();
      this.handleSetCommand(option);
    } else if (cmd === 'version' || cmd === 'ver') {
      this.showVersion();
    } else if (cmd === 'q' || cmd === 'quit') {
      this.close();
    } else if (cmd === 'q!' || cmd === 'quit!') {
      this.state.isModified = false;
      this.close();
    } else if (cmd === 'qa!' || cmd === 'quitall!') {
      this.state.isModified = false;
      this.close();
    } else {
      this.showMessage(`Not an editor command: ${cmd}`, true);
    }
  }

  private handleSetCommand(option: string): void {
    if (option === 'number' || option === 'nu') {
      this.state.showLineNumbers = true;
      this.showMessage('Line numbers enabled');
    } else if (option === 'nonumber' || option === 'nonu') {
      this.state.showLineNumbers = false;
      this.showMessage('Line numbers disabled');
    } else if (option.startsWith('mouse=')) {
      this.showMessage('Mouse support: always enabled');
    } else {
      this.showMessage(`Unknown option: ${option}`);
    }
  }

  private waitForReplaceChar(): void {
    if (!this.elements.textarea) return;
    
    this.showMessage('-- REPLACE --');
    const handleReplace = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key.length === 1) {
        this.editor.replaceChar(e.key);
      }
      this.elements.textarea!.removeEventListener('keydown', handleReplace);
      this.showMessage('');
    };
    
    this.elements.textarea.addEventListener('keydown', handleReplace);
  }

  private repeatLastCommand(): void {
    if (!this.state.lastCommand) {
      this.showMessage('No previous command', true);
      return;
    }
    
    if (this.state.lastCommand === 'dd') {
      this.editor.deleteLine();
    } else if (this.state.lastCommand === 'yy') {
      this.editor.yankLine();
      this.showMessage('1 line yanked');
    } else if (this.state.lastCommand === 'cw') {
      this.editor.changeWord();
      this.handleModeChange('insert');
    }
  }

  public async open(filename: string = '', content: string = '', path: string = ''): Promise<void> {
    if (!this.elements.win || !this.elements.textarea) return;

    this.state.currentFilePath = path || filename || '';
    this.state.isModified = false;
    this.state.isModifiable = true;

    if (!filename && !content) {
      this.showSplash();
      this.handleModeChange('normal');
    } else {
      this.clearSplashIfNeeded();
      this.elements.textarea.value = content;
      this.updateTitle(filename || '[No Name]');
      this.updateFileInfo();
      this.handleModeChange('normal');
    }

    this.updatePosition();

    openWindow({
      id: 'vim',
      zIndex: this.zIndexManager.increment(),
      center: true,
      playSound: true,
      focus: true,
      onOpen: () => {
        if (this.elements.win) {
          this.elements.win.style.width = 'min(800px, 90vw)';
          this.elements.win.style.height = 'min(600px, 80vh)';
          WindowManager.centerWindow(this.elements.win);
          this.elements.textarea?.focus();
        }
      },
    });
  }

  public close(): void {
    if (!this.elements.win) return;

    if (this.state.isModified) {
      // Authentic Vim behavior: show error message and don't quit
      this.showMessage('E37: No write since last change (add ! to override)', true);
      return;
    }
    
    this.cleanup();
  }

  private cleanup(): void {
    closeWindow('vim');
    this.state.currentFilePath = '';
    this.state.isModified = false;
    this.unsubscribe.forEach((fn) => fn());
    this.unsubscribe = [];
  }

  private clearSplashIfNeeded(): void {
    if (!this.elements.textarea) return;
    if (this.elements.textarea.value.includes('VIM - Vi IMproved')) {
      this.elements.textarea.value = '';
      this.state.isModifiable = true;
    }
  }

  private onInput(): void {
    if (!this.state.isModified) {
      this.state.isModified = true;
      this.updateFileInfo();
    }
  }

  private onFileChange(path: string, modified: boolean): void {
    this.state.currentFilePath = path;
    this.state.isModified = modified;
    this.updateFileInfo();
  }

  private updatePosition(): void {
    if (!this.elements.positionDisplay) return;
    const position = this.cursorManager.getPosition();
    this.elements.positionDisplay.textContent = `${position.line},${position.column}`;
  }

  private updateTitle(filename: string): void {
    const titleEl = document.getElementById('vim-title');
    if (titleEl) titleEl.textContent = `Vi IMproved - ${filename}`;
  }

  private updateFileInfo(): void {
    if (!this.elements.fileInfoDisplay) return;
    const modified = this.state.isModified ? '[+]' : '';
    const filename = this.state.currentFilePath ? this.state.currentFilePath.split('/').pop() : '[No Name]';
    this.elements.fileInfoDisplay.textContent = `${filename} ${modified}`.trim();
  }

  private showMessage(msg: string, isError: boolean = false): void {
    if (this.elements.modeDisplay) {
      const originalText = this.elements.modeDisplay.textContent;
      const originalColor = this.elements.modeDisplay.style.color;
      
      this.elements.modeDisplay.textContent = msg;
      if (isError) {
        this.elements.modeDisplay.style.color = '#ff0000';
      }
      
      setTimeout(() => {
        if (this.elements.modeDisplay) {
          this.elements.modeDisplay.textContent = originalText;
          this.elements.modeDisplay.style.color = originalColor;
        }
      }, 3000);
    }
  }

  private showSplash(): void {
    if (!this.elements.textarea) return;

    const splash = `~
~
~                     VIM - Vi IMproved
~
~                       version 5.3
~                  by Bram Moolenaar et al.
~           Vim is open source and freely distributable
~
~              Help poor children in Uganda!
~          type  :help<Enter>       for information
~
~          type  :q<Enter>               to exit
~          type  :help<Enter>  or  <F1>  for on-line help
~          type  :help version5<Enter>   for version info
~
~
~
~
~
~
~
~
~`;

    this.elements.textarea.value = splash;
    this.state.isModifiable = false;
    this.updateTitle('[No Name]');
    this.updateFileInfo();
  }

  private showHelp(): void {
    if (!this.elements.textarea) return;

    // Clear splash when showing help content
    this.clearSplashIfNeeded();

    const helpText = `*help.txt*      For Vim version 5.3.  Last change: 1998 Dec 21


                        VIM - main help file
                                                                      k
      Move around:  Use the cursor keys, or "h" to go left,       h   l
                    "j" to go down, "k" to go up, "l" to go right.   j
Close this window:  Use ":q<Enter>".
   Get out of Vim:  Use ":qa!<Enter>" (careful, all changes are lost!).

Jump to a subject:  Position the cursor on a tag (e.g. bars) and hit CTRL-].
   With the mouse:  ":set mouse=a" to enable the mouse (in xterm or GUI).
                    Double-click the left mouse button on a tag, e.g. bars.
        Jump back:  Type CTRL-O.  Repeat to go further back.

Get specific help:  It is possible to go directly to whatever you want help
                    on, by giving an argument to the :help command.
                    Prepend something to specify the context:  help-context

                          WHAT                  PREPEND    EXAMPLE
                          Normal mode command            :help x
                          Visual mode command      v_    :help v_u
                          Insert mode command      i_    :help i_<Esc>
                          Command-line command     :     :help :quit
                          Command-line editing     c_    :help c_<Del>
                          Vim command argument     -     :help -r
                          Option                   '     :help 'textwidth'

Search for help:  Type ":help word", then hit CTRL-D to see matching
                  help entries for "word".

VIM stands for Vi IMproved.  Most of VIM was made by Bram Moolenaar, but only
through the help of many others.  See :help credits.
------------------------------------------------------------------------------
Press :q<Enter> to close this help.
~
~
~
~`;

    this.elements.textarea.value = helpText;
    this.state.isModifiable = false;
    this.state.currentFilePath = '';
    this.state.isModified = false;
    this.updateTitle('help.txt [Help] [RO]');
    this.updateFileInfo();
    this.handleModeChange('normal');
  }

  private showVersion(): void {
    if (!this.elements.textarea) return;

    // Clear splash when showing version content
    this.clearSplashIfNeeded();

    const versionText = `VIM - Vi IMproved 5.3 (1998 Oct 31, compiled Dec 10 1998 12:00:00)
Included patches: 1-73
Compiled by team+vim@tracker.debian.org
Normal version without GUI.  Features included (+) or not (-):
+autocmd +digraphs +insert_expand +mouse +syntax +wildmenu
+browse +emacs_tags +jumplist +mouse_dec +tag_binary +writebackup
+builtin_terms +eval +langmap +mouse_xterm +tag_old_static +X11
-clientserver +ex_extra +linebreak +multi_byte +terminfo
+clipboard +extra_search +lispindent +perl +textobjects
+cmdline_compl +farsi +listcmds +postscript +title
+cmdline_hist +file_in_path +localmap +printer +user_commands
+cmdline_info +find_in_path +menu +python +vertsplit
+comments +folding +mksession +quickfix +viminfo
+cryptv +fork() +modify_fname +rightleft +visual
+cscope +gettext +mouse_gpm +scrollbind +visualextra
+dialog +hangul_input +mouseshape +signs +vreplace

   system vimrc file: "$VIM/vimrc"
     user vimrc file: "$HOME/.vimrc"
      user exrc file: "$HOME/.exrc"
  fall-back for $VIM: "/usr/share/vim"

Press ENTER or type command to continue`;

    this.elements.textarea.value = versionText;
    this.state.isModifiable = false;
    this.state.currentFilePath = '';
    this.state.isModified = false;
    this.updateTitle('[Version Info]');
    this.updateFileInfo();
    this.handleModeChange('normal');
  }

  private showExplorer(dirPath: string): void {
    if (!this.elements.textarea) return;

    const listing = this.fileManager.showExplorer(dirPath);
    if (listing) {
      // Clear splash when showing explorer content
      this.clearSplashIfNeeded();
      this.elements.textarea.value = listing;
      this.state.isModifiable = false;
      this.state.currentFilePath = '';
      this.state.isModified = false;
      this.updateTitle(`${dirPath} [Directory]`);
      this.updateFileInfo();
      this.handleModeChange('normal');
    }
  }
}

let vimInstance: VimManager | null = null;
function getInstance(): VimManager {
  if (!vimInstance) vimInstance = new VimManager();
  return vimInstance;
}

if (typeof window !== 'undefined') {
  (window as any).Vim = {
    open: (filename?: string, content?: string, path?: string) => getInstance().open(filename, content, path),
    close: () => getInstance().close(),
  };
  
  logger.log('[Vim] Exposed globally');
}