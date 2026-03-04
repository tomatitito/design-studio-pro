# PDF/X Implementation Specification

## Overview

This document defines the technical approach for implementing PDF/X-1a and PDF/X-4 compliance in Design Studio Pro. Since no existing Rust library provides complete PDF/X support, we will build PDF/X compliance on top of the krilla library.

## Background

### Why Not printpdf?

The `printpdf` crate only supports PDF/X-3:2002, which is insufficient for professional print workflows that require:
- **PDF/X-1a**: Industry standard for CMYK-only workflows
- **PDF/X-4**: Modern standard supporting transparency and RGB with ICC profiles

### Chosen Approach: Krilla + PDF/X Extension

We will use [krilla](https://github.com/LaurenzV/krilla) as our PDF generation foundation because:
- Active development (used by Typst project)
- Native CMYK ICC profile support
- High-level graphics API
- Pure Rust implementation
- PDF/A support (similar compliance structure to PDF/X)

## PDF/X Standards Overview

### PDF/X-1a:2001 (ISO 15930-1)

Target use case: Traditional CMYK print workflows

| Requirement | Implementation |
|-------------|----------------|
| PDF Version | 1.3 |
| Color Spaces | CMYK, Grayscale, Spot colors only |
| Transparency | Not allowed (must be flattened) |
| Fonts | All fonts fully embedded |
| ICC Profile | Embedded in OutputIntent |
| Images | Must be CMYK or Grayscale |
| Annotations | Limited types allowed |

### PDF/X-4:2010 (ISO 15930-7)

Target use case: Modern color-managed workflows

| Requirement | Implementation |
|-------------|----------------|
| PDF Version | 1.6 |
| Color Spaces | CMYK, RGB, Lab with ICC profiles |
| Transparency | Allowed (live transparency) |
| Fonts | All fonts embedded (OpenType supported) |
| ICC Profile | Must be embedded (not referenced) |
| Images | Any color space with ICC profile |
| Layers | Supported (Optional Content Groups) |

## Architecture

### Module Structure

```
src-tauri/src/
├── core/
│   └── pdf/
│       ├── mod.rs
│       ├── generator.rs        # Main PDF generation logic
│       ├── pdfx/
│       │   ├── mod.rs
│       │   ├── common.rs       # Shared PDF/X utilities
│       │   ├── x1a.rs          # PDF/X-1a specific compliance
│       │   ├── x4.rs           # PDF/X-4 specific compliance
│       │   └── validator.rs    # Compliance validation
│       ├── color/
│       │   ├── mod.rs
│       │   ├── conversion.rs   # RGB to CMYK conversion
│       │   ├── icc.rs          # ICC profile management
│       │   └── gamut.rs        # Gamut mapping
│       ├── transparency/
│       │   ├── mod.rs
│       │   └── flattener.rs    # Transparency flattening for X-1a
│       └── metadata/
│           ├── mod.rs
│           ├── xmp.rs          # XMP metadata generation
│           └── output_intent.rs # OutputIntent dictionary
```

### Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                    PDF Export API                        │
│              (export_to_pdf command)                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   PDF Generator                          │
│         (orchestrates the PDF creation)                  │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌───────────┐ ┌──────────────────┐
│  PDF/X Module   │ │   Color   │ │    Metadata      │
│  (X-1a / X-4)   │ │ Conversion│ │   (XMP, Intent)  │
└─────────────────┘ └───────────┘ └──────────────────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│                      Krilla                              │
│            (Low-level PDF generation)                    │
└─────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. OutputIntent Dictionary

Both PDF/X-1a and PDF/X-4 require an OutputIntent entry in the document catalog.

```rust
/// OutputIntent configuration for PDF/X compliance
pub struct OutputIntent {
    /// Subtype: GTS_PDFX for PDF/X standards
    pub subtype: String,
    /// Human-readable condition name
    pub output_condition: String,
    /// Registry identifier (www.color.org for ICC profiles)
    pub registry_name: String,
    /// Condition identifier from registry
    pub output_condition_identifier: String,
    /// Embedded ICC profile data
    pub dest_output_profile: Vec<u8>,
}

impl OutputIntent {
    /// Create OutputIntent for ISO Coated v2 (European standard)
    pub fn iso_coated_v2() -> Self {
        Self {
            subtype: "GTS_PDFX".into(),
            output_condition: "ISO Coated v2 300% (ECI)".into(),
            registry_name: "http://www.color.org".into(),
            output_condition_identifier: "FOGRA39".into(),
            dest_output_profile: include_bytes!("profiles/ISOcoated_v2_300_eci.icc").to_vec(),
        }
    }

    /// Create OutputIntent for GRACoL (North American standard)
    pub fn gracol_2006() -> Self {
        Self {
            subtype: "GTS_PDFX".into(),
            output_condition: "GRACoL2006_Coated1v2".into(),
            registry_name: "http://www.color.org".into(),
            output_condition_identifier: "CGATS TR 006".into(),
            dest_output_profile: include_bytes!("profiles/GRACoL2006_Coated1v2.icc").to_vec(),
        }
    }
}
```

### 2. XMP Metadata

PDF/X requires specific XMP metadata packets.

```rust
/// Generate PDF/X-compliant XMP metadata
pub fn generate_pdfx_xmp(config: &PdfXConfig) -> String {
    let pdfx_version = match config.standard {
        PdfXStandard::X1a2001 => "PDF/X-1a:2001",
        PdfXStandard::X4_2010 => "PDF/X-4:2010",
    };

    format!(r#"<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfx="http://ns.adobe.com/pdfx/1.3/"
        xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <pdfx:GTS_PDFXVersion>{pdfx_version}</pdfx:GTS_PDFXVersion>
      <pdfx:GTS_PDFXConformance>{}</pdfx:GTS_PDFXConformance>
      <pdfxid:GTS_PDFXVersion>{pdfx_version}</pdfxid:GTS_PDFXVersion>
      <dc:title>{}</dc:title>
      <xmp:CreatorTool>Design Studio Pro</xmp:CreatorTool>
      <xmp:CreateDate>{}</xmp:CreateDate>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"#,
        config.conformance_level(),
        config.title,
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S+00:00")
    )
}
```

### 3. Color Space Validation

```rust
/// Validates document colors for PDF/X-1a compliance
pub struct X1aColorValidator;

impl X1aColorValidator {
    /// Check if all colors are CMYK, Grayscale, or Spot
    pub fn validate(&self, document: &Document) -> Result<(), Vec<ColorViolation>> {
        let mut violations = Vec::new();

        for page in &document.pages {
            for element in &page.elements {
                if let Some(violation) = self.check_element(element) {
                    violations.push(violation);
                }
            }
        }

        if violations.is_empty() {
            Ok(())
        } else {
            Err(violations)
        }
    }

    fn check_element(&self, element: &Element) -> Option<ColorViolation> {
        match &element.fill {
            Fill::Rgb(r, g, b) => Some(ColorViolation {
                element_id: element.id.clone(),
                message: format!("RGB color ({}, {}, {}) not allowed in PDF/X-1a", r, g, b),
                auto_fix: Some(AutoFix::ConvertToCmyk),
            }),
            Fill::Lab(_, _, _) => Some(ColorViolation {
                element_id: element.id.clone(),
                message: "Lab color not allowed in PDF/X-1a".into(),
                auto_fix: Some(AutoFix::ConvertToCmyk),
            }),
            Fill::Cmyk(_, _, _, _) | Fill::Grayscale(_) | Fill::Spot(_) => None,
        }
    }
}
```

### 4. Transparency Flattening (PDF/X-1a)

PDF/X-1a does not support transparency. All transparent elements must be flattened.

```rust
/// Flattens transparency for PDF/X-1a compliance
pub struct TransparencyFlattener {
    /// Resolution for rasterizing complex transparency
    raster_resolution: u32,
    /// Quality setting for flattening
    quality: FlattenerQuality,
}

impl TransparencyFlattener {
    pub fn new(resolution: u32, quality: FlattenerQuality) -> Self {
        Self {
            raster_resolution: resolution,
            quality,
        }
    }

    /// Flatten all transparency in the document
    pub fn flatten(&self, document: &mut Document) -> Result<FlattenReport, FlattenError> {
        let mut report = FlattenReport::default();

        for page in &mut document.pages {
            for element in &mut page.elements {
                if element.has_transparency() {
                    self.flatten_element(element, &mut report)?;
                }
            }
        }

        Ok(report)
    }

    fn flatten_element(&self, element: &mut Element, report: &mut FlattenReport)
        -> Result<(), FlattenError>
    {
        match element.transparency_type() {
            TransparencyType::None => Ok(()),
            TransparencyType::SimpleOpacity => {
                // Blend with background color
                self.blend_opacity(element)?;
                report.simple_flattened += 1;
                Ok(())
            }
            TransparencyType::BlendMode | TransparencyType::Complex => {
                // Rasterize complex transparency
                self.rasterize_element(element)?;
                report.rasterized += 1;
                Ok(())
            }
        }
    }
}
```

### 5. PDF/X Export Configuration

```rust
/// Configuration for PDF/X export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfXExportConfig {
    /// Target PDF/X standard
    pub standard: PdfXStandard,
    /// Output ICC profile
    pub output_profile: OutputProfile,
    /// Document information
    pub title: String,
    /// Bleed settings in mm
    pub bleed: BleedSettings,
    /// Include printer marks
    pub printer_marks: PrinterMarksConfig,
    /// Image compression settings
    pub compression: CompressionSettings,
    /// Font embedding mode
    pub font_embedding: FontEmbeddingMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PdfXStandard {
    /// PDF/X-1a:2001 - CMYK only, no transparency
    X1a2001,
    /// PDF/X-4:2010 - Modern, supports transparency and ICC
    X4_2010,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OutputProfile {
    /// ISO Coated v2 300% (European)
    IsoCoatedV2,
    /// FOGRA39 (European offset)
    Fogra39,
    /// GRACoL 2006 Coated (North American)
    GraCol2006,
    /// Japan Color 2001 Coated
    JapanColor2001,
    /// SWOP 2006 Coated (Web offset)
    Swop2006,
    /// Custom profile from file
    Custom(PathBuf),
}
```

## Validation & Preflight

### Preflight Check System

```rust
/// Comprehensive preflight validation for PDF/X
pub struct PreflightChecker {
    standard: PdfXStandard,
    checks: Vec<Box<dyn PreflightCheck>>,
}

impl PreflightChecker {
    pub fn for_x1a() -> Self {
        Self {
            standard: PdfXStandard::X1a2001,
            checks: vec![
                Box::new(ColorSpaceCheck::cmyk_only()),
                Box::new(TransparencyCheck::none_allowed()),
                Box::new(FontCheck::all_embedded()),
                Box::new(ResolutionCheck::minimum_dpi(300)),
                Box::new(BleedCheck::minimum_mm(3.0)),
                Box::new(TrimBoxCheck::required()),
                Box::new(InkCoverageCheck::maximum_percent(300)),
            ],
        }
    }

    pub fn for_x4() -> Self {
        Self {
            standard: PdfXStandard::X4_2010,
            checks: vec![
                Box::new(ColorSpaceCheck::with_icc()),
                Box::new(FontCheck::all_embedded()),
                Box::new(ResolutionCheck::minimum_dpi(300)),
                Box::new(BleedCheck::minimum_mm(3.0)),
                Box::new(TrimBoxCheck::required()),
                Box::new(InkCoverageCheck::maximum_percent(300)),
                Box::new(IccProfileCheck::embedded_required()),
            ],
        }
    }

    pub fn run(&self, document: &Document) -> PreflightReport {
        let mut report = PreflightReport::new(self.standard.clone());

        for check in &self.checks {
            match check.execute(document) {
                CheckResult::Pass => report.passed.push(check.name().into()),
                CheckResult::Warning(msg) => report.warnings.push(PreflightWarning {
                    check: check.name().into(),
                    message: msg,
                }),
                CheckResult::Error(msg) => report.errors.push(PreflightError {
                    check: check.name().into(),
                    message: msg,
                    auto_fix: check.auto_fix_available(),
                }),
            }
        }

        report
    }
}
```

## ICC Profile Management

### Bundled Profiles

The application will bundle the following ICC profiles:

| Profile | Use Case | License |
|---------|----------|---------|
| ISO Coated v2 300% (ECI) | European offset printing | Free (ECI) |
| FOGRA39 | European standard | Free (FOGRA) |
| GRACoL 2006 Coated | North American offset | Free (IDEAlliance) |
| Japan Color 2001 Coated | Japanese printing | Free (JPMA) |
| SWOP 2006 Coated | Web offset printing | Free (IDEAlliance) |
| sRGB IEC61966-2.1 | RGB working space | Free (ICC) |

### Profile Loading

```rust
/// ICC profile manager
pub struct IccProfileManager {
    profiles: HashMap<String, IccProfile>,
    cache_dir: PathBuf,
}

impl IccProfileManager {
    /// Load bundled profiles
    pub fn load_bundled(&mut self) -> Result<(), ProfileError> {
        self.load_profile("iso_coated_v2", include_bytes!("profiles/ISOcoated_v2_300_eci.icc"))?;
        self.load_profile("fogra39", include_bytes!("profiles/FOGRA39.icc"))?;
        self.load_profile("gracol_2006", include_bytes!("profiles/GRACoL2006_Coated1v2.icc"))?;
        self.load_profile("japan_color_2001", include_bytes!("profiles/JapanColor2001Coated.icc"))?;
        self.load_profile("swop_2006", include_bytes!("profiles/SWOP2006_Coated3v2.icc"))?;
        Ok(())
    }

    /// Load custom profile from file
    pub fn load_custom(&mut self, path: &Path) -> Result<String, ProfileError> {
        let data = std::fs::read(path)?;
        let profile = IccProfile::parse(&data)?;
        let id = profile.id().to_string();
        self.profiles.insert(id.clone(), profile);
        Ok(id)
    }
}
```

## Testing Strategy

### Compliance Testing

1. **Adobe Acrobat Preflight**: Validate generated PDFs against Adobe's preflight profiles
2. **veraPDF**: Open-source PDF/A validator (shares validation logic with PDF/X)
3. **pdfaPilot**: Professional preflight tool for production validation

### Test Cases

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_x1a_rejects_rgb_colors() {
        let doc = create_document_with_rgb();
        let validator = X1aColorValidator;
        assert!(validator.validate(&doc).is_err());
    }

    #[test]
    fn test_x1a_rejects_transparency() {
        let doc = create_document_with_transparency();
        let checker = PreflightChecker::for_x1a();
        let report = checker.run(&doc);
        assert!(report.has_errors());
    }

    #[test]
    fn test_x4_allows_transparency() {
        let doc = create_document_with_transparency();
        let checker = PreflightChecker::for_x4();
        let report = checker.run(&doc);
        assert!(!report.has_errors());
    }

    #[test]
    fn test_output_intent_valid() {
        let intent = OutputIntent::iso_coated_v2();
        assert_eq!(intent.registry_name, "http://www.color.org");
    }
}
```

## Future Considerations

### Potential Contributions to Krilla

The PDF/X compliance layer could potentially be contributed upstream to the krilla project, similar to how PDF/A support was added. This would benefit the broader Rust ecosystem.

### Additional Standards

Future versions may support:
- **PDF/X-5**: External graphics references
- **PDF/X-6**: Based on PDF 2.0
- **GWG specifications**: Ghent Workgroup prepress extensions

## References

- [ISO 15930-1:2001 (PDF/X-1a)](https://www.iso.org/standard/29061.html)
- [ISO 15930-7:2008 (PDF/X-4)](https://www.iso.org/standard/42876.html)
- [PDF Association - PDF/X Technical Requirements](https://pdfa.org/technical-side-and-requirements-of-pdfx/)
- [krilla GitHub Repository](https://github.com/LaurenzV/krilla)
- [ICC Profile Registry](https://www.color.org/registry/)
- [ECI ICC Profiles](https://www.eci.org/en/downloads)
