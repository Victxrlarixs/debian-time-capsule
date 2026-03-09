// src/scripts/core/container.init.ts

import { container } from './container';
import { VFSAdapter } from './adapters/vfs.adapter';
import { AudioManagerAdapter } from './adapters/audiomanager.adapter';
import { settingsManager } from './settingsmanager';
import { logger } from '../utilities/logger';

// Window management classes
import { ZIndexManager } from './window-management/z-index-manager';
import { WorkspaceManager } from './window-management/workspace-manager';
import { WindowPositionManager } from './window-management/window-position-manager';
import { DropdownManager } from './window-management/dropdown-manager';

/**
 * Initialize the dependency injection container
 * Registers all core services with their adapters
 */
export function initializeContainer(): void {
  logger.log('[Container] Initializing services...');

  // Register filesystem services
  container.registerInstance('fs', new VFSAdapter());
  container.registerInstance('fileReader', new VFSAdapter());
  container.registerInstance('fileWriter', new VFSAdapter());
  container.registerInstance('fileOperations', new VFSAdapter());
  container.registerInstance('trashManager', new VFSAdapter());
  container.registerInstance('fileSearch', new VFSAdapter());
  container.registerInstance('pathResolver', new VFSAdapter());

  // Register audio services
  const audioAdapter = new AudioManagerAdapter();
  container.registerInstance('audio', audioAdapter);
  container.registerInstance('basicAudio', audioAdapter);
  container.registerInstance('systemSounds', audioAdapter);
  container.registerInstance('windowSounds', audioAdapter);
  container.registerInstance('menuSounds', audioAdapter);
  container.registerInstance('musicPlayer', audioAdapter);
  container.registerInstance('audioControl', audioAdapter);

  // Register settings services
  container.registerInstance('settings', settingsManager);
  container.registerInstance('sessionStorage', settingsManager);

  // Register window management services
  container.registerInstance('zIndexManager', new ZIndexManager());
  container.registerInstance('workspaceManager', new WorkspaceManager());
  container.registerInstance('windowPositionManager', new WindowPositionManager());
  container.registerInstance('dropdownManager', new DropdownManager());

  logger.log('[Container] All services registered successfully');
}
