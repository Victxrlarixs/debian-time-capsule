export interface NSPage {
  title: string;
  url: string;
  content: () => string;
}

export interface NSElements {
  win: HTMLElement | null;
  content: HTMLElement | null;
  externalView: HTMLIFrameElement | null;
  urlInput: HTMLInputElement | null;
  title: HTMLElement | null;
  statusText: HTMLElement | null;
  progressBar: HTMLElement | null;
  logo: HTMLElement | null;
  starsContainer: HTMLElement | null;
  stopBtn: HTMLButtonElement | null;
  backBtn: HTMLButtonElement | null;
  forwardBtn: HTMLButtonElement | null;
  scrollThumb: HTMLElement | null;
  toolbar: HTMLElement | null;
  locationBar: HTMLElement | null;
  dirBar: HTMLElement | null;
}

export interface NSState {
  currentPage: string;
  isLoading: boolean;
  historyPos: number;
}
