// src/scripts/core/index.ts

import './config';
import './accessibility';
import '../boot/init';
// Features are now loaded dynamically via module-loader.ts
// Static imports removed to enable proper code splitting
import { initPWAInstaller } from '../utilities/pwa-installer';
import '../utilities/share-config';
import '../utilities/share-theme-ui';
import '../features/panel';

// Export event system for features
export { EventBus, eventBus } from './event-bus';
export { SystemEvent } from './system-events';
export { ErrorHandler, errorHandler, ErrorSeverity } from './error-handler';
export type { ErrorContext, AppError } from './error-handler';
export type {
  FileEventData,
  FolderEventData,
  WindowEventData,
  WorkspaceEventData,
  ThemeEventData,
  BackdropEventData,
  SettingsEventData,
  AppEventData,
  ProcessEventData,
} from './system-events';

// Start backdrop preload IMMEDIATELY (before boot sequence)
if (typeof window !== 'undefined') {
  import('../boot/backdrop-preloader').then(module => {
    module.startBackdropPreload();
  });
}

// Initialize PWA installer
if (typeof window !== 'undefined') {
  initPWAInstaller();
}
