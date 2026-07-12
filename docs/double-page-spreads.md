# Double-page spreads

Double-page spreads let one design span two physical pages. A spread is edited as one continuous surface, starts on a physical left page, and exports as two PDF pages.

## Pagination sequence

Design Studio Pro keeps physical book sides explicit:

```text
Project start
  1. Title page                  → physical right
  2. Editable blank page         → physical left, back of title page
  3. First photo/content page     → physical right
  4. Earliest double-page spread → left page + right page
```

Sequence diagram:

```mermaid
sequenceDiagram
  participant Project
  participant Title as Title page
  participant Blank as Editable blank
  participant Photo as First photo page
  participant Spread as Earliest spread

  Project->>Title: create first page
  Note right of Title: physical right
  Title->>Blank: insert back of title page
  Note right of Blank: physical left, editable blank
  Blank->>Photo: start photo content
  Note right of Photo: physical right
  Photo->>Spread: first valid spread position
  Note right of Spread: physical left + physical right
```

## Creating a spread

1. Select a page or existing spread in the sidebar.
2. Choose **Add double page**.
3. If the next physical side is left, Design Studio Pro inserts one double-page spread after the selection.
4. If the next physical side is right, Design Studio Pro must first add an editable blank page or cancel.

Alignment prompt choices are exactly:

- `Insert editable blank page`
- `Cancel`

Existing single pages are not converted into spreads. A new spread is inserted as a new ordered unit.

## Editing a spread

A spread behaves like one shared canvas:

- Left and right pages have equal size.
- The visible gutter/divider is only a visual guide.
- Boundary width is zero.
- Elements may cross the page boundary.
- Guides may cross the page boundary.
- Selections may include objects on both sides of the boundary.
- Moving, arranging, or resizing a cross-boundary element keeps it as one element.

Coordinate model:

```text
spread x = 0                       page.width                    2 * page.width
           | left physical page | zero-width boundary | right physical page |
```

Left-page content uses spread-relative coordinates from `0` to `page.width`. Right-page content uses coordinates greater than or equal to `page.width`. Cross-boundary content can occupy both ranges.

## Moving and deleting

Spreads are atomic in the ordered page list:

- Moving a spread moves both physical pages together.
- Deleting a spread deletes both physical pages together.
- Sidebar thumbnails should visually group left/right pages as one spread.
- Reordering must preserve the rule that every spread starts on a physical left side.

Deleting a single page can make a later spread start on the wrong side. In that case, Design Studio Pro shows exactly:

- `Insert blank replacement`
- `Cancel deletion`

Choose `Insert blank replacement` to keep physical side alignment valid. Choose `Cancel deletion` to leave the project unchanged.

## Shared cross-boundary elements

A spread owns one shared element scene, not separate left/right scenes. This means:

- One image can span both pages.
- One text box can cross the boundary.
- One guide can continue across the full spread width.
- One multi-select can contain objects from both pages.

During editing, cross-boundary objects stay whole. During export, each physical page receives the clipped portion that belongs to that page.

## PDF export behavior

PDF export emits two physical PDF pages for every spread:

1. Left output page clips the shared spread scene to `x = 0..page.width`.
2. Right output page clips the shared spread scene to `x = page.width..2 * page.width`.
3. Right-page content is translated by `-page.width` before rendering onto the right PDF page.
4. Objects crossing the boundary appear on both PDF pages, clipped at the boundary.
5. Export order follows physical page order.
6. Initial export clips exactly at the zero-width boundary.

Print bleed across the boundary is future work. Do not rely on extra bleed being included in the current two-page PDF output.

## Contextual help and tooltip copy

Suggested user-facing strings:

- **Add double page**: `Insert a two-page spread after the selected page. Spreads must start on a left page.`
- **Editable blank page**: `Blank page used to preserve left/right book pagination. You can edit it or leave it empty.`
- **Spread group**: `Double-page spread. Edited as one canvas; exported as two PDF pages.`
- **Page boundary**: `Zero-width page boundary. Objects can cross it; PDF export clips at this line.`
- **Alignment prompt**: `A double-page spread must start on a left page.`
- **Delete guard prompt**: `Deleting this page would shift a later spread onto the wrong side.`

## Troubleshooting

### I cannot insert a spread here

A spread must start on a physical left page. If the selected insertion point would start the spread on a right page, choose `Insert editable blank page` or select a different insertion point.

### Deleting a page asks for a blank replacement

A later spread depends on current left/right alignment. Choose `Insert blank replacement` to preserve spread alignment, or `Cancel deletion` to keep the existing page.

### My object crosses the page boundary

That is supported. The object remains one shared element while editing. PDF export clips it into left and right page portions.

### My exported spread is two pages, not one wide page

This is expected. Spreads are edited as one continuous surface but exported as two physical PDF pages.

### Content at the boundary is cut exactly

This is expected. Current export clips exactly at the page boundary. Print bleed is future work.
