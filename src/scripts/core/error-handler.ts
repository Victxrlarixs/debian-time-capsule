import { logger } from '../utilities/logger';
import { SystemEvent } from './system-events';
import type { EventBus } from './event-bus';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  module: string;
  action?: string;
  data?: any;
  severity?: ErrorSeverity;
  userMessage?: string;
}

export interface AppError {
  id: string;
  timestamp: number;
  error: Error;
  context: ErrorContext;
  stack?: string;
}

/**
 * Centralized error handler for the application.
 * Captures, logs, and reports errors consistently.
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private eventBus: EventBus | null = null;
  private errors: AppError[] = [];
  private maxErrors = 100;

  private constructor() {
    this.setupGlobalHandlers();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  private setupGlobalHandlers(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        module: 'Global',
        action: 'uncaught',
        severity: ErrorSeverity.HIGH,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          module: 'Global',
          action: 'unhandled-promise',
          severity: ErrorSeverity.HIGH,
        }
      );
    });
  }

  /**
   * Handle an error with context.
   */
  handleError(error: Error, context: ErrorContext): void {
    const appError: AppError = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      error,
      context,
      stack: error.stack,
    };

    this.errors.push(appError);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    this.logError(appError);

    if (this.eventBus) {
      this.eventBus.emitSync('error:occurred', appError);
    }

    if (this.shouldShowToUser(context.severity)) {
      this.showErrorToUser(appError);
    }
  }

  /**
   * Wrap an async function with error handling.
   */
  async wrapAsync<T>(
    fn: () => Promise<T>,
    context: ErrorContext
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), context);
      return null;
    }
  }

  /**
   * Wrap a sync function with error handling.
   */
  wrapSync<T>(fn: () => T, context: ErrorContext): T | null {
    try {
      return fn();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), context);
      return null;
    }
  }

  private logError(appError: AppError): void {
    const { error, context } = appError;
    const severity = context.severity || ErrorSeverity.MEDIUM;

    const logMessage = `[${context.module}${context.action ? `:${context.action}` : ''}] ${error.message}`;

    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        logger.error(logMessage, {
          error,
          context,
          stack: appError.stack,
        });
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(logMessage, { error, context });
        break;
      case ErrorSeverity.LOW:
        logger.info(logMessage, { error, context });
        break;
    }
  }

  private shouldShowToUser(severity?: ErrorSeverity): boolean {
    return severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL;
  }

  private showErrorToUser(appError: AppError): void {
    const { error, context } = appError;
    const message = context.userMessage || error.message || 'An unexpected error occurred';

    if (typeof window !== 'undefined' && (window as any).CDEModal) {
      (window as any).CDEModal.alert(
        `Error: ${message}`,
        context.severity === ErrorSeverity.CRITICAL ? 'Critical Error' : 'Error'
      );
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recent errors for debugging.
   */
  getRecentErrors(count = 10): AppError[] {
    return this.errors.slice(-count);
  }

  /**
   * Clear error history.
   */
  clearErrors(): void {
    this.errors = [];
  }
}

export const errorHandler = ErrorHandler.getInstance();
