# Data Formats Specification

## Project File Format

### Overview
Projects are saved as `.dsproj` files (Design Studio Project), which are ZIP archives containing a manifest and associated assets.

### Project Structure
```
project.dsproj (ZIP archive)
├── manifest.json          # Project metadata and structure
├── assets/               # Images and resources
│   ├── images/
│   │   ├── img_001.jpg  # Original images
│   │   └── img_002.png
│   ├── thumbnails/      # Generated thumbnails
│   │   ├── img_001_thumb.jpg
│   │   └── img_002_thumb.jpg
│   └── fonts/           # Embedded custom fonts
│       └── custom-font.ttf
├── pages/               # Individual page definitions
│   ├── page_001.json
│   ├── page_002.json
│   └── ...
└── metadata/           # Additional metadata
    ├── color_profiles/
    └── history.json    # Undo/redo history
```

### Manifest Schema

```typescript
interface ProjectManifest {
  version: string;           // Format version (e.g., "1.0.0")
  id: string;                // UUID
  type: ProjectType;         // "photo_book" | "calendar" | "card" | "photo_sheet"
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  assets: AssetRegistry;
  pages: PageReference[];
  history: HistoryMetadata;
}

interface ProjectMetadata {
  title: string;
  description?: string;
  author: string;
  created: ISO8601String;
  modified: ISO8601String;
  thumbnail?: string;        // Base64 encoded preview
  tags?: string[];
}

interface ProjectSettings {
  dimensions: {
    width: number;           // in mm
    height: number;          // in mm
    bleed: number;          // in mm (typically 3mm)
  };
  colorProfile: ColorProfile;
  resolution: number;        // DPI (typically 300)
  binding?: BindingType;     // For books
  orientation: "portrait" | "landscape" | "square";
}

interface AssetRegistry {
  images: ImageAsset[];
  fonts: FontAsset[];
  colors: ColorPalette[];
  colorSchemes: ColorScheme[];          // Saved / applied color schemes
}

interface ProjectColorScheme {
  active?: SchemeApplication;           // Currently applied scheme
  custom: ColorScheme[];                // User-created schemes for this project
}

interface PageReference {
  id: string;
  order: number;
  file: string;             // Relative path to page file
  type: "cover" | "content" | "back";
  spread?: boolean;         // True for two-page spreads
}
```

## Page Data Format

### Page Schema

```typescript
interface Page {
  id: string;
  version: string;
  dimensions: Dimensions;
  background: Background;
  elements: Element[];
  guides: Guide[];
  metadata: PageMetadata;
}

interface Element {
  id: string;
  type: ElementType;
  position: Position;
  size: Size;
  rotation: number;         // Degrees
  opacity: number;          // 0-1
  locked: boolean;
  visible: boolean;
  zIndex: number;
  data: ElementData;        // Type-specific data
}

type ElementType = "image" | "text" | "shape" | "group";

interface ImageElement extends ElementData {
  assetId: string;          // Reference to asset registry
  crop?: CropData;
  filters?: ImageFilter[];
  adjustments?: ImageAdjustments;
  mask?: MaskData;
}

interface TextElement extends ElementData {
  content: string;
  font: FontSpec;
  color: Color;
  alignment: TextAlignment;
  lineHeight?: number;
  letterSpacing?: number;
  effects?: TextEffect[];
}

interface ShapeElement extends ElementData {
  shapeType: ShapeType;
  fill: Fill;
  stroke?: Stroke;
  points?: Point[];         // For polygons/paths
}
```

### Position and Transform Data

```typescript
interface Position {
  x: number;                // mm from left
  y: number;                // mm from top
  anchorX?: number;         // 0-1 (0.5 = center)
  anchorY?: number;         // 0-1 (0.5 = center)
}

interface Size {
  width: number;            // mm
  height: number;           // mm
  maintainAspectRatio?: boolean;
}

interface Transform {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  skewX?: number;
  skewY?: number;
}
```

## Asset Formats

### Image Asset Schema

