# UI Layout Design Proposals

Three design options for the header and left sidebar navigation. All designs share the same canvas area and right properties panel from the existing spec.

---

## Design A: "Tabbed Studio"

A clean, app-like experience with a persistent product-type tab bar in the header and a left sidebar that transitions between project browser and design tools.

### Header

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🎨 Design Studio Pro    [📖 Photo Books] [📅 Calendars] [🃏 Cards] [🖼 Photo Sheets]  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 🔧 Toolbar: [Undo] [Redo] │ [Zoom −][100%][Zoom +] │ [Preview]  │  │
│  │             [View: Single ▾] │ [Guides ☐] [Grid ☐] │ [Export]   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Top row**: App logo/name on the left, four product-type tabs in the center (Photo Books / Calendars / Cards / Photo Sheets). The active tab is highlighted with a colored underline. A user/settings icon sits on the far right.
- **Second row**: Contextual toolbar (undo/redo, zoom, view mode, toggle guides/grid, preview, export). This toolbar adapts slightly based on the selected product type.
- The traditional File/Edit/View menu is accessible via a hamburger menu (☰) next to the logo, keeping the header clean.

### Left Sidebar — State 1: Project Browser (no project open)

```
┌──────────────────────┐
│ 📖 Photo Books       │  ← reflects selected header tab
│                      │
│ ┌──────────────────┐ │
│ │ [+ New Project]  │ │
│ └──────────────────┘ │
│                      │
│ Recent Projects      │
│ ┌──────────────────┐ │
│ │ 🖼 Vacation 2025 │ │
│ │    24 pages      │ │
│ │    Modified: 2d  │ │
│ ├──────────────────┤ │
│ │ 🖼 Wedding Album │ │
│ │    48 pages      │ │
│ │    Modified: 1w  │ │
│ ├──────────────────┤ │
│ │ 🖼 Baby's Year   │ │
│ │    32 pages      │ │
│ │    Modified: 3w  │ │
│ └──────────────────┘ │
│                      │
│ All Projects         │
│ [Search... 🔍]       │
│ ┌──────────────────┐ │
│ │ (scrollable list │ │
│ │  with thumbnails │ │
│ │  and metadata)   │ │
│ └──────────────────┘ │
└──────────────────────┘
```

### Left Sidebar — State 2: Design Tools (project open)

```
┌──────────────────────┐
│ ◀ Projects  │ Vacation 2025
│──────────────────────│
│                      │
│ [📐 Templates]       │  ← vertical icon tabs or
│ [🎨 Colors  ]       │     stacked sections
│ [🖼 Photos  ]       │
│ [✏️  Text    ]       │
│ [⬡  Shapes  ]       │
│ [🌸 Graphics]       │
│ [🖽  Backgrounds]    │
│                      │
│─── active section ───│
│                      │
│ 📐 Templates         │
│ [Search... 🔍]       │
│ ┌────┬────┬────┐     │
│ │ t1 │ t2 │ t3 │     │  ← grid of template
│ ├────┼────┼────┤     │     thumbnails
│ │ t4 │ t5 │ t6 │     │
│ ├────┼────┼────┤     │
│ │ t7 │ t8 │ t9 │     │
│ └────┴────┴────┘     │
│                      │
│ Filter: [All ▾]      │
│  Wedding │ Travel    │
│  Modern  │ Minimal   │
└──────────────────────┘
```

When "Colors" is selected:
```
│ 🎨 Colors            │
│                      │
│ Document Colors      │
│ ┌──┬──┬──┬──┬──┐     │
│ │  │  │  │  │  │     │  ← swatches used in project
│ └──┴──┴──┴──┴──┘     │
│                      │
│ Palettes             │
│ ● Warm Sunset        │
│   ┌──┬──┬──┬──┬──┐   │
│   │  │  │  │  │  │   │
│   └──┴──┴──┴──┴──┘   │
│ ○ Ocean Breeze       │
│ ○ Forest Green       │
│ ○ Pastel Dreams      │
│                      │
│ Custom Color         │
│ [Color Picker □]     │
│ HEX: #______         │
│ RGB: ___ ___ ___     │
└──────────────────────┘
```

### Characteristics
- **Pros**: Familiar tabbed interface; clear separation between browsing and designing; product type always visible.
- **Cons**: Two-row header takes vertical space; sidebar section switching requires clicks.

---

## Design B: "Sidebar-First Navigator"

