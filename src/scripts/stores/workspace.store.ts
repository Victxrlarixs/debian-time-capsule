// src/scripts/stores/workspace.store.ts
import { atom } from 'nanostores';

/**
 * Reactive store for the active Workspace ID.
 * Defaults to '1' as per Debian CDE standard.
 */
export const $currentWorkspace = atom<string>('1');