```typescript
interface ImageAsset {
  id: string;
  filename: string;
  path: string;             // Relative path in project
  originalPath?: string;    // Original system path
  format: ImageFormat;
  dimensions: {
    width: number;          // pixels
    height: number;         // pixels
  };
  fileSize: number;         // bytes
  colorSpace: "sRGB" | "Adobe RGB" | "ProPhoto" | "CMYK";
  metadata: ImageMetadata;
  thumbnail?: string;       // Base64 or path
  checksum: string;         // SHA-256
}

interface ImageMetadata {
  exif?: ExifData;
  iptc?: IPTCData;
  xmp?: XMPData;
  created?: ISO8601String;
  modified?: ISO8601String;
  camera?: CameraInfo;
  location?: GeoLocation;
}

type ImageFormat = "jpeg" | "png" | "tiff" | "heic" | "webp" | "raw";
```

### Font Asset Schema

```typescript
interface FontAsset {
  id: string;
  family: string;
  style: "normal" | "italic";
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  source: "system" | "google" | "custom";
  path?: string;            // For custom fonts
  subset?: string[];        // Character subsets
  license?: string;
}
```

## Template Format

### Template Schema

```typescript
interface Template {
  id: string;
  version: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  type: ProjectType;
  thumbnail: string;
  author?: string;
  license?: string;
  tags: string[];
  structure: TemplateStructure;
  assets: TemplateAssets;
}

interface TemplateStructure {
  pages: TemplatePage[];
  masterPages?: MasterPage[];
  styles: StyleDefinitions;
  variables: TemplateVariable[];
}

interface TemplatePage {
  id: string;
  name: string;
  type: "cover" | "content" | "back";
  layout: LayoutDefinition;
  placeholders: Placeholder[];
}

interface Placeholder {
  id: string;
  type: "image" | "text" | "shape";
  position: Position;
  size: Size;
  constraints?: PlaceholderConstraints;
  defaultContent?: any;
  userEditable: boolean;
}
```

## Export Formats

### Print-Ready PDF Specification

```typescript
interface PDFExportSettings {
  standard: "PDF/X-1a" | "PDF/X-4" | "PDF/A";
  colorSpace: "CMYK" | "RGB";
  resolution: number;        // DPI (typically 300)
  compression: {
    images: "jpeg" | "jpeg2000" | "zip" | "none";
    quality: number;        // 0-100
  };
  marks: {
    crop: boolean;
    bleed: boolean;
    registration: boolean;
    color: boolean;
  };
  bleed: {
    top: number;           // mm
    bottom: number;        // mm
    left: number;          // mm
    right: number;         // mm
  };
  metadata: PDFMetadata;
}

interface PDFMetadata {
  title: string;
  author: string;
  subject?: string;
  keywords?: string[];
  creator: string;         // "Design Studio Pro v1.0.0"
  producer: string;        // PDF library info
  creationDate: Date;
  modificationDate: Date;
}
```

### Digital Export Formats

```typescript
interface DigitalExportSettings {
  format: "jpeg" | "png" | "webp";
  resolution: number;       // DPI (typically 72-150 for web)
  quality?: number;         // 0-100 (for JPEG/WebP)
  colorSpace: "sRGB" | "Display P3";
  sizing: {
    mode: "fixed" | "max" | "percentage";
    width?: number;
    height?: number;
    scale?: number;        // For percentage mode
  };
  pages: "all" | "current" | number[];
}
```

## Color Schemes

### Color Scheme Schema

```typescript
interface ColorScheme {
  id: string;
  name: string;
  description?: string;
  category: SchemeCategory;
  productTypes: ProjectType[];         // Which product types this scheme suits
  colors: SchemeColors;
  thumbnail?: string;                  // Base64 preview swatch strip
  author?: string;                     // "built-in" or user name
  tags: string[];
  builtIn: boolean;
  derivedFrom?: string;                // Parent scheme id if customized
}

type SchemeCategory =
  | "seasonal"
  | "occasion"
  | "style"
  | "custom";

interface SchemeColors {
  primary: Color;                      // Dominant backgrounds / hero areas
  secondary: Color;                    // Alternate backgrounds / dividers
  accent: Color;                       // Highlights, decorative elements
  textPrimary: Color;                  // Headings, body text
  textSecondary: Color;                // Captions, metadata
  border: Color;                       // Rules, borders, frames
}
```

