export interface LabStep {
  user: string;
  command: string;
  output: string;
}

export interface LabLesson {
  title: string;
  steps: LabStep[];
}

export interface LabTutorialData {
  lessons: LabLesson[];
}

export interface LabElements {
  body: HTMLElement;
  input: HTMLInputElement;
  prompt: HTMLElement;
  hintText: HTMLElement;
  lessonLabel: HTMLElement;
  progressFill: HTMLElement;
}

export interface LabState {
  lessonIndex: number;
  stepIndex: number;
  freeMode: boolean;
  history: string[];
  historyPos: number;
  cwd: string;
  user: string;
}
