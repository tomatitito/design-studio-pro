# Phase 3: Advanced Features (Months 5-6)

## Month 5: Print Preparation

### Week 17-18: Color Management

- [ ] Implement color conversion
  - [ ] RGB to CMYK
  - [ ] CMYK to RGB
- [ ] Add ICC profile support
  - [ ] Profile loading
  - [ ] Profile management UI
- [ ] Create soft proofing
- [ ] Build color tools
  - [ ] Color picker
  - [ ] Eyedropper
  - [ ] Color palettes
- [ ] Add gamut checking
- [ ] Implement ink coverage calculation
- [ ] Create color harmony generator

### Week 19-20: PDF Generation & Print Services

- [ ] Implement PDF export foundation (krilla)
  - [ ] Basic PDF generation pipeline
  - [ ] Page layout and content rendering
  - [ ] Image embedding with compression
- [ ] Implement PDF/X compliance layer
  - [ ] OutputIntent dictionary generation
  - [ ] XMP metadata for PDF/X standards
  - [ ] TrimBox/BleedBox/MediaBox setup
- [ ] Add PDF/X-1a:2001 compliance
  - [ ] CMYK-only color validation
  - [ ] Transparency flattening engine
  - [ ] RGB to CMYK auto-conversion
  - [ ] Spot color support
- [ ] Add PDF/X-4:2010 compliance
  - [ ] ICC profile embedding
  - [ ] Live transparency support
  - [ ] RGB with ICC profile support
  - [ ] OpenType font embedding
- [ ] ICC Profile management
  - [ ] Bundle standard ICC profiles (ECI, FOGRA, GRACoL)
  - [ ] Profile loading and parsing
  - [ ] Custom profile import
  - [ ] Profile selection UI
- [ ] Generate print marks
  - [ ] Crop marks
  - [ ] Bleed marks
  - [ ] Registration marks
  - [ ] Color bars
- [ ] Implement 300 DPI output
- [ ] Add font embedding (full subset)
- [ ] Create compression options
- [ ] Build export progress tracking
- [ ] Implement preflight checks
  - [ ] Color space validation
  - [ ] Resolution checking
  - [ ] Font embedding verification
  - [ ] Bleed area validation
  - [ ] Ink coverage calculation
  - [ ] Auto-fix suggestions
- [ ] Print service integration
  - [ ] Service API abstraction layer
  - [ ] Price calculation API
  - [ ] Order submission workflow
  - [ ] Order tracking system
  - [ ] Service-specific validation rules

## Month 6: Product Types

### Week 21-22: Photo Books

- [ ] Create book specifications
  - [ ] Size options
  - [ ] Binding types
  - [ ] Page count management
- [ ] Implement spine management
- [ ] Add page spreads
- [ ] Build cover designer
- [ ] Create book templates
- [ ] Add page insertion/deletion
- [ ] Implement 3D preview

### Week 23-24: Calendars, Cards & Photo Sheets

- [ ] Generate calendar grids
- [ ] Implement date management
- [ ] Add holiday integration
- [ ] Create custom events
- [ ] Build card templates
  - [ ] Folded cards
  - [ ] Postcards
  - [ ] Invitations
- [ ] Add envelope templates
- [ ] Create bulk personalization
- [ ] Build photo sheet layouts
  - [ ] Grid layouts (2x2, 3x3, 4x4)
  - [ ] Collage / freeform arrangement
  - [ ] Contact sheet (thumbnail grid)
  - [ ] Mixed-size slots
- [ ] Photo sheet auto-fill from selection
- [ ] Configurable spacing/gutters
- [ ] Optional per-photo captions

## Phase 3 Validation Checkpoints

- [ ] RGB to CMYK conversion accuracy +/-2%
- [ ] PDF/X-1a compliance verified
- [ ] 300 DPI output confirmed
- [ ] All product types export correctly
- [ ] Preflight catches common issues
