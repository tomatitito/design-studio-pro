# API Specification

## Overview

This document defines the Tauri command API that bridges the React frontend with the Rust backend. All commands follow a consistent pattern for request/response handling and error management.

## Command Structure

### Naming Convention

```typescript
// Frontend invocation
await invoke<ResponseType>('module_action_target', params);

// Backend handler
#[tauri::command]
async fn module_action_target(params: ParamType) -> Result<ResponseType, Error>
```

### Error Handling

```rust
#[derive(Debug, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum CommandError {
    NotFound { resource: String },
    InvalidInput { field: String, reason: String },
    IOError { path: String, operation: String },
    ProcessingError { message: String },
    PermissionDenied { action: String },
}

type CommandResult<T> = Result<T, CommandError>;
```

## Project Management API

### Create Project

```typescript
// Frontend
interface CreateProjectParams {
  type: 'photo_book' | 'calendar' | 'card' | 'photo_sheet';
  title: string;
  dimensions: {
    width: number;  // mm
    height: number; // mm
  };
  pages?: number;
  template?: string;
}

const project = await invoke<Project>('project_create', {
  params: createProjectParams
});
```

```rust
// Backend
#[tauri::command]
async fn project_create(
    params: CreateProjectParams,
    app_handle: AppHandle
) -> CommandResult<Project> {
    // Implementation
}
```

### Open Project

```typescript
// Frontend
const project = await invoke<Project>('project_open', {
  path: '/path/to/project.dsproj'
});
```

### Save Project

```typescript
// Frontend
await invoke('project_save', {
  projectId: currentProject.id,
  path?: string  // Optional for Save As
});
```

### List Recent Projects

```typescript
// Frontend
interface RecentProject {
  id: string;
  title: string;
  path: string;
  thumbnail?: string;
  lastModified: string;
}

const recent = await invoke<RecentProject[]>('project_list_recent', {
  limit: 10
});
```

### Project Commands Summary

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `project_create` | CreateProjectParams | Project | Create new project |
| `project_open` | path: string | Project | Open existing project |
| `project_save` | projectId, path? | void | Save project |
| `project_close` | projectId: string | void | Close project |
| `project_export` | projectId, format, settings | ExportResult | Export project |
| `project_list_recent` | limit: number | RecentProject[] | Get recent projects |
| `project_get_info` | projectId: string | ProjectInfo | Get project metadata |

## Canvas Operations API

### Add Element

```typescript
// Frontend
interface AddElementParams {
  projectId: string;
  pageId: string;
  element: {
    type: 'image' | 'text' | 'shape';
    position: { x: number; y: number };
    size: { width: number; height: number };
    data: any; // Type-specific data
  };
}

const elementId = await invoke<string>('canvas_add_element', {
  params: addElementParams
});
```

### Update Element

```typescript
// Frontend
interface UpdateElementParams {
  projectId: string;
  pageId: string;
  elementId: string;
  updates: Partial<Element>;
}

await invoke('canvas_update_element', {
  params: updateElementParams
});
```

### Canvas Commands Summary

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `canvas_add_element` | AddElementParams | string | Add element to canvas |
| `canvas_update_element` | UpdateElementParams | void | Update element properties |
| `canvas_delete_element` | projectId, pageId, elementId | void | Delete element |
| `canvas_move_element` | projectId, pageId, elementId, position | void | Move element |
| `canvas_resize_element` | projectId, pageId, elementId, size | void | Resize element |
| `canvas_rotate_element` | projectId, pageId, elementId, angle | void | Rotate element |
| `canvas_duplicate_element` | projectId, pageId, elementId | string | Duplicate element |
| `canvas_group_elements` | projectId, pageId, elementIds[] | string | Group elements |
| `canvas_ungroup_elements` | projectId, pageId, groupId | string[] | Ungroup elements |
| `canvas_reorder_element` | projectId, pageId, elementId, zIndex | void | Change z-order |

## Image Processing API

### Process Image

```typescript
// Frontend
interface ImageProcessParams {
  imagePath: string;
  operations: ImageOperation[];
}

interface ImageOperation {
  type: 'resize' | 'crop' | 'rotate' | 'adjust' | 'filter';
  params: any;
}

const result = await invoke<ProcessedImage>('image_process', {
  params: imageProcessParams
});
```

