# Features Specification

## Core Features Overview

### 1. Product Types

#### Photo Books
- **Formats**
  - Square (20x20cm, 30x30cm)
  - Landscape (A4, A3)
  - Portrait (A4, A5)
  - Custom dimensions

- **Binding Options**
  - Hardcover with dust jacket
  - Hardcover with printed cover
  - Softcover
  - Lay-flat binding
  - Spiral binding

- **Page Counts**
  - Minimum: 20 pages
  - Maximum: 200 pages
  - Add/remove pages dynamically

#### Calendars
- **Types**
  - Wall calendars (A3, A4)
  - Desk calendars
  - Year planners
  - Photo calendars (12 months + cover)

- **Customization**
  - Start month selection
  - Holiday integration
  - Custom events/birthdays
  - Week start (Monday/Sunday)

#### Greeting Cards
- **Formats**
  - Folded cards (A5, A6)
  - Postcards (10x15cm, A6)
  - Invitations
  - Thank you cards
  - Holiday cards

- **Features**
  - Inside message editing
  - Envelope templates
  - Bulk personalization

#### Photo Sheets
- **Formats**
  - A4 (210x297mm)
  - A3 (297x420mm)
  - Letter (8.5x11in)
  - Square (30x30cm)
  - Custom dimensions

- **Layout Options**
  - Single photo (full bleed)
  - Grid layout (2x2, 3x3, 4x4)
  - Collage (freeform arrangement)
  - Contact sheet (thumbnail grid)
  - Mixed sizes (customizable slots)

- **Features**
  - Drag-and-drop photo placement
  - Auto-fill from selection
  - Configurable spacing/gutters
  - Optional captions per photo
  - Background color or image

## 2. Design Tools

### Canvas Editor

#### Object Manipulation
- **Basic Operations**
  - Drag and drop positioning
  - Resize with aspect ratio lock
  - Rotate (free and 90° snaps)
  - Flip horizontal/vertical
  - Duplicate objects
  - Delete with confirmation

- **Advanced Controls**
  - Multi-select operations
  - Group/ungroup objects
  - Lock/unlock elements
  - Show/hide elements
  - Bring forward/send backward
  - Align and distribute tools

#### Grid and Guides
- **Smart Guides**
  - Object alignment guides
  - Equal spacing indicators
  - Center markers
  - Margin guides

- **Grid System**
  - Configurable grid size
  - Snap to grid toggle
  - Grid visibility toggle

### Image Handling

#### Import Options
- Drag and drop from desktop
- File browser import
- Batch import
- Folder watching
- Support formats: JPEG, PNG, TIFF, HEIC, RAW

#### Image Editing
- **Basic Adjustments**
  - Brightness/Contrast
  - Saturation/Vibrance
  - Temperature/Tint
  - Highlights/Shadows
  - Exposure

- **Filters**
  - Black & White
  - Sepia
  - Vintage effects
  - Custom filter presets

- **Cropping**
  - Freeform crop
  - Aspect ratio presets
  - Rule of thirds overlay
  - Smart crop suggestions

- **Clipping Masks**
  - Circle / ellipse clip — crop image into a circular or oval shape
  - Rounded rectangle clip — adjustable corner radius
  - The clipped shape is non-destructive; users can reposition the image within the mask
  - Double-click a masked image to re-pan/re-zoom within the mask

#### Freeform Image Placement

In addition to template-driven layouts, users can drag and drop images directly onto any page for fully custom placement.

- **Drop Behavior**
  - Drag an image from the Photos panel (or from the desktop) onto a page
  - Image is placed at the drop position at a sensible default size (fitted within the page with padding)
  - Smart guides appear during drag to help align with existing elements
  - If dropped onto an existing image slot in a template, it replaces that slot's content

- **Resize and Crop Controls**
  - Corner and edge handles for freeform resizing
  - Hold Shift to maintain aspect ratio while resizing
  - Double-click image to enter crop mode: drag to pan, scroll to zoom within the frame
  - Crop handle overlay to adjust visible area without moving the outer frame

- **Clipping Shape**
  - Default: rectangle (standard image bounding box)
  - Switch to circle or ellipse via the right-click context menu or the Properties Inspector
  - Switch to rounded rectangle with adjustable corner radius
  - The clipping shape acts as a non-destructive mask — the full image is preserved

- **Frame Application**
  - After placing an image, select a frame from the Frames panel or Properties Inspector
  - Frame wraps around the image's clipping shape
  - Frame can be changed or removed at any time without affecting the image

#### Image Organization
- **Asset Library**
  - Thumbnail view
  - List view
  - Search by name
  - Sort by date/name/size
  - Favorites marking
  - Recent items