### Scheme Application Record

Tracks which scheme is applied to a project and any per-element overrides.

```typescript
interface SchemeApplication {
  schemeId: string;
  appliedAt: ISO8601String;
  scope: "all" | number[];             // All pages or specific page indices
  overrides: SchemeOverride[];         // User customizations on top of scheme
  previousSchemeId?: string;           // For revert support
}

interface SchemeOverride {
  elementId: string;
  pageId: string;
  colorRole: keyof SchemeColors;       // Which scheme color was overridden
  originalValue: Color;                // Value from the scheme
  overriddenValue: Color;              // User-chosen value
}
```

### Scheme Import/Export Format

```typescript
interface SchemeExport {
  version: "1.0";
  schemes: ColorScheme[];
}
```

## Color Management

### Color Profile Schema

```typescript
interface ColorProfile {
  name: string;
  type: "RGB" | "CMYK";
  iccProfile?: string;      // Base64 encoded ICC profile
  renderingIntent: RenderingIntent;
  blackPointCompensation: boolean;
}

type RenderingIntent = 
  | "perceptual"           // Best for photos
  | "relative"            // Maintains color relationships
  | "saturation"          // Vivid colors
  | "absolute";           // Exact color matching

interface Color {
  space: "rgb" | "cmyk" | "lab" | "hex";
  values: number[];        // Depends on space
  alpha?: number;          // 0-1
  name?: string;          // User-defined name
  spotColor?: SpotColorInfo;
}

interface SpotColorInfo {
  name: string;            // e.g., "Pantone 185 C"
  library: string;         // e.g., "Pantone+"
  cmykFallback: number[];  // CMYK approximation
}
```

## Interchange Formats

### JSON Export/Import

For interoperability with other tools:

```typescript
interface InterchangeFormat {
  version: "1.0";
  generator: {
    name: string;
    version: string;
  };
  project: {
    type: ProjectType;
    dimensions: Dimensions;
    pages: SimplifiedPage[];
  };
}
```

### SVG Export

For vector elements:

```xml
<svg xmlns="http://www.w3.org/2000/svg" 
     width="210mm" height="297mm"
     viewBox="0 0 210 297">
  <defs>
    <!-- Reusable elements -->
  </defs>
  <g id="page-1">
    <!-- Page content -->
  </g>
</svg>
```

## File Size Optimization

### Compression Strategies

```typescript
interface CompressionSettings {
  images: {
    format: "jpeg" | "webp";
    quality: number;
    maxDimension?: number;
    generateProxies: boolean;
  };
  projectFile: {
    compressionLevel: number; // 0-9
    excludeThumbnails?: boolean;
    excludeHistory?: boolean;
  };
}
```

### Proxy Generation

```typescript
interface ProxySettings {
  thumbnail: {
    size: 150;            // pixels
    quality: 70;
    format: "jpeg";
  };
  preview: {
    size: 800;            // pixels
    quality: 85;
    format: "jpeg";
  };
  editing: {
    maxSize: 2048;        // pixels
    quality: 90;
    format: "jpeg";
  };
}
```

## Validation Rules

### Project Validation

```typescript
interface ValidationRules {
  images: {
    minResolution: 150;    // DPI
    recommendedResolution: 300;
    maxFileSize?: number;  // MB
    supportedFormats: string[];
  };
  text: {
    minFontSize: 6;       // points
    maxFontSize: 300;     // points
  };
  bleed: {
    minimum: 3;           // mm
    recommended: 5;       // mm
  };
  pages: {
    minimum: 20;          // For books
    maximum: 200;         // For books
  };
}
```

## Migration and Compatibility

### Version Migration

```typescript
interface MigrationPath {
  fromVersion: string;
  toVersion: string;
  migrations: Migration[];
}

interface Migration {
  type: "schema" | "data" | "assets";
  description: string;
  transform: (data: any) => any;
  rollback?: (data: any) => any;
}
```