### Image Adjustments

```typescript
// Frontend
interface ImageAdjustments {
  brightness?: number;    // -100 to 100
  contrast?: number;      // -100 to 100
  saturation?: number;    // -100 to 100
  temperature?: number;   // -100 to 100
  tint?: number;         // -100 to 100
  highlights?: number;   // -100 to 100
  shadows?: number;      // -100 to 100
}

await invoke('image_adjust', {
  imageId: string,
  adjustments: ImageAdjustments
});
```

### Image Commands Summary

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `image_import` | paths: string[] | ImageAsset[] | Import images |
| `image_process` | ImageProcessParams | ProcessedImage | Process image |
| `image_adjust` | imageId, adjustments | void | Apply adjustments |
| `image_crop` | imageId, cropData | void | Crop image |
| `image_resize` | imageId, dimensions | void | Resize image |
| `image_apply_filter` | imageId, filterType | void | Apply filter |
| `image_generate_thumbnail` | imagePath | string | Generate thumbnail |
| `image_analyze` | imagePath | ImageAnalysis | Analyze image |

## Text Operations API

### Add Text

```typescript
// Frontend
interface AddTextParams {
  projectId: string;
  pageId: string;
  content: string;
  position: Point;
  style: TextStyle;
}

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  color: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
}

const textId = await invoke<string>('text_add', {
  params: addTextParams
});
```

### Text Commands Summary

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `text_add` | AddTextParams | string | Add text element |
| `text_update` | textId, content, style | void | Update text |
| `text_apply_style` | textId, style | void | Apply text style |
| `text_fit_to_path` | textId, pathData | void | Text on path |
| `text_convert_to_outline` | textId | ShapeData | Convert to shape |

## Template API

### Load Template

```typescript
// Frontend
interface LoadTemplateParams {
  projectId: string;
  templateId: string;
  pageIds?: string[];  // Apply to specific pages
}

await invoke('template_apply', {
  params: loadTemplateParams
});
```

### Template Commands Summary

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `template_list` | category?: string | Template[] | List templates |
| `template_apply` | LoadTemplateParams | void | Apply template |
| `template_save` | projectId, name, pages | string | Save as template |
| `template_delete` | templateId | void | Delete template |
| `template_import` | path | Template | Import template |
| `template_export` | templateId, path | void | Export template |

## Export API

### Export to PDF

```typescript
// Frontend
interface PDFExportParams {
  projectId: string;
  outputPath: string;
  settings: {
    standard: 'PDF/X-1a' | 'PDF/X-4';
    colorSpace: 'CMYK' | 'RGB';
    resolution: number;
    includeBleed: boolean;
    includeCropMarks: boolean;
    compression?: {
      images: boolean;
      quality: number;
    };
  };
}

const result = await invoke<ExportResult>('export_to_pdf', {
  params: pdfExportParams
});

interface ExportResult {
  success: boolean;
  path: string;
  warnings?: string[];
  errors?: string[];
}
```

### Export Commands Summary

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `export_to_pdf` | PDFExportParams | ExportResult | Export as PDF |
| `export_to_images` | projectId, format, settings | string[] | Export as images |
| `export_preflight_check` | projectId | PreflightResult | Check before export |
| `export_package` | projectId, outputPath | void | Export project package |

## Asset Management API

### Import Assets

```typescript
// Frontend
interface ImportAssetsParams {
  projectId: string;
  paths: string[];
  type: 'image' | 'font' | 'graphic';
}

const assets = await invoke<Asset[]>('assets_import', {
  params: importAssetsParams
});
```

### Asset Commands Summary

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `assets_import` | ImportAssetsParams | Asset[] | Import assets |
| `assets_list` | projectId, type? | Asset[] | List project assets |
| `assets_delete` | projectId, assetId | void | Delete asset |
| `assets_get_info` | assetId | AssetInfo | Get asset metadata |
| `assets_optimize` | projectId | OptimizeResult | Optimize all assets |

## Color Management API

### Convert Color Space

```typescript
// Frontend
interface ColorConversionParams {
  color: Color;
  fromSpace: 'RGB' | 'CMYK' | 'LAB';
  toSpace: 'RGB' | 'CMYK' | 'LAB';
  profile?: string;
}

const converted = await invoke<Color>('color_convert', {
  params: colorConversionParams
});
```

