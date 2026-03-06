// src/scripts/core/container.ts

import { logger } from '../utilities/logger';

/**
 * Simple Dependency Injection Container
 * Manages service registration and resolution
 */
export class ServiceContainer {
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();
  private singletons = new Set<string>();

  /**
   * Register a service factory
   * @param key - Service identifier
   * @param factory - Factory function that creates the service
   * @param singleton - Whether to cache the instance (default: true)
   */
  register<T>(key: string, factory: () => T, singleton: boolean = true): void {
    this.factories.set(key, factory);
    if (singleton) {
      this.singletons.add(key);
    }
    logger.log(`[Container] Registered service: ${key} (singleton: ${singleton})`);
  }

  /**
   * Register an existing instance
   * @param key - Service identifier
   * @param instance - Service instance
   */
  registerInstance<T>(key: string, instance: T): void {
    this.services.set(key, instance);
    this.singletons.add(key);
    logger.log(`[Container] Registered instance: ${key}`);
  }

  /**
   * Get a service instance
   * @param key - Service identifier
   * @returns Service instance
   * @throws Error if service not found
   */
  get<T>(key: string): T {
    // Return cached instance if singleton
    if (this.singletons.has(key) && this.services.has(key)) {
      return this.services.get(key);
    }

    // Create new instance from factory
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`[Container] Service not found: ${key}`);
    }

    const instance = factory();

    // Cache if singleton
    if (this.singletons.has(key)) {
      this.services.set(key, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   * @param key - Service identifier
   * @returns True if registered
   */
  has(key: string): boolean {
    return this.factories.has(key) || this.services.has(key);
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
    logger.log('[Container] All services cleared');
  }
}

/**
 * Global service container instance
 */
export const container = new ServiceContainer();