### Text Tools

#### Typography
- **Font Management**
  - System fonts
  - Google Fonts integration
  - Custom font upload
  - Font preview

- **Text Formatting**
  - Size adjustment
  - Bold/Italic/Underline
  - Text color
  - Character spacing
  - Line height
  - Paragraph alignment

#### Text Effects
- Drop shadow
- Outline
- Gradient fill
- Text on path
- Text wrapping around objects

### Shapes and Graphics

#### Basic Shapes
- Rectangle/Square
- Circle/Ellipse
- Triangle
- Polygon tool
- Line/Arrow
- Star/Heart

#### Shape Styling
- Fill color/gradient
- Border width/color
- Opacity
- Shadow effects
- Corner radius

## 3. Template System

### Template Library

#### Categories
- **By Product**: Books, calendars, cards, photo sheets
- **By Theme**: Wedding, birthday, travel, baby
- **By Style**: Modern, classic, minimalist, playful
- **By Layout**: Grid, collage, single photo, mixed

#### Template Features
- Preview before applying
- Editable template elements
- Save custom templates
- Import/export templates
- Template versioning

### Smart Layouts

#### Auto-Layout Engine
- Analyze photos for optimal placement
- Face detection for better cropping
- Color harmony suggestions
- Automatic spacing adjustment

#### Layout Presets
- Single photo layouts
- Multi-photo collages
- Text and photo combinations
- Full-bleed designs

## 4. Background and Decoration

### Backgrounds
- **Types**
  - Solid colors
  - Gradients (linear, radial, conic)
  - Multi-stop gradients (3+ color stops with configurable positions)
  - Patterns
  - Images
  - Transparent

- **Gradient Editor**
  - Visual gradient bar with draggable color stops
  - Add/remove color stops by clicking on the gradient bar
  - Adjustable angle (linear) or center position (radial/conic)
  - Opacity per color stop
  - Preset gradient library (matching gradient color schemes)
  - Copy/paste gradients between pages

### Decorative Elements
- **Clipart Library**
  - Categories: Nature, celebrations, seasons
  - Vector graphics
  - Search functionality

- **Photo Frames**
  - **Simple Frames**
    - Thin line — solid 1–4px border in any color
    - Thick border — solid 8–30px colored border (classic photo-print look)
    - Double line — two concentric borders with configurable gap
    - Shadow frame — no visible border, but a drop-shadow creates a floating effect
  - **Decorative Frames**
    - Polaroid — white bottom-heavy border resembling an instant photo
    - Vintage ornate — scrollwork / filigree corner decorations
    - Filmstrip — sprocket-hole borders on top and bottom
    - Scrapbook tape — simulated washi-tape corners
    - Stamp — perforated edge resembling a postage stamp
    - Torn edge — irregular hand-torn paper effect
  - **Frame Controls**
    - Color picker for frame color (solid or gradient fill)
    - Width / thickness slider
    - Corner style (square, rounded, clipped)
    - Inner padding between frame edge and image
    - Apply frame to single image or all images on a page
    - Save custom frame presets to personal library
  - **Page Borders**
    - Full-page border styles (simple, decorative, themed)
    - Configurable margin from page edge

## 5. Project Management

### Save and Load

#### Project Files
- Auto-save every 5 minutes
- Version history
- Project metadata
- Thumbnail generation
- Quick preview

#### File Management
- Recent projects list
- Project templates
- Duplicate project
- Archive old projects

### Collaboration Features

#### Sharing
- Export project package
- Read-only preview links
- Comment system
- Version comparison

## 6. Export and Output

### Export Formats

#### Print-Ready PDF
- **Specifications**
  - PDF/X-1a, PDF/X-4
  - CMYK color space
  - 300 DPI minimum
  - Bleed marks (3mm default)
  - Crop marks
  - Color bars

#### Digital Formats
- JPEG (quality settings)
- PNG (transparent support)
- WebP (optimized)
- ZIP package

### Print Service Integration

#### Direct Upload
- API integration with print services
- Order tracking
- Price calculation
- Delivery options

#### Export Profiles
- Service-specific presets
- Custom profile creation
- Validation checks

## 7. Advanced Features

### Color Management

#### ICC Profiles
- sRGB for screen
- CMYK profiles for print
- Custom profile import
- Soft proofing

#### Color Tools
- Color picker
- Color palettes
- Eyedropper tool
- Color harmony generator

#### Curated Color Schemes

Pre-defined, coordinated color schemes that can be browsed, previewed, and applied globally to an entire project (book, calendar, card, or photo sheet). A color scheme provides a coherent set of colors for backgrounds, text, accents, and decorative elements across all pages.

