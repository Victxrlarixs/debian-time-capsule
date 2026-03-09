# Error Handling System

Technical documentation for the centralized error handling system in Debian Time Capsule.

## Overview

The Error Handler provides centralized error management across the application. It captures, logs, and reports errors consistently with contextual information and severity-based handling.

## Architecture

```
┌──────────────────────────────────────────────┐
│           Application Code                    │
├──────────────────────────────────────────────┤
│  errorHandler.wrapAsync() / wrapSync()       │
├──────────────────────────────────────────────┤
│           Error Handler                       │
│  • Capture  • Log  • Notify  • Store         │
├──────────────────────────────────────────────┤
│  Logger    EventBus    CDEModal    History   │
└──────────────────────────────────────────────┘
```

## Core Features

### Global Error Capture

Automatically captures uncaught errors and unhandled promise rejections:

```typescript
window.addEventListener('error', (event) => {
  errorHandler.handleError(event.error, {
    module: 'Global',
    action: 'unhandled-error',
    severity: ErrorSeverity.CRITICAL,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  errorHandler.handleError(new Error(event.reason), {
    module: 'Global',
    action: 'unhandled-promise',
    severity: ErrorSeverity.CRITICAL,
  });
});
```

### Severity Levels

```typescript
enum ErrorSeverity {
  LOW = 'low',       // Logged only, no user notification
  MEDIUM = 'medium', // Logged as warning
  HIGH = 'high',     // Logged + user notification
  CRITICAL = 'critical', // Logged + user notification
}
```

### Error Context

```typescript
interface ErrorContext {
  module: string;           // Module name (e.g., 'FileManager')
  action?: string;          // Action being performed (e.g., 'saveFile')
  data?: any;              // Additional context data
  severity?: ErrorSeverity; // Error severity (default: MEDIUM)
  userMessage?: string;     // User-friendly message
}
```

### Error History

Maintains last 100 errors for debugging:

```typescript
interface AppError {
  id: string;              // Unique error ID (UUID)
  timestamp: number;       // Unix timestamp
  error: Error;           // Original error object
  context: ErrorContext;  // Error context
  stack?: string;         // Stack trace
}
```

## Implementation

### Wrapper Functions

```typescript
class ErrorHandler {
  // Async wrapper
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

  // Sync wrapper
  wrapSync<T>(fn: () => T, context: ErrorContext): T | null {
    try {
      return fn();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)), context);
      return null;
    }
  }
}
```

### Error Processing

```typescript
handleError(error: Error, context: ErrorContext): void {
  const appError: AppError = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    error,
    context: { severity: ErrorSeverity.MEDIUM, ...context },
    stack: error.stack,
  };

  // 1. Store in history
  this.errorHistory.push(appError);
  if (this.errorHistory.length > 100) {
    this.errorHistory.shift();
  }

  // 2. Log to console
  this.logError(appError);

  // 3. Emit event
  this.eventBus?.emitSync(SystemEvent.ERROR_OCCURRED, appError);

  // 4. Show user notification (HIGH/CRITICAL only)
  if (context.severity === ErrorSeverity.HIGH || context.severity === ErrorSeverity.CRITICAL) {
    this.showUserNotification(appError);
  }
}
```

## Usage

### Basic Error Handling

```typescript
import { errorHandler, ErrorSeverity } from '../core/error-handler';

// Wrap async function
const result = await errorHandler.wrapAsync(
  async () => {
    const data = await fetchData();
    return processData(data);
  },
  {
    module: 'DataLoader',
    action: 'loadData',
    severity: ErrorSeverity.HIGH,
  }
);

// Wrap sync function
const result = errorHandler.wrapSync(
  () => {
    return complexCalculation();
  },
  {
    module: 'Calculator',
    action: 'calculate',
    severity: ErrorSeverity.MEDIUM,
  }
);
```

### Manual Error Handling

```typescript
try {
  await riskyOperation();
} catch (error) {
  errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
    module: 'MyModule',
    action: 'riskyOperation',
    data: { userId: 123 },
    severity: ErrorSeverity.HIGH,
    userMessage: 'Operation failed. Please try again.',
  });
}
```

### Event Subscription

```typescript
import { eventBus, SystemEvent } from '../core';

eventBus.on(SystemEvent.ERROR_OCCURRED, (errorData: AppError) => {
  // Send to analytics, log to server, etc.
  console.log('Error occurred:', errorData);
});
```

## Integration

### Container Registration

```typescript
// container.init.ts
import { errorHandler } from './error-handler';

container.registerInstance('errorHandler', errorHandler);
```

### EventBus Integration

```typescript
// container.init.ts
const eventBus = container.get<EventBus>('eventBus');
errorHandler.setEventBus(eventBus);
```

### Current Integrations

The Error Handler is integrated with:

- **Emacs**: File save operations
- **Lynx**: External page fetching
- **FileManager**: Event subscriptions
- **Desktop**: Initialization
- **Clipboard**: Paste operations
- **ShareConfig**: Theme encoding/loading
- **ShareThemeUI**: Theme sharing

## Debugging

### Get Error History

```typescript
import { errorHandler } from '../core/error-handler';

// Get all errors
const errors = errorHandler.getErrorHistory();

// Get recent errors
const recent = errorHandler.getRecentErrors(10);
```

### Clear History

```typescript
errorHandler.clearErrors();
```

## Best Practices

### 1. Provide Context

```typescript
// Good
errorHandler.handleError(error, {
  module: 'FileManager',
  action: 'saveFile',
  data: { path: '/home/user/file.txt' },
  severity: ErrorSeverity.HIGH,
  userMessage: 'Failed to save file',
});

// Bad
errorHandler.handleError(error, { module: 'Unknown' });
```

### 2. Use Appropriate Severity

- **LOW**: Optional features, non-critical failures
- **MEDIUM**: Important but recoverable errors
- **HIGH**: Serious errors affecting functionality
- **CRITICAL**: Application-breaking errors

### 3. Provide User-Friendly Messages

```typescript
// Good
userMessage: 'The file could not be found. It may have been moved or deleted.'

// Bad
userMessage: 'ENOENT: no such file or directory'
```

### 4. Use Wrapper Functions

```typescript
// Preferred
await errorHandler.wrapAsync(() => operation(), context);

// Instead of
try {
  await operation();
} catch (error) {
  errorHandler.handleError(error, context);
}
```

## Event Data Structure

```typescript
// ERROR_OCCURRED event payload
interface AppError {
  id: string;              // Unique error ID
  timestamp: number;       // Unix timestamp
  error: Error;           // Original error object
  context: ErrorContext;  // Error context
  stack?: string;         // Stack trace
}
```

## Further Reading

- [Event Bus](event-bus.md)
- [Architecture Overview](architecture.md)
