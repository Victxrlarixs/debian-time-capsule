/**
 * System-wide event definitions for event-driven architecture.
 */
export enum SystemEvent {
  FILE_SELECTED = 'file:selected',
  FILE_OPENED = 'file:opened',
  FILE_CREATED = 'file:created',
  FILE_SAVED = 'file:saved',
  FILE_DELETED = 'file:deleted',
  FILE_RENAMED = 'file:renamed',
  FILE_MOVED = 'file:moved',
  FILE_COPIED = 'file:copied',

  FOLDER_CREATED = 'folder:created',
  FOLDER_OPENED = 'folder:opened',
  FOLDER_DELETED = 'folder:deleted',

  WINDOW_OPENED = 'window:opened',
  WINDOW_CLOSED = 'window:closed',
  WINDOW_FOCUSED = 'window:focused',
  WINDOW_MINIMIZED = 'window:minimized',
  WINDOW_MAXIMIZED = 'window:maximized',
  WINDOW_RESTORED = 'window:restored',

  WORKSPACE_CHANGED = 'workspace:changed',
  WORKSPACE_SWITCHED = 'workspace:switched',

  THEME_CHANGED = 'theme:changed',
  BACKDROP_CHANGED = 'backdrop:changed',
  FONT_CHANGED = 'font:changed',

  SETTINGS_LOADED = 'settings:loaded',
  SETTINGS_SAVED = 'settings:saved',
  SETTINGS_CHANGED = 'settings:changed',

  APP_LAUNCHED = 'app:launched',
  APP_CLOSED = 'app:closed',

  PROCESS_STARTED = 'process:started',
  PROCESS_ENDED = 'process:ended',

  ERROR_OCCURRED = 'error:occurred',
}

export interface FileEventData {
  path: string;
  name?: string;
  content?: string;
}

export interface FolderEventData {
  path: string;
  name?: string;
}

export interface WindowEventData {
  id: string;
  title?: string;
}

export interface WorkspaceEventData {
  from?: string;
  to: string;
}

export interface ThemeEventData {
  palette: string;
}

export interface BackdropEventData {
  name: string;
}

export interface SettingsEventData {
  key: string;
  value: any;
}

export interface AppEventData {
  name: string;
  windowId?: string;
}

export interface ProcessEventData {
  pid: number;
  name: string;
  status?: string;
}

export interface ErrorEventData {
  id: string;
  timestamp: number;
  error: Error;
  context: {
    module: string;
    action?: string;
    data?: any;
    severity?: string;
    userMessage?: string;
  };
  stack?: string;
}
