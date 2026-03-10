/**
 * Vim Types and Interfaces
 */

export type VimMode = 'normal' | 'insert' | 'visual' | 'visual-line' | 'command';

export interface VimState {
  mode: VimMode;
  currentFilePath: string;
  isModified: boolean;
  visualStartPos: number;
  isModifiable: boolean;
  clipboard: string;
  lastCommand: string;
  searchTerm: string;
  searchDirection: 'forward' | 'backward';
  showLineNumbers: boolean;
}

export interface VimElements {
  win: HTMLElement | null;
  textarea: HTMLTextAreaElement | null;
  modeDisplay: HTMLElement | null;
  positionDisplay: HTMLElement | null;
  fileInfoDisplay: HTMLElement | null;
  commandLine: HTMLElement | null;
  commandInput: HTMLInputElement | null;
}