import type { Element, Page, Project } from "./types";

const DISPLAY_DPI = 72;
const INCH_TO_PX = DISPLAY_DPI;
const EPSILON = 0.001;
const MIN_LEGACY_SHEET_OFFSET_PX = 24;

function dimensionToPx(value: number, unit: Project["settings"]["unit"]): number {
  switch (unit) {
    case "mm":
      return (value * DISPLAY_DPI) / 25.4;
    case "inch":
      return value * INCH_TO_PX;
    case "px":
      return value;
  }
}

function elementFitsPage(element: Element, widthPx: number, heightPx: number): boolean {
  return (
    element.position.x >= -EPSILON &&
    element.position.y >= -EPSILON &&
    element.position.x + element.size.width <= widthPx + EPSILON &&
    element.position.y + element.size.height <= heightPx + EPSILON
  );
}

function translatePage(page: Page, offsetX: number, offsetY: number): Page {
  return {
    ...page,
    elements: page.elements.map((element) => ({
      ...element,
      position: {
        x: element.position.x - offsetX,
        y: element.position.y - offsetY,
      },
    })),
  };
}

function normalizePageElements(page: Page, project: Project): Page {
  const widthPx = dimensionToPx(page.width || project.settings.width, project.settings.unit);
  const heightPx = dimensionToPx(page.height || project.settings.height, project.settings.unit);

  if (page.elements.length === 0) return page;

  // Legacy migration for older saves that persisted Fabric canvas coordinates
  // including the sheet origin. First handle the safest case: elements outside
  // the page that all fit after subtracting their common positive offset.
  if (!page.elements.every((el) => elementFitsPage(el, widthPx, heightPx))) {
    const minX = Math.min(...page.elements.map((el) => el.position.x));
    const minY = Math.min(...page.elements.map((el) => el.position.y));
    if (minX > EPSILON && minY > EPSILON) {
      const translated = translatePage(page, minX, minY);
      if (translated.elements.every((el) => elementFitsPage(el, widthPx, heightPx))) {
        return translated;
      }
    }
  }

  // Affected projects produced by the old default import path often contain a
  // single image that is visually centered on the page, but its stored position
  // still includes the page sheet's canvas origin. That can remain technically
  // inside the page (e.g. A4 x≈280px for a 298px-wide image), so detect this
  // narrowly: one image, positive plausible sheet offsets on both axes, and the
  // normalized position is exactly the page-centered placement.
  if (page.elements.length === 1) {
    const [element] = page.elements;
    const centeredX = (widthPx - element.size.width) / 2;
    const centeredY = (heightPx - element.size.height) / 2;
    const offsetX = element.position.x - centeredX;
    const offsetY = element.position.y - centeredY;
    if (
      element.elementType === "image" &&
      offsetX >= MIN_LEGACY_SHEET_OFFSET_PX &&
      offsetY >= MIN_LEGACY_SHEET_OFFSET_PX
    ) {
      const translated = translatePage(page, offsetX, offsetY);
      if (translated.elements.every((el) => elementFitsPage(el, widthPx, heightPx))) {
        return translated;
      }
    }
  }

  return page;
}

export function normalizeProjectElementCoordinates(project: Project): Project {
  return {
    ...project,
    pages: project.pages.map((page) => normalizePageElements(page, project)),
  };
}
