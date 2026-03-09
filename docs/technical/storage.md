# Storage & Cache Management

Technical documentation for the storage and caching system in Debian Time Capsule.

## Overview

CDE uses a layered storage approach:

1. **IndexedDB** - Primary storage for structured data
2. **localStorage** - Fallback for browsers without IndexedDB
3. **Memory Cache** - Runtime caching for performance

## Architecture

```
┌─────────────────────────────────────┐
│      Storage Adapter (Unified API)  │
├─────────────────────────────────────┤
│  IndexedDB Manager  │  localStorage │
├─────────────────────────────────────┤
│         Memory Cache                │
└─────────────────────────────────────┘
```

## IndexedDB Implementation

### Database Schema

```typescript
// Database: cde-time-capsule
// Version: 1

const DB_NAME = 'cde-time-capsule';
const DB_VERSION = 1;

// Object Stores
const STORES = {
  SETTINGS: 'settings', // User preferences
  SESSION: 'session', // Window positions, state
  FILESYSTEM: 'filesystem', // VFS data (future)
  CACHE: 'cache', // Temporary data
};
```

### Store Details

#### 1. Settings Store

```typescript
// Key-value pairs for user settings
{
  'theme': {
    palette: 'Broica',
    backdrop: 'CircuitBoards'
  },
  'accessibility': {
    fontSize: 14,
    highContrast: false,
    reducedMotion: false
  },
  'keyboard': {
    shortcuts: { ... }
  }
}
```

#### 2. Session Store

```typescript
// Window and workspace state
{
  'windows': [
    {
      id: 'emacs-1',
      x: 100,
      y: 100,
      width: 600,
      height: 400,
      state: 'normal',
      workspace: 1
    }
  ],
  'currentWorkspace': 1
}
```

#### 3. Cache Store

```typescript
// Temporary cached data with TTL
{
  'xpm-render-Afternoon': {
    data: 'data:image/png;base64,...',
    timestamp: 1234567890,
    ttl: 604800000 // 7 days
  }
}
```

## Storage Adapter

Unified API that abstracts storage implementation.

### Usage

```typescript
import { storageAdapter } from './utilities/storage-adapter';

// Save data
await storageAdapter.set('theme', themeData);

// Retrieve data
const theme = await storageAdapter.get('theme');

// Remove data
await storageAdapter.remove('theme');

// Clear all
await storageAdapter.clear();
```

### Implementation

```typescript
class StorageAdapter {
  private useIndexedDB: boolean;

  async init() {
    // Try IndexedDB first
    try {
      await indexedDBManager.init();
      this.useIndexedDB = true;
    } catch (error) {
      // Fallback to localStorage
      this.useIndexedDB = false;
    }
  }

  async set(key: string, value: any) {
    if (this.useIndexedDB) {
      return indexedDBManager.set(STORES.SETTINGS, key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  async get(key: string) {
    if (this.useIndexedDB) {
      return indexedDBManager.get(STORES.SETTINGS, key);
    } else {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    }
  }
}
```

## IndexedDB Manager

Low-level IndexedDB operations.

### Initialization

```typescript
class IndexedDBManager {
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS);
        }
        if (!db.objectStoreNames.contains(STORES.SESSION)) {
          db.createObjectStore(STORES.SESSION);
        }
        if (!db.objectStoreNames.contains(STORES.CACHE)) {
          const cacheStore = db.createObjectStore(STORES.CACHE);
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }
}
```

### CRUD Operations

```typescript
// Create/Update
async set(storeName: string, key: string, value: any) {
  const tx = this.db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await store.put(value, key);
  await tx.complete;
}

// Read
async get(storeName: string, key: string) {
  const tx = this.db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  return await store.get(key);
}

// Delete
async remove(storeName: string, key: string) {
  const tx = this.db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await store.delete(key);
  await tx.complete;
}

// Clear store
async clear(storeName: string) {
  const tx = this.db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  await store.clear();
  await tx.complete;
}
```

## Cache Management

### Cache Strategy

