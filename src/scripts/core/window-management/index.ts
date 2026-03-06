/**
 * Window Management Module
 * Exports all specialized window management classes
 * 
 * This module follows the Single Responsibility Principle by splitting
 * the original 900+ line WindowManager into focused, cohesive classes.
 */

export { ZIndexManager } from './z-index-manager';
export { WorkspaceManager } from './workspace-manager';
export { WindowPositionManager } from './window-position-manager';
export { DragManager } from './drag-manager';
export { WindowStateManager } from './window-state-manager';
export { DropdownManager } from './dropdown-manager';
export { WindowFocusManager } from './window-focus-manager';
