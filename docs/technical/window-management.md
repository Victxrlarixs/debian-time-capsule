# Window Management System

Technical documentation for the window management architecture in Debian Time Capsule.

## System Design

The window management system follows a modular architecture with specialized managers, each responsible for a specific aspect of window behavior. This design adheres to the Single Responsibility Principle and enables independent testing and maintenance.

```
WindowManagerV2 (Orchestrator)
├── ZIndexManager          # Layer stacking
├── WorkspaceManager       # Virtual desktops
├── WindowPositionManager  # Positioning & centering
├── DragManager           # Pointer-based dragging
├── WindowStateManager    # Min/Max/Shade states
├── DropdownManager       # Panel dropdowns
└── WindowFocusManager    # Focus & active state
```

## Core Components

### WindowManagerV2 (Orchestrator)

Main coordinator that initializes and delegates to specialized managers.

**Responsibilities:**

- Initialize all specialized managers
- Coordinate window registration
- Handle viewport resize events
- Provide unified API for window operations

**Key Methods:**

```typescript
init()                          // Initialize all managers
registerWindow(win: HTMLElement) // Register new window
showWindow(id: string)          // Display window
focusWindow(id: string)         // Focus window
centerWindow(win: HTMLElement)  // Center in viewport
switchWorkspace(id: string)     // Change workspace
```

### ZIndexManager

Manages z-index layers to ensure proper stacking order.

**Architecture:**

- Separate counters for windows and modals
- Windows: Start at `CONFIG.WINDOW.BASE_Z_INDEX` (typically 10000)
- Modals: Start at 90000 (always above windows)

**Methods:**

```typescript
getNextZIndex(isModal?: boolean): number  // Increment and return
getTopZIndex(): number                    // Current highest z-index
```

**Usage:**

```typescript
const zIndex = zIndexManager.getNextZIndex(false); // Window
const modalZ = zIndexManager.getNextZIndex(true); // Modal
```

### WorkspaceManager

Manages 4 virtual workspaces (desktops).

**Workspace Behavior:**

- Each window is assigned to one workspace via `data-workspace` attribute
- Switching workspaces hides current windows and shows target workspace windows
- Windows remember their visibility state with `data-was-opened` attribute

**Methods:**

```typescript
getCurrentWorkspace(): string           // Returns '1', '2', '3', or '4'
switchWorkspace(id: string): void       // Switch to workspace
assignWorkspaceToWindow(win: HTMLElement): void  // Assign on first show
initPager(): void                       // Initialize workspace switcher UI
```

**Workspace Switching Flow:**

1. Hide all windows in current workspace (mark with `data-was-opened`)
2. Update `currentWorkspace` state
3. Show windows in target workspace that were previously opened
4. Update pager UI to reflect active workspace
5. Play click sound

### WindowPositionManager

Handles window positioning, centering, and viewport constraints.

**Positioning Rules:**

- Windows must stay within viewport bounds
- Minimum Y position: `TOP_BAR_HEIGHT` (typically 30px)
- Mobile: Always centered
- Desktop: Constrained to viewport with margins

**Methods:**

```typescript
centerWindow(win: HTMLElement): void           // Center in viewport
normalizeWindowPosition(win: HTMLElement): void // Constrain to bounds
normalizeAllWindows(): void                    // Normalize all on resize
```

**Normalization:**

- Triggered on viewport resize
- Ensures windows remain accessible
- Prevents windows from being off-screen
- Mobile devices force centering

### DragManager

Manages window dragging with pointer events.

**Features:**

- Pointer capture for smooth dragging
- Mouse acceleration support (CSS variable `--mouse-acceleration`)
- Wireframe mode option
- Viewport constraints during drag
- Session persistence on drag end

**Drag Flow:**

1. `pointerdown` on titlebar → Start drag
2. Capture pointer and track movement
3. Apply acceleration to delta movement
4. Constrain to viewport bounds (15px safety margin)
5. `pointerup` → End drag, snap to grid (desktop icons), save position

