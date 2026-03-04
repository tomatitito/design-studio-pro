# Print Requirements Specification

## Overview

This document defines the technical requirements for generating print-ready files that meet professional printing standards. All output must comply with industry standards to ensure consistent, high-quality results across different print service providers.

## Color Management

### Color Spaces

#### Working Color Space
- **Design/Edit Mode**: sRGB or Adobe RGB (1998)
- **Export/Print Mode**: CMYK (various profiles)
- **Soft Proofing**: Simulate CMYK on screen

#### CMYK Profiles
Standard profiles to support:
- **ISO Coated v2 300% (ECI)** - European standard
- **FOGRA39** - Offset printing standard
- **GRACoL2006_Coated1v2** - North American standard
- **Japan Color 2001 Coated** - Japanese standard
- **SWOP2006_Coated3v2** - Web offset printing

#### Color Conversion

```rust
// Color conversion pipeline
RGB Input → Working Space → CMYK Output
         ↓                ↓
    (Perceptual)    (Relative Colorimetric)
```

### ICC Profile Management

#### Profile Embedding
- All exported PDFs must include ICC profiles
- Images converted to destination profile
- Profile mismatch warnings for users

#### Rendering Intents
1. **Perceptual** (default for photos)
   - Preserves visual relationships between colors
   - Best for photographic images
   
2. **Relative Colorimetric** (for graphics)
   - Maintains color accuracy where possible
   - Good for logos and spot colors

3. **Saturation** (for business graphics)
   - Maximizes color vividness
   - Charts and presentations

### Ink Coverage

#### Total Ink Limit
- **Maximum**: 300% (default)
- **Recommended**: 280% for coated paper
- **Newspaper**: 240% maximum

#### Black Generation
- **UCR** (Under Color Removal): For general use
- **GCR** (Gray Component Replacement): For stability
- **Maximum Black**: 95% (not 100% to avoid registration issues)

## Resolution Requirements

### Image Resolution

| Content Type | Minimum DPI | Recommended DPI | Maximum DPI |
|-------------|-------------|-----------------|-------------|
| Photos | 150 | 300 | 600 |
| Line Art | 600 | 1200 | 2400 |
| Text as Image | 300 | 600 | 1200 |
| Large Format | 100 | 150 | 300 |

### Resolution Validation

```typescript
interface ResolutionCheck {
  imagePixels: { width: number; height: number };
  printSize: { width: number; height: number }; // in mm
  
  calculateDPI(): number;
  validateForPrint(): ValidationResult;
  suggestUpsampling(): UpsamplingMethod | null;
}
```

### Upsampling Policy
- **Allowed**: Up to 150% of original
- **Method**: Lanczos or Bicubic
- **Warning**: Above 150% scaling

## PDF Standards

### PDF/X Compliance

For detailed implementation of PDF/X standards, see [PDF/X Implementation Specification](./pdfx-implementation.md).

