/**
 * Cursor Manager - Single Responsibility: Handle cursor movement and positioning
 */
export class VimCursorManager {
  constructor(private textarea: HTMLTextAreaElement) {}

  moveCursor(direction: string): void {
    let pos = this.textarea.selectionStart;
    const text = this.textarea.value;

    switch (direction) {
      case 'left':
        pos = Math.max(0, pos - 1);
        break;
      case 'right':
        pos = Math.min(text.length, pos + 1);
        break;
      case 'up':
      case 'down':
        pos = this.moveVertical(direction, pos, text);
        break;
      case 'home':
        pos = this.getLineStart(pos, text);
        break;
      case 'end':
        pos = this.getLineEnd(pos, text);
        break;
      case 'fileStart':
        pos = 0;
        break;
      case 'fileEnd':
        pos = text.length;
        break;
      case 'nextWord':
        pos = this.findNextWord(pos, text);
        break;
      case 'prevWord':
        pos = this.findPrevWord(pos, text);
        break;
      case 'endWord':
        pos = this.findEndWord(pos, text);
        break;
    }

    this.textarea.setSelectionRange(pos, pos);
  }

  private moveVertical(direction: 'up' | 'down', pos: number, text: string): number {
    const lines = text.split('\n');
    const textBefore = text.substring(0, pos);
    const linesBefore = textBefore.split('\n');
    const currentLine = linesBefore.length - 1;
    const currentCol = linesBefore[linesBefore.length - 1].length;

    if (direction === 'up' && currentLine > 0) {
      const prevLineLength = lines[currentLine - 1].length;
      const targetCol = Math.min(currentCol, prevLineLength);
      let newPos = 0;
      for (let i = 0; i < currentLine - 1; i++) {
        newPos += lines[i].length + 1;
      }
      return newPos + targetCol;
    } else if (direction === 'down' && currentLine < lines.length - 1) {
      const nextLineLength = lines[currentLine + 1].length;
      const targetCol = Math.min(currentCol, nextLineLength);
      let newPos = 0;
      for (let i = 0; i <= currentLine; i++) {
        newPos += lines[i].length + 1;
      }
      return newPos + targetCol;
    }
    
    return pos;
  }

  private getLineStart(pos: number, text: string): number {
    return text.lastIndexOf('\n', pos - 1) + 1;
  }

  private getLineEnd(pos: number, text: string): number {
    const nextNL = text.indexOf('\n', pos);
    return nextNL === -1 ? text.length : nextNL;
  }

  private findNextWord(pos: number, text: string): number {
    const wordRegex = /\w+/g;
    wordRegex.lastIndex = pos;
    const match = wordRegex.exec(text);
    return match ? match.index : text.length;
  }

  private findPrevWord(pos: number, text: string): number {
    const textBefore = text.substring(0, pos);
    const words = [...textBefore.matchAll(/\w+/g)];
    if (words.length > 0) {
      const lastWord = words[words.length - 1];
      if (lastWord.index !== undefined && lastWord.index < pos - 1) {
        return lastWord.index;
      } else if (words.length > 1) {
        const prevWord = words[words.length - 2];
        return prevWord.index || 0;
      }
    }
    return 0;
  }

  private findEndWord(pos: number, text: string): number {
    const wordRegex = /\w+/g;
    wordRegex.lastIndex = pos;
    const match = wordRegex.exec(text);
    return match ? match.index + match[0].length - 1 : text.length;
  }

  getPosition(): { line: number; column: number } {
    const text = this.textarea.value;
    const pos = this.textarea.selectionStart;
    const textBefore = text.substring(0, pos);
    const lines = textBefore.split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }

  extendSelection(direction: string, startPos: number): void {
    const currentEnd = this.textarea.selectionEnd;
    this.moveCursor(direction);
    const newEnd = this.textarea.selectionStart;
    this.textarea.setSelectionRange(Math.min(startPos, newEnd), Math.max(startPos, newEnd));
  }
}