- **Scheme Structure**
  - Primary color (dominant backgrounds / hero areas)
  - Secondary color (alternate backgrounds / section dividers)
  - Accent color (highlights, buttons, decorative elements)
  - Text primary color (headings, body text)
  - Text secondary color (captions, metadata)
  - Border / rule color

- **Gradient Schemes**
  - Schemes may define gradient backgrounds instead of (or in addition to) solid colors
  - Gradient types: linear, radial, conic
  - Each gradient specifies: type, angle/position, and two or more color stops
  - Gradient schemes include a primary gradient (hero areas), a secondary gradient (alternate sections), and solid fallback colors for text and accents
  - Users can customize gradient direction, color stops, and opacity per stop
  - Gradients can be applied to page backgrounds, section dividers, and decorative elements

- **Built-in Scheme Categories**
  - **Seasonal**: Spring Pastels, Summer Brights, Autumn Warmth, Winter Cool
  - **Occasion**: Wedding Elegance, Baby Soft, Birthday Fun, Holiday Festive
  - **Style**: Modern Mono, Classic Neutral, Bold & Vibrant, Earth Tones
  - **Gradient**: Sunset Fade, Ocean Depth, Aurora Borealis, Pastel Dream, Midnight Glow, Golden Hour
  - **Product-specific**: schemes tagged as optimized for books, calendars, cards, or photo sheets

- **Scheme Operations**
  - Browse and filter by category or product type
  - Live preview before applying
  - Apply to all pages or selected pages
  - Revert to previous scheme
  - Customize any color within an applied scheme (creates a derived scheme)
  - Save custom schemes to personal library
  - Import / export schemes (JSON format)

- **Auto-Apply Behavior**
  - When a scheme is applied, all template-driven colors update (backgrounds, text defaults, shape fills, borders)
  - User-overridden colors on individual elements are preserved unless the user opts to reset all
  - Scheme changes are recorded as a single undo step

### Performance Features

#### Optimization
- Proxy image generation
- Progressive loading
- Background processing
- GPU acceleration (when available)

### Accessibility

#### Features
- Keyboard shortcuts
- Screen reader support
- High contrast mode
- Larger UI option

## 8. User Preferences

### Customization
- **Interface**
  - Theme selection (light/dark)
  - Toolbar customization
  - Panel arrangement
  - Zoom preferences

- **Defaults**
  - Default fonts
  - Color preferences
  - Grid settings
  - Export settings

### Language Support
- Multi-language UI
- RTL language support
- Date format localization
- Measurement units (metric/imperial)

## 9. Help and Support

### In-App Assistance
- Interactive tutorials
- Tooltip help
- Context-sensitive help
- Video tutorials

### Documentation
- User manual
- FAQ section
- Troubleshooting guide
- Community forum links

## 10. Quality Assurance

### Preflight Checks
- Resolution warnings
- Bleed area checks
- Font embedding verification
- Color space validation
- Image quality assessment

### Preview Modes
- Screen preview
- Print preview
- 3D book preview
- Spread view for books

## Feature Priority Matrix

| Feature | Priority | Phase | Complexity |
|---------|----------|-------|------------|
| Basic canvas editor | Critical | 1 | Medium |
| Image import/edit | Critical | 1 | Medium |
| Text tools | Critical | 1 | Low |
| PDF export | Critical | 1 | High |
| Template library | High | 2 | Medium |
| Photo books | High | 2 | High |
| Color management | High | 2 | High |
| Calendars | Medium | 3 | Medium |
| Cards | Medium | 3 | Low |
| Photo sheets | Medium | 3 | Low |
| Auto-layout | Low | 4 | High |
| Cloud features | Low | 4 | High |

## User Stories

### Photo Book Creation
1. User imports photos from vacation
2. Selects photo book template
3. Arranges photos using drag-and-drop
4. Adds captions and decorations
5. Reviews in 3D preview
6. Exports as print-ready PDF
7. Orders from print service

### Calendar Design
1. User chooses calendar type
2. Imports 12 favorite photos
3. Auto-assigns one per month
4. Adds birthdays and anniversaries
5. Customizes fonts and colors
6. Exports for printing

### Card Personalization
1. User selects card template
2. Replaces placeholder photo
3. Edits greeting message
4. Duplicates for multiple recipients
5. Personalizes each card
6. Exports as PDF batch

### Photo Sheet Layout
1. User chooses photo sheet format and size
2. Selects a layout (grid, collage, or contact sheet)
3. Drags photos into slots or auto-fills from selection
4. Adjusts spacing and arrangement
5. Adds optional captions
6. Exports as print-ready PDF or high-res image