### Color Commands Summary

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `color_convert` | ColorConversionParams | Color | Convert color space |
| `color_get_profiles` | type: 'RGB' \| 'CMYK' | Profile[] | List ICC profiles |
| `color_soft_proof` | imageId, profile | string | Generate soft proof |
| `color_check_gamut` | colors[], profile | GamutCheck[] | Check color gamut |

## Settings API

### Get/Set Preferences

```typescript
// Frontend
interface Preferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  defaultColorProfile: string;
  autoSave: boolean;
  autoSaveInterval: number;
  recentFilesLimit: number;
}

const prefs = await invoke<Preferences>('settings_get_preferences');

await invoke('settings_set_preferences', {
  preferences: updatedPrefs
});
```

### Settings Commands Summary

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `settings_get_preferences` | - | Preferences | Get user preferences |
| `settings_set_preferences` | preferences | void | Update preferences |
| `settings_reset_preferences` | - | void | Reset to defaults |
| `settings_get_shortcuts` | - | Shortcuts | Get keyboard shortcuts |
| `settings_set_shortcuts` | shortcuts | void | Update shortcuts |

## Event System

### Frontend Event Listeners

```typescript
// Listen for backend events
import { listen } from '@tauri-apps/api/event';

// Progress updates
const unlisten = await listen<ProgressEvent>('export-progress', (event) => {
  console.log(`Export progress: ${event.payload.percentage}%`);
});

// Auto-save notification
await listen('auto-save', (event) => {
  showToast('Project auto-saved');
});

// Error events
await listen<ErrorEvent>('error', (event) => {
  showError(event.payload.message);
});
```

### Backend Event Emission

```rust
// Emit events from backend
use tauri::Manager;

// Progress event
app_handle.emit_all("export-progress", ProgressEvent {
    percentage: 75,
    message: "Converting to CMYK".to_string(),
})?;

// Error event
app_handle.emit_all("error", ErrorEvent {
    code: "IMG_001",
    message: "Failed to load image".to_string(),
    details: Some("Unsupported format".to_string()),
})?;
```

### Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `project-changed` | ProjectChangeEvent | Project modified |
| `export-progress` | ProgressEvent | Export progress update |
| `import-complete` | ImportResult | Asset import finished |
| `auto-save` | AutoSaveEvent | Auto-save triggered |
| `error` | ErrorEvent | Error occurred |
| `warning` | WarningEvent | Warning notification |

## Batch Operations API

### Batch Process

```typescript
// Frontend
interface BatchOperation {
  id: string;
  type: 'resize' | 'convert' | 'optimize';
  targets: string[];
  params: any;
}

const results = await invoke<BatchResult[]>('batch_process', {
  operations: BatchOperation[]
});
```

## Performance Monitoring API

### Get Performance Metrics

```typescript
// Frontend
interface PerformanceMetrics {
  memoryUsage: {
    heap: number;
    external: number;
    total: number;
  };
  renderTime: number;
  commandLatency: Record<string, number>;
}

const metrics = await invoke<PerformanceMetrics>('debug_get_metrics');
```

## Plugin System API

### Load Plugin

```typescript
// Frontend
interface Plugin {
  id: string;
  name: string;
  version: string;
  commands: string[];
}

const plugin = await invoke<Plugin>('plugin_load', {
  path: '/path/to/plugin'
});
```

## Testing Helpers

### Mock Commands

```typescript
// Frontend test environment
import { mockIPC } from '@tauri-apps/api/mocks';

mockIPC((cmd, args) => {
  if (cmd === 'project_create') {
    return { id: 'test-id', title: args.title };
  }
});
```

## Rate Limiting

### Command Throttling

```typescript
// Certain commands are throttled to prevent overload
const throttledCommands = {
  'canvas_update_element': 100,  // ms
  'image_adjust': 200,           // ms
  'export_preflight_check': 1000 // ms
};
```

## API Versioning

### Version Check

```typescript
// Frontend
const apiVersion = await invoke<string>('get_api_version');
// Returns: "1.0.0"
```

### Compatibility

```rust
// Backend
#[tauri::command]
async fn get_api_version() -> Result<String, Error> {
    Ok(API_VERSION.to_string())
}

const API_VERSION: &str = "1.0.0";
```