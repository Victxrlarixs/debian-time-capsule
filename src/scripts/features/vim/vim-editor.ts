/**
 * Editor Operations - Single Responsibility: Handle text editing operations
 */
export class VimEditor {
  private clipboard: string = '';

  constructor(private textarea: HTMLTextAreaElement, private onModified: () => void) {}

  deleteChar(): void {
    const pos = this.textarea.selectionStart;
    if (pos < this.textarea.value.length) {
      this.textarea.value = this.textarea.value.substring(0, pos) + this.textarea.value.substring(pos + 1);
      this.textarea.setSelectionRange(pos, pos);
      this.onModified();
    }
  }

  deleteLine(): void {
    const pos = this.textarea.selectionStart;
    const text = this.textarea.value;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const lineEnd = text.indexOf('\n', pos);
    const end = lineEnd === -1 ? text.length : lineEnd + 1;

    const deletedLine = text.substring(lineStart, end);
    this.clipboard = deletedLine;

    this.textarea.value = text.substring(0, lineStart) + text.substring(end);
    this.textarea.setSelectionRange(lineStart, lineStart);
    this.onModified();
  }

  deleteToEnd(): void {
    const pos = this.textarea.selectionStart;
    const text = this.textarea.value;
    const lineEnd = text.indexOf('\n', pos);
    const end = lineEnd === -1 ? text.length : lineEnd;

    const deletedText = text.substring(pos, end);
    this.clipboard = deletedText;

    this.textarea.value = text.substring(0, pos) + text.substring(end);
    this.textarea.setSelectionRange(pos, pos);
    this.onModified();
  }

  deleteSelection(): void {
    const start = this.textarea.selectionStart;
    const end = this.textarea.selectionEnd;
    const selected = this.textarea.value.substring(start, end);
    this.clipboard = selected;
    
    this.textarea.value = this.textarea.value.substring(0, start) + this.textarea.value.substring(end);
    this.textarea.setSelectionRange(start, start);
    this.onModified();
  }

  yankLine(): void {
    const pos = this.textarea.selectionStart;
    const text = this.textarea.value;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const lineEnd = text.indexOf('\n', pos);
    const end = lineEnd === -1 ? text.length : lineEnd + 1;
    
    this.clipboard = text.substring(lineStart, end);
    navigator.clipboard.writeText(this.clipboard).catch(() => {});
  }

  yankSelection(): void {
    const selected = this.textarea.value.substring(
      this.textarea.selectionStart,
      this.textarea.selectionEnd
    );
    this.clipboard = selected;
    navigator.clipboard.writeText(selected).catch(() => {});
  }

  paste(): void {
    const pos = this.textarea.selectionStart;
    
    if (this.clipboard.includes('\n')) {
      // Line paste - insert after current line
      const text = this.textarea.value;
      const lineEnd = text.indexOf('\n', pos);
      const insertPos = lineEnd === -1 ? text.length : lineEnd;
      this.textarea.value = text.substring(0, insertPos) + '\n' + this.clipboard.trimEnd() + text.substring(insertPos);
      this.textarea.setSelectionRange(insertPos + 1, insertPos + 1);
    } else {
      // Character paste - insert at cursor
      this.textarea.value = this.textarea.value.substring(0, pos) + this.clipboard + this.textarea.value.substring(pos);
      this.textarea.setSelectionRange(pos + this.clipboard.length, pos + this.clipboard.length);
    }
    this.onModified();
  }

  pasteBefore(): void {
    const pos = this.textarea.selectionStart;
    
    if (this.clipboard.includes('\n')) {
      // Line paste - insert before current line
      const text = this.textarea.value;
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      this.textarea.value = text.substring(0, lineStart) + this.clipboard.trimEnd() + '\n' + text.substring(lineStart);
      this.textarea.setSelectionRange(lineStart, lineStart);
    } else {
      // Character paste - insert at cursor
      this.textarea.value = this.textarea.value.substring(0, pos) + this.clipboard + this.textarea.value.substring(pos);
      this.textarea.setSelectionRange(pos, pos);
    }
    this.onModified();
  }

  replaceChar(newChar: string): void {
    const pos = this.textarea.selectionStart;
    if (pos < this.textarea.value.length) {
      this.textarea.value = this.textarea.value.substring(0, pos) + newChar + this.textarea.value.substring(pos + 1);
      this.textarea.setSelectionRange(pos, pos);
      this.onModified();
    }
  }

  changeWord(): void {
    const pos = this.textarea.selectionStart;
    const text = this.textarea.value;
    
    // Find word boundaries
    const wordRegex = /\w+/g;
    let match;
    while ((match = wordRegex.exec(text)) !== null) {
      if (match.index <= pos && pos <= match.index + match[0].length) {
        // Delete the word
        this.textarea.value = text.substring(0, match.index) + text.substring(match.index + match[0].length);
        this.textarea.setSelectionRange(match.index, match.index);
        this.onModified();
        return;
      }
    }
  }

  insertNewLine(where: 'above' | 'below'): void {
    const pos = this.textarea.selectionStart;
    const text = this.textarea.value;

    if (where === 'below') {
      const lineEnd = text.indexOf('\n', pos);
      const insertPos = lineEnd === -1 ? text.length : lineEnd;
      this.textarea.value = text.substring(0, insertPos) + '\n' + text.substring(insertPos);
      this.textarea.setSelectionRange(insertPos + 1, insertPos + 1);
    } else {
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      this.textarea.value = text.substring(0, lineStart) + '\n' + text.substring(lineStart);
      this.textarea.setSelectionRange(lineStart, lineStart);
    }
    this.onModified();
  }

  undo(): void {
    document.execCommand('undo');
  }

  getClipboard(): string {
    return this.clipboard;
  }
}