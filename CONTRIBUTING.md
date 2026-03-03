# Contributing to Debian-CDE

## Development Setup

### Prerequisites

- Node.js v20+
- npm v10+

### Quick Start

```bash
git clone <your-fork>
npm install
npm run dev
```

## Pull Request Process

### Before Submitting

1. **Format**: `npm run format`
2. **Build**: `npm run build` (must pass)
3. **Test**: Verify functionality across screen sizes
4. **Lint**: Follow existing TypeScript patterns

### PR Requirements

- Reference issue number if applicable
- Include clear description of changes
- Test on desktop/mobile if UI changes
- Follow existing code patterns and architecture

### Review Process

- Automatic deployment on merge to `main`
- Build verification via GitHub Actions
- Manual testing for UI/UX changes

## Code Standards

### TypeScript

- Strict typing required
- Use existing interfaces and types
- Follow established patterns in `/src/scripts/`

### CSS

- Use existing CSS variables from `/public/css/base/variables.css`
- Follow BEM-like naming conventions
- Maintain responsive design principles

### File Organization

- Components: `/src/components/`
- Business logic: `/src/scripts/features/`
- Core systems: `/src/scripts/core/`
- Utilities: `/src/scripts/utilities/`

## Architecture Guidelines

### Key Systems

Refer to technical documentation for detailed architecture:

- **Architecture Overview**: `docs/technical/architecture.md`
- **Storage Systems**: `docs/technical/storage.md`
- **Technical README**: `docs/technical/README.md`

### Module Patterns

- Style modules: Implement `load()`, `apply()`, `syncUI()`, `update()`
- Use `settingsManager.setSection()` for persistence
- Follow existing patterns in `/src/scripts/features/style/`

### Performance Considerations

- Use Web Workers for heavy operations (see `xpmparser.ts`)
- Implement proper cleanup in component lifecycle
- Cache expensive operations where appropriate

## Common Tasks

### Adding New Style Module

1. Create module in `/src/scripts/features/style/`
2. Implement required methods: `load()`, `apply()`, `syncUI()`, `update()`
3. Register in `StyleManager` constructor
4. Add UI component in `/src/components/features/style/`
5. Add CSS in `/public/css/components/style-manager/`

### Adding Desktop Icon

1. Add icon to `/public/icons/`
2. Update `SYSTEM_ICONS` array in `desktop.ts`
3. Implement click handler if needed

### Modifying Themes

- XPM backdrops use palette colors - clear cache on palette changes
- Test with multiple palettes to ensure compatibility
- Use existing palettes from `/src/data/cde_palettes.json`

## Testing

### Manual Testing

- Desktop: Window management, drag & drop, right-click menus
- Mobile: Touch gestures, responsive layouts
- Theme system: URL sharing, palette changes, backdrop rendering

### Build Verification

```bash
npm run format  # Code formatting
npm run build   # TypeScript compilation and Astro build
```

## Documentation

For detailed information, see:

- **User Guide**: `docs/user-guide/`
- **Technical Docs**: `docs/technical/`
- **Architecture**: `docs/technical/architecture.md`

### Documentation Standards

- **Language**: Use clear, concise English. Avoid unnecessary jargon.
- **Formatting**: Use standard Markdown. Include code examples for technical sections.
- **Visuals**: Add screenshots for UI changes when possible.
- **Completeness**: Ensure all new features are documented in both the User Guide and Technical Docs.
- **Types**: Include TypeScript types and interface definitions in API references.

### Contributing to Documentation

Found an error or want to improve the documentation?

1. **Identify**: Find the relevant `.md` file in the `docs/` directory.
2. **Edit**: Make your changes, ensuring they follow the standards above.
3. **Verify**: Check that all links are working and formatting is correct.
4. **PR**: Submit a pull request with a description of the documentation improvements.

For major documentation changes, please open an issue first to discuss the structure.

## Issues and Discussions

- **Bug Reports**: Use GitHub Issues with reproduction steps
- **Feature Requests**: Propose in GitHub Discussions first
- **Questions**: Check existing documentation before asking

---

Built with TypeScript, Astro, and authentic CDE design principles.
