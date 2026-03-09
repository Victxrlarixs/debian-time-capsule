# 🛠️ Technical Documentation

Welcome to the internal engine of the Debian Time Capsule. This project is built with modern technologies to recreate a classic experience.

---

## 🏗️ Core Architecture

- **[System Architecture](architecture.md)**
  Detailed overview of the modular design, event-driven communication, and component structure.

- **[Window Management](window-management.md)**
  Complete window system with specialized managers for z-index, workspaces, positioning, dragging, states, and focus.

- **[Virtual File System](virtual-filesystem.md)**
  Unix-like filesystem abstraction with O(1) lookups, CRUD operations, trash management, and IndexedDB persistence.

- **[Module Loading](module-loading.md)**
  Sophisticated lazy loading system with 5-tier priority, dependency resolution, and code splitting for optimal performance.

- **[Dependency Injection](dependency-injection.md)**
  Modern DI architecture with SOLID principles. Includes:
  - **Interface Segregation**: Small, focused interfaces instead of monolithic ones.
  - **DI Container**: Service registration and resolution.
  - **Adapters**: Wrapping legacy code with new interfaces.
  - **Migration Guide**: Step-by-step guide to migrate components.

- **[Storage & Cache](storage.md)**
  Deep dive into data persistence using IndexedDB and localStorage, and our multi-layered caching strategy.

- **[Error Handling](error-handling.md)**
  Centralized error handling system with severity levels, context tracking, and user-friendly error messages.

- **[Event Bus](event-bus.md)**
  Type-safe event system for decoupled component communication with wildcard support and error handling integration.

---

## 💻 Tech Stack

- **Framework**: [Astro 5](https://astro.build/) - Islands architecture for minimal JS overhead.
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Strict typing for system-level stability.
- **State**: Event-driven bus for decoupled component communication.
- **Styling**: Vanilla CSS with modern Custom Properties (Variables).
- **Vite**: Ultra-fast bundling and development.

---

## 🚀 Performance Targets

We aim for a "snappy" 1990s feel with 2020s performance:

- **Zero CLS**: Layout stability is paramount for the desktop feel.
- **Off-Main-Thread**: Heavy parsing (XPM, Man pages) happens in Web Workers.
- **Lazy Hydration**: Only the components you use are loaded into memory.

---

## 🤝 Development Workflow

Ready to contribute? Please follow these guides:

1. **[Contributing Guidelines](../../CONTRIBUTING.md)**
   - Setup instructions
   - PR requirements
   - Code standards & style
2. **[Version Updates](version-updates.md)**
   - Track recent architectural changes and updates.

---

## 📂 Project Organization

```text
src/
├── core/           # System foundations (WindowManager, VFS, Events)
├── features/       # Application-specific logic (XEmacs, Lynx, etc.)
├── components/     # UI Islands (Astro & TS)
├── utilities/      # Shared helpers
└── workers/        # Performance-critical background scripts
```

---

_For API specifics, please refer to the source code comments. We are working on auto-generating full API docs._
