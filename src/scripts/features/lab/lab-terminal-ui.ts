import type { LabElements } from './lab-types';

export class LabTerminalUI {
  constructor(private elements: LabElements) {}

  public print(html: string, className: string = 'lab-line'): void {
    const div = document.createElement('div');
    div.className = className;
    div.innerHTML = html;
    this.elements.body.appendChild(div);
  }

  public clear(): void {
    this.elements.body.innerHTML = '';
  }

  public scrollBottom(): void {
    this.elements.body.scrollTop = this.elements.body.scrollHeight;
  }

  public focus(): void {
    this.elements.input.focus();
  }

  public updateProgress(label: string, percentage: number): void {
    this.elements.lessonLabel.textContent = label;
    this.elements.progressFill.style.width = `${percentage}%`;
  }

  public updatePrompt(user: string): void {
    this.elements.prompt.textContent = user;
  }

  public setHint(html: string): void {
    this.elements.hintText.innerHTML = html;
  }

  public escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  public setInputValue(val: string): void {
    this.elements.input.value = val;
  }

  public getInputValue(): string {
    return this.elements.input.value;
  }
}
