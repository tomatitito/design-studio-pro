# Technical Architecture Specification

## System Overview

Design Studio Pro follows a multi-layered architecture leveraging Tauri's IPC bridge to connect a React-based frontend with a Rust backend. This architecture ensures optimal performance for resource-intensive operations while maintaining a responsive user interface.

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│                     User Interface Layer                    │
│                                                             │
│  React Components │ Canvas Engine │ State Management       │
│  (TypeScript)     │ (Fabric.js)   │ (Zustand)            │
└────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Tauri IPC Bridge │
                    │   (Commands/Events)│
                    └─────────┬─────────┘
                              │
┌────────────────────────────────────────────────────────────┐
│                      Backend Layer (Rust)                   │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │Image Process.│ │PDF Generator │ │Project Mgmt  │      │
│  │(image-rs)    │ │(printpdf)    │ │(serde)       │      │
│  └──────────────┘ └──────────────┘ └──────────────┘      │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │Color Mgmt    │ │File System   │ │Template Eng. │      │
│  │(lcms2)       │ │(native)      │ │(tera)        │      │
│  └──────────────┘ └──────────────┘ └──────────────┘      │
└────────────────────────────────────────────────────────────┘
                              │
┌────────────────────────────────────────────────────────────┐
│                      Storage Layer                          │
│                                                             │
│  Project Files │ Assets │ Templates │ Cache │ Preferences  │
│  (JSON/Binary) │ (Images)│ (JSON)   │ (Temp)│ (TOML)      │
└────────────────────────────────────────────────────────────┘
```

## Technology Stack Details

### Frontend Technologies

#### Core Framework
- **React 18**: Component-based UI architecture
- **TypeScript 5**: Type safety and better developer experience
- **Vite**: Fast build tool and development server

#### Canvas and Graphics
- **Fabric.js 7**: Primary canvas manipulation library
  - Object model for shapes, images, text
  - Built-in controls for transformation
  - Event handling system
- **Paper.js**: Alternative for vector operations
- **Konva**: Fallback for performance-critical scenarios

#### State Management
- **Zustand**: Lightweight state management
  - Project state
  - UI state
  - Undo/redo history
- **Immer**: Immutable state updates
- **React Query**: Server state and caching

#### Styling and UI Components
- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible component primitives
- **Lucide Icons**: Consistent iconography
- **Framer Motion**: Smooth animations

### Backend Technologies (Rust)

#### Core Dependencies
```toml
[dependencies]
tauri = { version = "2.0", features = ["api-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.35", features = ["full"] }

# Image Processing
image = "0.25"
imageproc = "0.24"
rayon = "1.8"  # Parallel processing

# PDF Generation
krilla = "0.4"    # High-level PDF generation with ICC support
lopdf = "0.32"    # Low-level PDF manipulation
rusttype = "0.9"  # Font rendering

# Color Management
lcms2 = "6.0"
palette = "0.7"

# File Handling
zip = "0.6"
tempfile = "3.10"
notify = "6.1"  # File system events

# Templates
tera = "1.19"
```

#### Module Organization
```
src-tauri/
├── src/
│   ├── main.rs                 # Application entry point
│   ├── commands/               # Tauri command handlers
│   │   ├── mod.rs
│   │   ├── project.rs         # Project management
│   │   ├── canvas.rs          # Canvas operations
│   │   ├── export.rs          # Export functionality
│   │   └── assets.rs          # Asset management
│   ├── core/                  # Core business logic
│   │   ├── mod.rs
│   │   ├── image_processor.rs
│   │   ├── pdf_generator.rs
│   │   ├── color_manager.rs
│   │   └── template_engine.rs
│   ├── models/                # Data structures
│   │   ├── mod.rs
│   │   ├── project.rs
│   │   ├── page.rs
│   │   └── element.rs
│   └── utils/                 # Utilities
│       ├── mod.rs
│       ├── cache.rs
│       └── validation.rs
```

## Data Flow Architecture

### Command Pattern
All frontend-backend communication follows the command pattern:

```typescript
// Frontend
const result = await invoke<ExportResult>('export_to_pdf', {
  projectId: currentProject.id,
  settings: exportSettings
});

// Backend
#[tauri::command]
async fn export_to_pdf(
    project_id: String,
    settings: ExportSettings,
    app_handle: AppHandle
) -> Result<ExportResult, Error> {
    // Implementation
}
```

### Event System
Backend-to-frontend notifications use Tauri's event system:

```rust
// Backend
app_handle.emit_all("export-progress", ProgressPayload {
    percentage: 45,
    message: "Converting images to CMYK"
})?;
```

```typescript
// Frontend
await listen<ProgressPayload>('export-progress', (event) => {
  updateProgress(event.payload);
});
```

## Performance Optimizations

### Image Processing Pipeline
1. **Lazy Loading**: Images loaded on-demand
2. **Proxy Generation**: Low-res proxies for canvas display
3. **Caching**: Multi-level cache (memory + disk)
4. **Parallel Processing**: Rayon for multi-core utilization

### Canvas Rendering
1. **Virtual Scrolling**: Only render visible pages
2. **Object Culling**: Skip off-screen objects
3. **Dirty Rectangle**: Redraw only changed areas
4. **WebGL Acceleration**: When available

### Memory Management
1. **Resource Pooling**: Reuse image buffers
2. **Automatic Cleanup**: Drop unused resources
3. **Streaming**: Process large files in chunks
4. **Compression**: Compress project saves

## Security Architecture

### Sandboxing
- Tauri's built-in sandboxing
- Limited file system access
- No arbitrary code execution

### Data Protection
- Local-only processing
- No telemetry by default
- Encrypted preferences storage

### Input Validation
- Frontend validation (immediate feedback)
- Backend validation (security)
- Schema validation for project files

## Scalability Considerations

### Modular Design
- Plugin architecture for extensions
- Template marketplace ready
- Export format plugins

### Performance Targets
- 100+ page photo books
- 10,000+ assets in library
- Real-time collaboration ready (future)

## Testing Architecture

### Frontend Testing
- **Vitest**: Unit tests
- **React Testing Library**: Component tests
- **Playwright**: E2E tests

### Backend Testing
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_cmyk_conversion() {
        // Test implementation
    }
}
```

### Integration Testing
- Tauri's built-in mocking
- Command testing
- Event testing

## Build and Distribution

### Build Pipeline
1. **Development**: Hot reload for frontend and backend
2. **Staging**: Debug builds with logging
3. **Production**: Optimized, signed binaries

### Platform-Specific Builds
```yaml
# GitHub Actions
- macOS: Universal binary (Intel + Apple Silicon)
- Windows: MSI installer with code signing
- Linux: AppImage, deb, rpm packages
```

### Auto-Updates
- Tauri's built-in updater
- Delta updates for smaller downloads
- Rollback capability

## Database and Storage

### Project Storage
- **Format**: SQLite for metadata + filesystem for assets
- **Location**: User documents folder
- **Backup**: Automatic versioning

### Cache Strategy
```
Cache/
├── thumbnails/     # Generated proxies
├── renders/        # Pre-rendered pages
├── temp/          # Working files
└── downloads/     # Template downloads
```

## Error Handling

### Frontend Error Boundaries
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <CanvasEditor />
</ErrorBoundary>
```

### Backend Result Type
```rust
type CommandResult<T> = Result<T, CommandError>;

#[derive(Debug, Serialize)]
enum CommandError {
    IO(String),
    Validation(String),
    Processing(String),
}
```

## Monitoring and Logging

### Structured Logging
- **Frontend**: Console + Sentry (opt-in)
- **Backend**: env_logger with levels
- **Metrics**: Performance timing

### Debug Tools
- React DevTools integration
- Rust debug builds
- Performance profiler

## Future Architecture Considerations

### Planned Enhancements
1. **Cloud Sync**: Optional project sync
2. **Collaboration**: Real-time multi-user editing
3. **AI Features**: Smart layouts, image enhancement
4. **Mobile Companion**: iOS/Android preview apps

### Architecture Evolution
- Maintain backward compatibility
- Progressive migration path
- Feature flags for experimental features