The product type selector lives in the left sidebar instead of the header, making the header minimal and giving maximum vertical space to the canvas.

### Header

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🎨 Design Studio Pro  [Undo][Redo] [Zoom −][100%][+] [Preview][Export]│
│                                           [☰ Menu]  [View ▾]  [⚙]     │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Single-row header**: Logo on the left, primary actions centered (undo/redo, zoom), secondary actions on the right (menu, view mode, settings).
- Compact, maximizes canvas real estate.
- Full menu accessible via ☰ hamburger.

### Left Sidebar — Unified Navigation

The sidebar is a single, continuously scrollable panel divided into clear zones.

```
┌──────────────────────┐
│                      │
│  Product Type        │
│ ┌──────────────────┐ │
│ │ 📖 Photo Books   ● │ │  ← radio-style selector
│ │ 📅 Calendars     ○ │ │     with icons + labels
│ │ 🃏 Cards         ○ │ │
│ │ 🖼 Photo Sheets  ○ │ │
│ └──────────────────┘ │
│                      │
│━━━━━━━━━━━━━━━━━━━━━━│
│                      │
│  Projects            │
│  [+ New] [🔍 Search] │
│ ┌──────────────────┐ │
│ │ ▸ Vacation 2025  │ │  ← collapsible list
│ │   Wedding Album  │ │     active project bold
│ │   Baby's Year    │ │
│ │   Holiday Cards  │ │
│ └──────────────────┘ │
│                      │
│━━━━━━━━━━━━━━━━━━━━━━│
│                      │  ← section below only
│  Design Tools        │     visible when a project
│                      │     is open
│  📐 Templates  ▾     │
│  ┌────┬────┐         │
│  │ t1 │ t2 │         │  ← collapsed/expanded
│  ├────┼────┤         │     accordion sections
│  │ t3 │ t4 │         │
│  └────┴────┘         │
│                      │
│  🎨 Colors  ▸        │
│                      │
│  🖼 Photos  ▸        │
│                      │
│  ✏️ Text Styles ▸     │
│                      │
│  ⬡ Shapes  ▸         │
│                      │
│  🌸 Graphics ▸       │
│                      │
│  🖽 Backgrounds ▸     │
│                      │
└──────────────────────┘
```

### Expanded Accordion Example — Colors

```
│  🎨 Colors  ▾        │
│  ┌──────────────────┐ │
│  │ Recent           │ │
│  │ ┌──┬──┬──┬──┬──┐ │ │
│  │ │  │  │  │  │  │ │ │
│  │ └──┴──┴──┴──┴──┘ │ │
│  │                  │ │
│  │ Palettes  [+ New]│ │
│  │ Warm Sunset    ▸ │ │
│  │ Ocean Breeze   ▸ │ │
│  │ Monochrome     ▸ │ │
│  │                  │ │
│  │ [🎯 Pick Color]  │ │
│  │ ┌──────────────┐ │ │
│  │ │  Color wheel  │ │ │
│  │ │  or spectrum  │ │ │
│  │ └──────────────┘ │ │
│  │ #3B82F6          │ │
│  └──────────────────┘ │
```

### Characteristics
- **Pros**: Single thin header maximizes canvas; everything in one sidebar — no mode switching; accordion is discoverable and scannable.
- **Cons**: Sidebar can get long and require scrolling; product type selector is less prominent.

---

## Design C: "Split Rail"

A dual-rail approach: a narrow icon rail on the far left for top-level navigation, and a wider detail panel that slides in next to it.

### Header

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🎨 DSP   [📖 Photo Books ▾] ← dropdown    [Undo][Redo]  [Zoom]       │
│           (includes Photo Sheets)                                      │
│           "Vacation 2025"                    [Preview] [Export] [☰][⚙] │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Single-row header** with a product-type dropdown listing all four types (not tabs, saving horizontal space).
- Shows the current project name inline in the header.
- Primary actions on the right.

### Left Rail + Detail Panel

```
┌────┬─────────────────────┐
│    │                     │
│ 📁 │  (detail panel      │
│    │   for active rail   │
│ 📐 │   icon)             │
│    │                     │
│ 🎨 │                     │
│    │                     │
│ 🖼 │                     │
│    │                     │
│ ✏️ │                     │
│    │                     │
│ ⬡  │                     │
│    │                     │
│ 🌸 │                     │
│    │                     │
│    │                     │
│    │                     │
│ ⚙  │                     │
└────┴─────────────────────┘
 48px      240px (collapsible)
```

