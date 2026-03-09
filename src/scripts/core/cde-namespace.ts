// src/scripts/core/cde-namespace.ts

import { container } from './container';
import { VFS } from './vfs';
import { AudioManager } from './audiomanager';
import { settingsManager } from './settingsmanager';
import { CDEModal } from '../ui/modals';
import type {
  IFileReader,
  IFileWriter,
  IFileOperations,
  ITrashManager,
  IFileSearch,
  IPathResolver,
} from './interfaces/filesystem.interface';
import type {
  IBasicAudio,
  ISystemSounds,
  IWindowSounds,
  IMenuSounds,
  IMusicPlayer,
  IAudioControl,
} from './interfaces/audio-manager.interface';
import type { ISettingsManager } from './interfaces/settings-manager.interface';

/**
 * CDE Namespace Interface
 * Consolidates all global APIs into a single namespace
 */
export interface CDENamespace {
  core: {
    fs: IFileReader & IFileWriter & IFileOperations & ITrashManager & IFileSearch & IPathResolver;
    audio: IBasicAudio & ISystemSounds & IWindowSounds & IMenuSounds & IMusicPlayer & IAudioControl;
    settings: ISettingsManager;
  };
  ui: {
    modal: typeof CDEModal;
  };
  apps: {
    fileManager?: () => void;
    emacs?: (name?: string, content?: string) => Promise<void>;
    lynx?: () => void;
    manViewer?: () => void;
    netscape?: () => void;
    styleManager?: () => void;
    processMonitor?: () => void;
    calendar?: () => void;
    timeManager?: () => void;
  };
  // Legacy compatibility (deprecated, use core.* instead)
  VirtualFS: typeof VFS;
  AudioManager: typeof AudioManager;
}

/**
 * Initialize the CDE global namespace
 * Consolidates all global APIs into window.CDE
 */
export function initializeCDENamespace(): void {
  const cde: CDENamespace = {
    core: {
      fs: container.get('fs'),
      audio: container.get('audio'),
      settings: container.get('settings'),
    },
    ui: {
      modal: CDEModal,
    },
    apps: {},
    // Legacy compatibility
    VirtualFS: VFS,
    AudioManager: AudioManager,
  };

  // Expose to window
  if (typeof window !== 'undefined') {
    (window as any).CDE = cde;

    // Maintain legacy global exposure for backward compatibility
    // TODO: Remove these in future versions
    (window as any).VirtualFS = VFS;
    (window as any).AudioManager = AudioManager;
    (window as any).CDEModal = CDEModal;
  }
}

/**
 * Register an app launcher in the CDE namespace
 * @param name - App name
 * @param launcher - App launcher function
 */
export function registerApp(name: keyof CDENamespace['apps'], launcher: any): void {
  if (typeof window !== 'undefined' && (window as any).CDE) {
    (window as any).CDE.apps[name] = launcher;
  }
}

// TypeScript global augmentation
declare global {
  interface Window {
    CDE: CDENamespace;
  }
}
