// src/scripts/core/interfaces/application.interface.ts

export type AppCategory =
  | 'Accessories'
  | 'Internet'
  | 'Development'
  | 'System'
  | 'Utilities'
  | 'Preferences'
  | 'Help';

/**
 * Metadata defining an application in the system
 */
export interface AppManifest {
  /** Unique identifier for the application (e.g., 'emacs') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the application */
  description?: string;
  /** Path to the icon image */
  icon: string;
  /** Category for organization in the App Manager */
  category: AppCategory;
  /** Whether the app should be visible in the App Manager */
  hidden?: boolean;
  /** Shortcut key related to this app (future use) */
  shortcut?: string;
  /** Required permissions or flags */
  flags?: string[];
}

/**
 * The functional interface of a registered application
 */
export interface IApplication {
  /** Root element of the application window */
  element?: HTMLElement;
  /** Initialize the application */
  init?(): Promise<void>;
  /** Open the application UI */
  open(args?: any): void | Promise<void>;
  /** Close the application UI */
  close?(): void | Promise<void>;
  /** Focus the application window */
  focus?(): void;
  /** Handle system events */
  onEvent?(event: string, data: any): void;
}

/**
 * Registry entry combining manifest and instance/factory
 */
export interface AppRegistryEntry {
  manifest: AppManifest;
  /** Factory to create or load the application instance */
  factory: () => Promise<IApplication>;
  /** Cached instance if loaded */
  instance?: IApplication;
}