```typescript
class CacheManager {
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  async set(key: string, data: any, ttl = this.DEFAULT_TTL) {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    await indexedDBManager.set(STORES.CACHE, key, cacheEntry);
  }

  async get(key: string) {
    const entry = await indexedDBManager.get(STORES.CACHE, key);

    if (!entry) return null;

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      await this.remove(key);
      return null;
    }

    return entry.data;
  }

  async cleanup() {
    // Remove expired entries
    const tx = this.db.transaction(STORES.CACHE, 'readwrite');
    const store = tx.objectStore(STORES.CACHE);
    const index = store.index('timestamp');

    const cutoff = Date.now() - this.DEFAULT_TTL;
    const range = IDBKeyRange.upperBound(cutoff);

    const cursor = await index.openCursor(range);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
}
```

### What Gets Cached

1. **XPM Renders** - Parsed backdrop images (7 days TTL)
2. **Theme Previews** - Generated theme thumbnails (30 days TTL)
3. **VFS Snapshots** - Filesystem state (session TTL)

## Migration System

### localStorage to IndexedDB

```typescript
async migrateFromLocalStorage() {
  const keysToMigrate = [
    'cde-settings',
    'cde-theme',
    'cde-accessibility',
    'cde-session'
  ];

  for (const key of keysToMigrate) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        const parsed = JSON.parse(value);
        await indexedDBManager.set(STORES.SETTINGS, key, parsed);
        localStorage.removeItem(key); // Clean up
      } catch (error) {
        console.error(`Failed to migrate ${key}:`, error);
      }
    }
  }
}
```

## Storage Quota Management

### Check Available Space

```typescript
async getStorageEstimate() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      percentage: ((estimate.usage || 0) / (estimate.quota || 1)) * 100
    };
  }
  return null;
}
```

### Handle Quota Exceeded

```typescript
async handleQuotaExceeded() {
  // 1. Clean up cache
  await cacheManager.cleanup();

  // 2. Remove old session data
  await this.cleanOldSessions();

  // 3. Notify user
  showToast('Storage space low. Old data cleaned up.', 'warning');
}
```

## Version Management

### Schema Versioning

```typescript
// When schema changes, increment DB_VERSION
const DB_VERSION = 2; // Changed from 1

request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result;
  const oldVersion = event.oldVersion;

  // Migration from v1 to v2
  if (oldVersion < 2) {
    // Add new index
    const cacheStore = db.transaction.objectStore(STORES.CACHE);
    cacheStore.createIndex('ttl', 'ttl', { unique: false });
  }
};
```

## Performance Considerations

### Batch Operations

```typescript
// Bad: Multiple transactions
for (const item of items) {
  await indexedDBManager.set(STORES.CACHE, item.key, item.value);
}

// Good: Single transaction
const tx = db.transaction(STORES.CACHE, 'readwrite');
const store = tx.objectStore(STORES.CACHE);
for (const item of items) {
  store.put(item.value, item.key);
}
await tx.complete;
```

### Lazy Loading

```typescript
// Don't load all data at startup
// Load on-demand instead
async loadThemeData() {
  if (!this.themeCache) {
    this.themeCache = await indexedDBManager.get(STORES.SETTINGS, 'theme');
  }
  return this.themeCache;
}
```

## Error Handling

```typescript
try {
  await storageAdapter.set('key', value);
} catch (error) {
  if (error.name === 'QuotaExceededError') {
    await handleQuotaExceeded();
  } else if (error.name === 'InvalidStateError') {
    // Database closed, reinitialize
    await indexedDBManager.init();
  } else {
    // Fallback to localStorage
    localStorage.setItem('key', JSON.stringify(value));
  }
}
```

## Testing

### Manual Testing

```javascript
// In browser console
await indexedDBManager.set(STORES.SETTINGS, 'test', { foo: 'bar' });
const result = await indexedDBManager.get(STORES.SETTINGS, 'test');
console.log(result); // { foo: 'bar' }
```

### Storage Inspector

Use browser DevTools:

- Chrome: Application → Storage → IndexedDB
- Firefox: Storage → IndexedDB
- Safari: Storage → IndexedDB

## Best Practices

1. **Always use Storage Adapter** - Don't access IndexedDB directly
2. **Handle errors gracefully** - Always have fallback
3. **Clean up regularly** - Remove expired cache entries
4. **Batch operations** - Use transactions efficiently
5. **Monitor quota** - Check storage usage periodically

## Further Reading

- [Architecture Overview](architecture.md)
- [Dependency Injection Architecture](dependency-injection.md)
- [Error Handling](error-handling.md)
