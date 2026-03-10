import type { VimMode } from './vim-types.js';

/**
 * Command Handler for keyboard commands
 */
export class VimCommandHandler {
  private commandMap: Map<string, () => void> = new Map();
  private doubleCommandMap: Map<string, () => void> = new Map();
  private lastCommand: string = '';
  private commandTimeout: number | null = null;

  constructor(
    private onModeChange: (mode: VimMode) => void,
    private onMoveCursor: (direction: string) => void,
    private onEdit: (action: string) => void,
    private onSearch: () => void
  ) {
    this.setupCommands();
  }

  private setupCommands(): void {
    this.commandMap.set('h', () => this.onMoveCursor('left'));
    this.commandMap.set('j', () => this.onMoveCursor('down'));
    this.commandMap.set('k', () => this.onMoveCursor('up'));
    this.commandMap.set('l', () => this.onMoveCursor('right'));
    this.commandMap.set('w', () => this.onMoveCursor('nextWord'));
    this.commandMap.set('b', () => this.onMoveCursor('prevWord'));
    this.commandMap.set('e', () => this.onMoveCursor('endWord'));
    this.commandMap.set('0', () => this.onMoveCursor('home'));
    this.commandMap.set('$', () => this.onMoveCursor('end'));
    this.commandMap.set('gg', () => this.onMoveCursor('fileStart'));
    this.commandMap.set('G', () => this.onMoveCursor('fileEnd'));

    this.commandMap.set('i', () => this.onModeChange('insert'));
    this.commandMap.set('I', () => { this.onMoveCursor('home'); this.onModeChange('insert'); });
    this.commandMap.set('a', () => { this.onMoveCursor('right'); this.onModeChange('insert'); });
    this.commandMap.set('A', () => { this.onMoveCursor('end'); this.onModeChange('insert'); });
    this.commandMap.set('o', () => { this.onEdit('newLineBelow'); this.onModeChange('insert'); });
    this.commandMap.set('O', () => { this.onEdit('newLineAbove'); this.onModeChange('insert'); });
    this.commandMap.set('v', () => this.onModeChange('visual'));
    this.commandMap.set('V', () => this.onModeChange('visual-line'));
    this.commandMap.set(':', () => this.onModeChange('command'));

    this.commandMap.set('x', () => this.onEdit('deleteChar'));
    this.commandMap.set('D', () => this.onEdit('deleteToEnd'));
    this.commandMap.set('p', () => this.onEdit('paste'));
    this.commandMap.set('P', () => this.onEdit('pasteBefore'));
    this.commandMap.set('r', () => this.onEdit('replaceChar'));
    this.commandMap.set('u', () => this.onEdit('undo'));
    this.commandMap.set('.', () => this.onEdit('repeat'));

    this.commandMap.set('/', () => this.onSearch());
    this.commandMap.set('n', () => this.onEdit('searchNext'));
    this.commandMap.set('N', () => this.onEdit('searchPrev'));

    this.doubleCommandMap.set('dd', () => this.onEdit('deleteLine'));
    this.doubleCommandMap.set('yy', () => this.onEdit('yankLine'));
    this.doubleCommandMap.set('cw', () => this.onEdit('changeWord'));
  }

  handleCommand(key: string, shiftKey: boolean = false): boolean {
    const command = shiftKey && key.length === 1 ? key.toUpperCase() : key.toLowerCase();
    
    if (command === 'g' && this.lastCommand === 'g') {
      this.executeDoubleCommand('gg');
      return true;
    }

    if (this.lastCommand && this.doubleCommandMap.has(this.lastCommand + command)) {
      this.executeDoubleCommand(this.lastCommand + command);
      return true;
    }

    // Single commands
    if (this.commandMap.has(command)) {
      this.commandMap.get(command)!();
      this.setLastCommand(command);
      return true;
    }

    // Set up for potential double command
    if (['d', 'y', 'c'].includes(command)) {
      this.setLastCommand(command);
      return true;
    }

    return false;
  }

  private executeDoubleCommand(command: string): void {
    this.doubleCommandMap.get(command)?.();
    this.setLastCommand(command);
  }

  private setLastCommand(command: string): void {
    this.lastCommand = command;
    
    if (this.commandTimeout) {
      clearTimeout(this.commandTimeout);
    }
    
    this.commandTimeout = window.setTimeout(() => {
      this.lastCommand = '';
    }, 1000);
  }

  getLastCommand(): string {
    return this.lastCommand;
  }
}