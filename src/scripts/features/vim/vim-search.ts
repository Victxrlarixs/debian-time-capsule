/**
 * Search Manager - Single Responsibility: Handle search operations
 */
export class VimSearchManager {
  private searchTerm: string = '';
  private searchDirection: 'forward' | 'backward' = 'forward';

  constructor(
    private textarea: HTMLTextAreaElement,
    private commandInput: HTMLInputElement,
    private commandLine: HTMLElement,
    private onMessage: (msg: string, isError?: boolean) => void,
    private onModeChange: (mode: string) => void
  ) {}

  startSearch(): void {
    this.commandLine.style.display = 'flex';
    this.commandInput.value = '';
    this.commandInput.placeholder = 'Search: ';
    
    const handleSearch = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.searchTerm = this.commandInput.value;
        this.searchDirection = 'forward';
        this.performSearch();
        this.commandInput.removeEventListener('keydown', handleSearch);
        this.commandLine.style.display = 'none';
        this.onModeChange('normal');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.commandInput.removeEventListener('keydown', handleSearch);
        this.commandLine.style.display = 'none';
        this.onModeChange('normal');
      }
    };
    
    this.commandInput.addEventListener('keydown', handleSearch);
    this.commandInput.focus();
  }

  searchNext(): void {
    if (!this.searchTerm) {
      this.onMessage('No previous search pattern', true);
      return;
    }
    this.searchDirection = 'forward';
    this.performSearch();
  }

  searchPrev(): void {
    if (!this.searchTerm) {
      this.onMessage('No previous search pattern', true);
      return;
    }
    this.searchDirection = 'backward';
    this.performSearch();
  }

  private performSearch(): void {
    if (!this.searchTerm) return;
    
    const text = this.textarea.value;
    const currentPos = this.textarea.selectionStart;
    let searchPos = this.searchDirection === 'forward' ? currentPos + 1 : currentPos - 1;
    
    const index = this.searchDirection === 'forward' 
      ? text.indexOf(this.searchTerm, searchPos)
      : text.lastIndexOf(this.searchTerm, searchPos);
    
    if (index !== -1) {
      this.textarea.setSelectionRange(index, index + this.searchTerm.length);
      this.onMessage(`/${this.searchTerm}`);
    } else {
      this.onMessage(`Pattern not found: ${this.searchTerm}`, true);
    }
  }

  getSearchTerm(): string {
    return this.searchTerm;
  }
}