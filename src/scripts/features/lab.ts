import tutorialData from '../../data/tutorial.json';
import { VFS } from '../core/vfs';
import { WindowManager } from '../core/windowmanager';
import type { LabTutorialData, LabElements, LabState } from './lab/lab-types';
import { LabShellEngine } from './lab/lab-shell-engine';
import { LabTutorialManager } from './lab/lab-tutorial-manager';
import { LabTerminalUI } from './lab/lab-terminal-ui';

/**
 * Terminal Lab Manager - SOLID Implementation
 * Coordinates Shell logic, Tutorial flow, and Terminal UI.
 */
class TerminalLabManager {
  private ui!: LabTerminalUI;
  private shell!: LabShellEngine;
  private tutorial!: LabTutorialManager;
  
  private state: LabState = {
    lessonIndex: 0,
    stepIndex: 0,
    freeMode: false,
    history: [],
    historyPos: -1,
    cwd: '/home/victxrlarixs/',
    user: 'victxrlarixs'
  };

  constructor() {
    this.tutorial = new LabTutorialManager((tutorialData as LabTutorialData).lessons);
    this.shell = new LabShellEngine(
      () => this.state.cwd,
      (path) => { this.state.cwd = path; },
      () => this.state.user
    );
  }

  public open(): void {
    const win = document.getElementById('terminal-lab');
    if (!win) return;
    win.style.display = 'flex';
    win.style.flexDirection = 'column';
    WindowManager.centerWindow(win);

    this.init();
    if ((window as any).AudioManager) (window as any).AudioManager.windowOpen();
    this.ui.focus();
    if ((window as any).focusWindow) (window as any).focusWindow('terminal-lab');
  }

  public close(): void {
    const win = document.getElementById('terminal-lab');
    if (win) {
      win.style.display = 'none';
      if ((window as any).AudioManager) (window as any).AudioManager.windowClose();
    }
  }

  private init(): void {
    const elements: LabElements = {
      body: document.getElementById('lab-terminal-body')!,
      input: document.getElementById('lab-input') as HTMLInputElement,
      prompt: document.getElementById('lab-prompt')!,
      hintText: document.getElementById('lab-hint-text')!,
      lessonLabel: document.getElementById('lab-lesson-label')!,
      progressFill: document.getElementById('lab-progress-fill')!,
    };

    if (!elements.body) return;
    this.ui = new LabTerminalUI(elements);

    if (elements.input.dataset.initialized) return;
    elements.input.dataset.initialized = '1';

    this.ui.clear();
    this.ui.setInputValue('');

    elements.input.addEventListener('keydown', (e) => this.onKeyDown(e));
    elements.body.addEventListener('pointerdown', () => this.ui.focus());

    this.printWelcome();
    this.updateUI();
    this.showCurrentPrompt();
  }

  private printWelcome(): void {
    this.ui.print('<span class="lab-header">+--------------------------------------------+</span>');
    this.ui.print('<span class="lab-header">|  DEBIAN CDE -- TERMINAL LABORATORY         |</span>');
    this.ui.print('<span class="lab-header">+--------------------------------------------+</span>');
    this.ui.print('<span class="lab-dim">Guided lessons: type each command to advance.</span>');
    this.ui.print('<span class="lab-dim">Meta-commands: hint  skip  free  tutorial  clear</span>');
    this.ui.print('');
  }

  private showCurrentPrompt(): void {
    if (this.state.freeMode) return;
    const step = this.tutorial.currentStep();
    if (!step) return;
    this.ui.print(`<span class="lab-dim">next --&gt;</span> <span class="lab-cmd">${this.ui.escHtml(step.command)}</span>`);
    this.updatePromptDisplay();
  }

  private advance(): void {
    const nextLesson = this.tutorial.advance();
    this.updateUI();

    if (this.tutorial.isComplete()) {
      this.printCongratulations();
    } else {
      if (nextLesson) this.printLessonIntro();
      this.showCurrentPrompt();
    }
    this.ui.scrollBottom();
  }

  private printLessonIntro(): void {
    const lesson = this.tutorial.currentLesson();
    const current = this.tutorial.getProgress().currentLesson + 1;
    this.ui.print('');
    this.ui.print('<span class="lab-header">-------------------------------------------</span>');
    this.ui.print(`<span class="lab-header">LESSON ${current}: ${(lesson?.title || '').toUpperCase()}</span>`);
    this.ui.print('<span class="lab-header">-------------------------------------------</span>');
    this.ui.print('');
  }

  private printCongratulations(): void {
    this.ui.print('');
    this.ui.print('<span class="lab-header">+-------------------------------------------+</span>');
    this.ui.print('<span class="lab-header">|  ALL LESSONS COMPLETE                     |</span>');
    this.ui.print('<span class="lab-header">+-------------------------------------------+</span>');
    this.ui.print('<span class="lab-dim">You have completed the Debian CDE Terminal Laboratory.</span>');
    this.ui.print('<span class="lab-dim">Type "free" to switch to free exploration mode.</span>');
  }

  private updateUI(): void {
    const prog = this.tutorial.getProgress();
    const total = prog.totalLessons;
    const current = Math.min(prog.currentLesson + 1, total);
    const title = this.tutorial.currentLesson()?.title || `Lesson ${current}`;
    this.ui.updateProgress(`LESSON ${current} / ${total} — ${title}`, prog.percentage);
  }

  private updatePromptDisplay(): void {
    const step = this.tutorial.currentStep();
    const userPrefix = this.state.freeMode ? this.state.user : (step?.user || this.state.user);
    const char = userPrefix === 'root' ? '#' : '$';
    this.ui.updatePrompt(`${userPrefix}@debian:${this.cwdShort()}${char}`);
  }