**Methods:**

```typescript
startDrag(e: PointerEvent, id: string): void
isDragging(): boolean
```

### WindowStateManager

Manages window states: minimize, maximize, and shade.

**States:**

**Minimize:**

- Hides window (`display: none`)
- Plays minimize sound
- Saves state to session

**Maximize:**

- Toggles `maximized` class
- Expands to fill viewport (minus top bar and panel)
- Updates maximize button icon
- Saves state to session

**Shade (Roll-up):**

- Triggered by double-click on titlebar
- Collapses window to show only titlebar
- Toggles `shaded` class
- Plays shade sound

**Methods:**

```typescript
minimizeWindow(id: string): void
maximizeWindow(id: string): void
shadeWindow(id: string): void
```

### WindowFocusManager

Manages window focus and active state.

**Focus Modes:**

- Click-to-focus (default)
- Point-to-focus (optional, via settings)

**Focus Behavior:**

- Brings window to front (z-index)
- Adds `active` class
- Removes `active` from other windows
- Updates button visual states
- Plays focus sound

**Methods:**

```typescript
focusWindow(id: string): void
initGlobalInteraction(): void  // Setup click handlers
```

### DropdownManager

Manages panel dropdown menus (Utilities, Style Manager, Terminal, Browser).

**Behavior:**

- Click to toggle dropdown
- Click outside to close
- Only one dropdown open at a time

**Methods:**

```typescript
initDropdowns(): void  // Setup all panel dropdowns
```

## Window Lifecycle

### Registration

Windows are automatically registered via MutationObserver:

```typescript
// 1. Detect new window in DOM
// 2. Check if already registered (data-cde-registered)
// 3. Find titlebar element
// 4. Restore session if exists
// 5. Setup pointer events for dragging
// 6. Assign to current workspace
// 7. Apply pop-in animation
// 8. Center if visible
```

### Show Window

```typescript
showWindow(id: string)
// 1. Assign workspace if not set
// 2. Set display: flex
// 3. Apply opening animation
// 4. Center on mobile
// 5. Focus window
// 6. Play open sound
```

### Hide Window

```typescript
// User clicks close button
// 1. Set display: none
// 2. Remove from workspace tracking
// 3. Play close sound
```

## Session Persistence

Window positions and states are persisted via `ISessionStorage`:

**Saved State:**

```typescript
interface WindowState {
  left: string; // CSS left position
  top: string; // CSS top position
  maximized: boolean; // Maximized state
}
```

**Persistence Flow:**

- Save: On drag end, state change
- Load: On window registration
- Storage: IndexedDB via SettingsManager

## Mobile vs Desktop

### Desktop Behavior

- Windows can be positioned anywhere
- Drag and drop enabled
- Resize handles (if implemented)
- Multiple windows visible

### Mobile Behavior

- Windows always centered
- Limited dragging
- One window at a time recommended
- Touch gestures for interactions

## Event Integration

Window manager emits events via EventBus:

```typescript
SystemEvent.WINDOW_FOCUSED; // Window gains focus
SystemEvent.WINDOW_MINIMIZED; // Window minimized
SystemEvent.WINDOW_MAXIMIZED; // Window maximized
```

## Performance Considerations

### Viewport Resize

- Debounced normalization (300ms delay)
- Prevents excessive recalculations
- Batch updates all windows

### MutationObserver

- Efficient DOM monitoring
- Automatic window registration
- No manual tracking needed

### Pointer Events

- Better than mouse events
- Touch and pen support
- Pointer capture for smooth dragging

## Configuration

Key configuration values from `CONFIG`:

```typescript
WINDOW: {
  BASE_Z_INDEX: 10000,
  TOP_BAR_HEIGHT: 30,
}
TIMINGS: {
  NORMALIZATION_DELAY: 300,
}
```

## Further Reading

- [Architecture Overview](./architecture.md)
- [Event Bus](./event-bus.md)
- [Dependency Injection](./dependency-injection.md)
