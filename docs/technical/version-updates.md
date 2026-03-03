# Version Updates System

## Overview

The Debian Time Capsule includes an automatic version management system that handles cache clearing and displays an authentic Unix-style package update sequence when the application version changes.

## How It Works

### 1. Version Detection

When the application loads, the `VersionManager` checks if the stored version matches the current version from `package.json`:

```typescript
// Stored in localStorage: 'cde-app-version'
const storedVersion = localStorage.getItem('cde-app-version');
const currentVersion = import.meta.env.PUBLIC_APP_VERSION;
```

### 2. Update Trigger

If versions don't match, the system:

1. Clears localStorage (except preserved keys)
2. Clears IndexedDB settings
3. Clears Service Worker caches
4. Sets a flag: `localStorage.setItem('cde-pending-update', 'true')`
5. Reloads the page

### 3. Update Sequence Display

On the next boot, instead of showing the normal boot sequence, the system displays an authentic Unix package update sequence:

- **Normal Boot**: Shows `boot-messages.json` with kernel initialization, services, and desktop startup
- **Update Mode**: Shows `update-messages.json` with package downloads, installation, and configuration

### 4. Boot Sequence Generalization

The `DebianRealBoot` class now accepts a mode parameter:

```typescript
const isUpdateMode = VersionManager.hasPendingUpdate();
window.debianBoot = new DebianRealBoot(isUpdateMode);
```

Both modes use the same:

- Boot screen component
- CSS classes and animations
- Progress bar
- Completion logic

## File Structure

### Boot Messages (`boot-messages.json`)

```json
{
  "phases": [
    {
      "name": "kernel",
      "min": 5,
      "max": 8,
      "messages": [{ "text": "Linux version 2.0.36...", "type": "kernel" }]
    }
  ]
}
```

### Update Messages (`update-messages.json`)

```json
{
  "phases": [
    {
      "name": "preparation",
      "min": 3,
      "max": 5,
      "messages": [{ "text": "Reading package lists... Done", "type": "package" }]
    },
    {
      "name": "packages",
      "min": 8,
      "max": 12,
      "messages": [{ "text": "Get:1 http://archive.debian.org/debian...", "type": "download" }]
    },
    {
      "name": "installation",
      "min": 6,
      "max": 9,
      "messages": [{ "text": "Unpacking libxpm4...", "type": "install" }]
    }
  ]
}
```

## Message Types and Colors

### Boot Mode

- `kernel` - Gray (#cccccc) - Kernel messages
- `cpu` - Light blue (#88aaff) - CPU detection
- `memory` - Orange (#ffaa88) - Memory info
- `fs` - Yellow (#ffff88) - Filesystem
- `systemd` - Cyan (#88ffff) - Init system
- `service` - Green (#00ff00) - Services
- `drm` - Red (#ff8888) - Graphics
- `desktop` - Bright cyan (#00ffaa) - Desktop ready

### Update Mode

- `package` - Light blue (#88aaff) - Package operations
- `download` - Orange (#ffaa88) - Downloads
- `install` - Green (#00ff00) - Installation
- `service` - Green (#00ff00) - Service restarts

## Testing Updates

To test the update sequence:

1. Open browser console
2. Change the version:
   ```javascript
   localStorage.setItem('cde-app-version', '0.0.1');
   ```
3. Reload the page
4. You'll see the update sequence instead of normal boot

## Triggering Updates in Production

Update the version in `package.json`:

```json
{
  "version": "1.0.6"
}
```

When users visit the site with the new version, they'll automatically see the update sequence.

## Customization

### Adding New Message Types

1. Add to `update-messages.json` or `boot-messages.json`
2. Add CSS class in `public/css/desktop/boot-screen.css`:
   ```css
   .boot-newtype {
     color: #yourcolor;
   }
   ```
3. Add to type map in `src/scripts/boot/init.ts`:
   ```typescript
   private getLineClass(type: string): string {
     const map: Record<string, string> = {
       // ...
       newtype: 'boot-newtype',
     };
     return map[type] || 'boot-default';
   }
   ```

### Preserving User Data During Updates

Edit `src/scripts/core/version-manager.ts`:

```typescript
const preserveKeys: string[] = [
  'cde-system-settings', // User preferences
  'cde_high_contrast', // Accessibility
  // Add more keys to preserve
];
```

## Architecture Benefits

1. **No Modal Interruption**: Updates feel like a natural system operation
2. **Authentic Experience**: Mimics real Unix package management
3. **Code Reuse**: Same boot screen component for both modes
4. **Flexible**: Easy to add new message types or phases
5. **Testable**: Can trigger updates manually for testing

## Related Files

- `src/scripts/core/version-manager.ts` - Version detection and cache clearing
- `src/scripts/boot/init.ts` - Boot sequence orchestration
- `src/data/boot-messages.json` - Normal boot messages
- `src/data/update-messages.json` - Update sequence messages
- `public/css/desktop/boot-screen.css` - Styling for both modes
- `src/components/desktop/BootSequence.astro` - Boot screen component

## Future Enhancements

- Add migration scripts for specific version transitions
- Show changelog after update completes
- Add rollback capability for failed updates
- Track update history in IndexedDB