  private cwdShort(): string {
    if (this.state.cwd === '/home/victxrlarixs') return '~';
    if (this.state.cwd.startsWith('/home/victxrlarixs/')) {
      return '~/' + this.state.cwd.slice('/home/victxrlarixs/'.length).replace(/\/$/, '');
    }
    return this.state.cwd.replace(/\/$/, '');
  }

  private onKeyDown(e: KeyboardEvent): void {
    const input = this.ui.getInputValue();
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      this.ui.setInputValue('');
      this.ui.print(`<span class="lab-prompt-str">${this.state.user}@debian:~</span> ${this.ui.escHtml(input)}^C`);
      return;
    }
    if (e.ctrlKey && e.key === 'l') { e.preventDefault(); this.ui.clear(); return; }
    if (e.ctrlKey && e.key === 'u') { e.preventDefault(); this.ui.setInputValue(''); return; }
    
    if (e.key === 'Enter') {
      const raw = input.trim();
      this.ui.setInputValue('');
      if (raw) {
        this.state.history.unshift(raw);
        this.state.historyPos = -1;
      }
      this.handleInput(raw);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.state.historyPos = Math.min(this.state.historyPos + 1, this.state.history.length - 1);
      this.ui.setInputValue(this.state.history[this.state.historyPos] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.state.historyPos = Math.max(this.state.historyPos - 1, -1);
      this.ui.setInputValue(this.state.historyPos >= 0 ? this.state.history[this.state.historyPos] : '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.handleTabCompletion();
    }
  }

  private handleTabCompletion(): void {
    const input = this.ui.getInputValue();
    const parts = input.split(' ');
    const lastPart = parts[parts.length - 1];

    if (parts.length === 1) {
      const matches = this.state.freeMode 
        ? this.shell.getAvailableCommands().filter(c => c.startsWith(lastPart))
        : (this.tutorial.currentStep()?.command.startsWith(lastPart) ? [this.tutorial.currentStep()?.command!] : []);

      if (matches.length === 1) {
        this.ui.setInputValue(matches[0] + ' ');
      } else if (matches.length > 1) {
        this.ui.print(`<span class="lab-dim">${matches.join('  ')}</span>`);
      }
    }
  }

  private async handleInput(raw: string): Promise<void> {
    if (!raw) return;

    const step = this.tutorial.currentStep();
    const promptStr = this.state.freeMode ? `${this.state.user}@debian:~$` : (step?.user === 'root' ? 'root@debian:~#' : `${this.state.user}@debian:~$`);
    this.ui.print(`<span class="lab-prompt-str">${promptStr}</span> ${this.ui.escHtml(raw)}`);

    // Meta commands
    if (raw === 'hint') { this.showHint(); return; }
    if (raw === 'skip') { this.advance(); return; }
    if (raw === 'free') { this.toggleFreeMode(true); return; }
    if (raw === 'tutorial') { this.toggleFreeMode(false); return; }
    if (raw === 'clear') { this.ui.clear(); return; }

    if (this.state.freeMode) {
      try {
        const out = await this.shell.execute(raw);
        if (out) out.split('\n').forEach(l => this.ui.print(`<span class="lab-output">${this.ui.escHtml(l)}</span>`));
      } catch (e: any) {
        this.ui.print(`<span class="lab-error">${this.ui.escHtml(e.message)}</span>`);
        if ((window as any).AudioManager) (window as any).AudioManager.error();
      }
    } else {
      this.runTutorialCommand(raw);
    }

    this.ui.scrollBottom();
  }

  private runTutorialCommand(raw: string): void {
    const step = this.tutorial.currentStep();
    if (!step) return;

    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalize(raw) === normalize(step.command)) {
      if (step.output) {
        step.output.split('\\n').forEach(l => this.ui.print(`<span class="lab-output">${this.ui.escHtml(l)}</span>`));
      }
      if ((window as any).AudioManager) (window as any).AudioManager.success();
      this.ui.print('');
      this.advance();
    } else {
      this.ui.print(`<span class="lab-error">error: expected -- ${this.ui.escHtml(step.command)}</span>`);
      this.ui.print('<span class="lab-dim">       type "hint" or "skip" to continue.</span>');
      if ((window as any).AudioManager) (window as any).AudioManager.error();
      this.ui.print('');
      this.showCurrentPrompt();
    }
  }

  public showHint(): void {
    if (this.state.freeMode) return;
    const step = this.tutorial.currentStep();
    if (!step) return;
    this.ui.print(`<span class="lab-hint">HINT: type --&gt; ${this.ui.escHtml(step.command)}</span>`);
    this.ui.scrollBottom();
  }

  public skip(): void {
    if (!this.state.freeMode) this.advance();
  }

  public toggleFreeMode(enable: boolean): void {
    this.state.freeMode = enable;
    const btn = document.getElementById('lab-btn-free');
    if (btn) btn.classList.toggle('lab-btn-active', enable);
    
    if (enable) {
      this.ui.setHint('[FREE MODE] Type any command. Type "tutorial" to return to guided mode or "help".');
    } else {
      this.ui.setHint('Type the command shown below to proceed. Type "hint" or "skip" for help.');
      this.showCurrentPrompt();
    }
    this.updatePromptDisplay();
  }
}

const TerminalLab = new TerminalLabManager();
(window as any).TerminalLab = TerminalLab;
export { TerminalLab };

declare global {
  interface Window {
    TerminalLab: typeof TerminalLab;
  }
}