**Library**: We use [krilla](https://github.com/LaurenzV/krilla) as the foundation for PDF generation, with a custom PDF/X compliance layer built on top.

#### PDF/X-1a:2001
- **Use Case**: Traditional CMYK print workflows
- **Features**:
  - CMYK + Spot colors only
  - No transparency (flattening required)
  - All fonts embedded
  - No RGB elements
  - OutputIntent with embedded ICC profile

#### PDF/X-4:2010
- **Use Case**: Modern color-managed workflows
- **Features**:
  - CMYK + RGB with ICC profiles
  - Live transparency supported
  - Layers supported (Optional Content Groups)
  - OpenType fonts
  - PDF 1.6 base

### PDF Structure Requirements

```typescript
interface PDFRequirements {
  version: "1.3" | "1.4" | "1.6" | "1.7";
  compatibility: "PDF/X-1a" | "PDF/X-4";
  
  structure: {
    trimBox: Rectangle;      // Final size
    bleedBox: Rectangle;     // With bleed
    mediaBox: Rectangle;     // Full page
    cropBox?: Rectangle;     // Display area
  };
  
  metadata: {
    title: string;
    trapped: "True" | "False" | "Unknown";
    GTS_PDFXVersion: string;
    OutputIntent: OutputIntent;
  };
}
```

## Bleed and Trim

### Bleed Specifications

```typescript
interface BleedSettings {
  standard: 3;              // mm - default
  minimum: 2;              // mm - absolute minimum
  maximum: 5;              // mm - safety margin
  
  sides: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    spine?: number;        // For books (usually 0)
  };
}
```

### Safe Area Guidelines
- **Text Safety**: 5mm from trim edge
- **Critical Elements**: 8mm from trim edge
- **Fold Lines**: 3mm clearance

### Marks and Indicators

#### Printer Marks
- **Crop Marks**: 3mm length, 3mm offset
- **Bleed Marks**: At bleed boundary
- **Registration Marks**: For color alignment
- **Color Bars**: CMYK + Registration
- **Page Information**: Optional

## Font Requirements

### Font Embedding

#### Embedding Rules
- **Required**: All fonts must be embedded
- **Subset**: Embed only used characters
- **Licensing**: Verify embedding permissions

#### Supported Font Formats
- TrueType (.ttf)
- OpenType (.otf)
- PostScript Type 1 (legacy)
- WOFF/WOFF2 (web fonts - convert first)

### Font Specifications

```typescript
interface FontRequirements {
  minimumSize: 6;          // points
  maximumSize: null;       // no limit
  
  textToOutlines: {
    threshold: 4;          // Convert if < 4pt
    special: true;         // Special characters
    artistic: true;        // Decorative text
  };
  
  validation: {
    checkEmbedding: true;
    checkLicense: true;
    checkSubset: true;
    fallbackFont: "Arial";
  };
}
```

## Image Handling

### Compression Settings

```typescript
interface ImageCompression {
  jpeg: {
    quality: 85;           // 0-100
    sampling: "4:4:4";     // No subsampling for print
    progressive: false;    // Not for print
  };
  
  tiff: {
    compression: "LZW" | "ZIP" | "None";
    predictor: true;       // For better compression
  };
  
  png: {
    interlaced: false;     // Not for print
    compression: 9;        // Maximum
  };
}
```

### Image Processing Pipeline

```
Original → Color Convert → Resize → Sharpen → Compress → Embed
        ↓              ↓         ↓          ↓          ↓
   (Profile)      (Bicubic)  (Unsharp)  (Quality)  (PDF Stream)
```

## Special Print Products

### Photo Books

#### Binding Considerations
- **Perfect Binding**: 6mm spine minimum
- **Lay-Flat**: Special center margins
- **Spiral**: 15mm left margin

#### Page Specifications
```typescript
interface BookSpecs {
  pages: {
    minimum: 20;
    maximum: 200;
    increment: 2;          // Always even
  };
  
  paperTypes: {
    matte: { weight: 170, finish: "matte" },
    glossy: { weight: 200, finish: "glossy" },
    silk: { weight: 170, finish: "silk" }
  };
}
```

### Calendars

#### Special Requirements
- Wire binding area: 10mm clearance
- Hole punch zone: 8mm from edge
- Hanging mechanism clearance

### Cards

#### Folding Specifications
- Score lines: As vector paths
- Fold indicators: In separate layer
- Grain direction: Consider for thick paper

### Photo Sheets

#### Single-Page Print Specifications
- Standard paper sizes: A4, A3, Letter, Square
- Full-bleed option: 3mm bleed on all sides
- Grid gutter handling: Maintain consistent spacing in print
- Resolution: 300 DPI for all photo slots
- Color management: Same CMYK pipeline as other products

## Quality Assurance

### Preflight Checks

```typescript
interface PreflightChecklist {
  resolution: CheckItem[];
  colorSpace: CheckItem[];
  fonts: CheckItem[];
  bleeds: CheckItem[];
  inkCoverage: CheckItem[];
  transparency: CheckItem[];
  overprint: CheckItem[];
  thinLines: CheckItem[];
}

interface CheckItem {
  name: string;
  status: "pass" | "warning" | "fail";
  message: string;
  autoFix?: () => void;
}
```

### Common Issues and Fixes

| Issue | Detection | Auto-Fix | Manual Fix |
|-------|-----------|----------|------------|
| Low resolution | < 150 DPI | Upsample if < 150% | Replace image |
| RGB colors | Color space check | Convert to CMYK | Review appearance |
| Missing fonts | Embedding check | Embed or outline | Install font |
| No bleed | Edge detection | Extend background | Redesign layout |
| Over-ink | > 300% coverage | Reduce CMY in blacks | Adjust colors |

## Export Validation

### Final Checks

```typescript
class PrintValidator {
  validateDocument(doc: Document): ValidationReport {
    return {
      errors: this.findErrors(doc),
      warnings: this.findWarnings(doc),
      info: this.gatherInfo(doc),
      canPrint: this.errors.length === 0,
      score: this.calculateQualityScore(doc)
    };
  }
  
  findErrors(doc: Document): ValidationError[] {
    // Critical issues that prevent printing
  }
  
  findWarnings(doc: Document): ValidationWarning[] {
    // Issues that may affect quality
  }
}
```

## Print Service Integration

### Service Profiles

```typescript
interface PrintServiceProfile {
  name: string;
  requirements: {
    pdfVersion: string;
    colorProfile: string;
    resolution: number;
    bleed: BleedSettings;
    maxFileSize: number;  // MB
  };
  
  api?: {
    endpoint: string;
    authentication: AuthMethod;
    uploadMethod: "direct" | "chunked";
  };
  
  validation: {
    endpoint?: string;
    realtime: boolean;
  };
}
```

### Common Service Requirements

| Service | PDF Version | Color Space | Bleed | Special |
|---------|-------------|-------------|-------|---------|
| Saal Digital | PDF/X-4 | FOGRA39 | 3mm | Page pairs for books |
| Blurb | PDF/X-1a | US Web Coated | 3mm | Specific page sizes |
| Shutterfly | PDF 1.4+ | sRGB or CMYK | 2mm | Template-based |
| Local Print | PDF/X-1a | ISO Coated v2 | 3mm | Standard sizes |

## Testing Requirements

### Test Outputs

1. **Color Charts**: CMYK test patterns
2. **Resolution Tests**: Various DPI samples
3. **Font Tests**: All weights and sizes
4. **Bleed Tests**: Edge alignment verification
5. **Soft Proof**: Screen vs print comparison

### Certification

- Generate test files for each standard
- Validate with industry tools (Adobe Acrobat, PitStop)
- Test with multiple print services
- Document compliance per service