#### Rail Icon: 📁 Projects

```
┌────┬─────────────────────┐
│    │ Projects             │
│ 📁 │                     │
│ ●  │ [+ New Project]     │
│ 📐 │                     │
│    │ Recent               │
│ 🎨 │ ┌─────────────────┐ │
│    │ │ 🖼 Vacation 2025 │ │
│ 🖼 │ │   24p · 2d ago   │ │
│    │ ├─────────────────┤ │
│ ✏️ │ │ 🖼 Wedding       │ │
│    │ │   48p · 1w ago   │ │
│ ⬡  │ ├─────────────────┤ │
│    │ │ 🖼 Baby's Year   │ │
│ 🌸 │ │   32p · 3w ago   │ │
│    │ └─────────────────┘ │
│    │                     │
│    │ [Search... 🔍]      │
│ ⚙  │                     │
└────┴─────────────────────┘
```

#### Rail Icon: 📐 Templates

```
┌────┬─────────────────────┐
│    │ Templates            │
│ 📁 │                     │
│    │ [Search... 🔍]      │
│ 📐 │ Filter: [All ▾]    │
│ ●  │                     │
│ 🎨 │ ┌────┬────┬────┐   │
│    │ │    │    │    │   │
│ 🖼 │ │ t1 │ t2 │ t3 │   │
│    │ │    │    │    │   │
│ ✏️ │ ├────┼────┼────┤   │
│    │ │    │    │    │   │
│ ⬡  │ │ t4 │ t5 │ t6 │   │
│    │ │    │    │    │   │
│ 🌸 │ ├────┼────┼────┤   │
│    │ │    │    │    │   │
│    │ │ t7 │ t8 │ t9 │   │
│    │ │    │    │    │   │
│ ⚙  │ └────┴────┴────┘   │
└────┴─────────────────────┘
```

#### Rail Icon: 🎨 Colors

```
┌────┬─────────────────────┐
│    │ Colors               │
│ 📁 │                     │
│    │ Document Swatches   │
│ 📐 │ ┌──┬──┬──┬──┬──┐   │
│    │ │  │  │  │  │  │   │
│ 🎨 │ └──┴──┴──┴──┴──┘   │
│ ●  │                     │
│ 🖼 │ Palettes            │
│    │ ┌─────────────────┐ │
│ ✏️ │ │ Warm Sunset     │ │
│    │ │ ┌──┬──┬──┬──┐   │ │
│ ⬡  │ │ │  │  │  │  │   │ │
│    │ │ └──┴──┴──┴──┘   │ │
│ 🌸 │ ├─────────────────┤ │
│    │ │ Ocean Breeze    │ │
│    │ │ ┌──┬──┬──┬──┐   │ │
│    │ │ │  │  │  │  │   │ │
│ ⚙  │ │ └──┴──┴──┴──┘   │ │
│    │ └─────────────────┘ │
│    │                     │
│    │ [🎯 Custom Color]   │
│    │ ┌───────────────┐   │
│    │ │ color picker   │   │
│    │ └───────────────┘   │
└────┴─────────────────────┘
```

The detail panel can be collapsed by clicking the active rail icon again, leaving only the 48px icon rail visible for maximum canvas space.

### Characteristics
- **Pros**: Very space-efficient (rail can collapse); familiar pattern (VS Code, Figma, JetBrains); quick switching between tool categories; detail panel only shown when needed.
- **Cons**: Two-level navigation (rail + panel) may feel indirect for beginners; narrow rail icons need clear visual design.

---

## Comparison Matrix

| Aspect | Design A: Tabbed Studio | Design B: Sidebar-First | Design C: Split Rail |
|---|---|---|---|
| **Product type location** | Header tabs | Sidebar top | Header dropdown |
| **Header height** | 2 rows (~80px) | 1 row (~44px) | 1 row (~44px) |
| **Sidebar state changes** | Yes (browser → tools) | No (unified scroll) | No (rail + panel) |
| **Canvas space** | Good | Best (thinnest header) | Best (collapsible panel) |
| **Discoverability** | High (tabs visible) | High (all in sidebar) | Medium (icons need learning) |
| **Scalability** | Medium | Medium (long scroll) | High (add more rail icons) |
| **Familiar from** | Google Docs, Canva | Lightroom, native apps | VS Code, Figma, InDesign |
| **Best for** | Users who switch product types often | Users who work within one product type | Power users who want max canvas |
