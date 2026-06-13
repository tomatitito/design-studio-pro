import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { Canvas as FabricCanvas, FabricObject } from "fabric";
import { FabricImage } from "fabric";
import { pxToMm } from "./sheet";
import { getFabricDocumentElementId, getFabricImageSourcePath } from "./documentAdapter";
import { resolveImageBorderStyle, type ImageBorderStyleId } from "./imageBorders";
import { getActiveProjectPage, useProjectStore } from "../stores";
import type {
  ImageElement,
  Page,
  Project,
  ShapeElement,
  ShapeKind,
  TextAlign,
  TextElement,
} from "../types";
import { normalizeProjectElementCoordinates } from "../projectCoordinates";
import { getTextAlign, getTextFontWeight, getTextLetterSpacing } from "../textStyles";

/** Configuration for a PDF page. */
export interface PdfPageConfig {
  widthMm: number;
  heightMm: number;
  background?: string;
}

/** An image element to be placed in the PDF. */
export interface PdfImageElement {
  imagePath: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  borderStyle?: string;
  borderColor?: string;
  borderWidth?: number;
}

/** Request structure for PDF export. */
export interface PdfTextElement {
  content: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  fontWeight: string;
  textAlign: TextAlign;
  letterSpacing: number;
}

export interface PdfShapeElement {
  shapeKind: ShapeKind;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export type PdfRenderableElement =
  | ({ elementType: "image" } & PdfImageElement)
  | ({ elementType: "text" } & PdfTextElement)
  | ({ elementType: "shape" } & PdfShapeElement);

export interface PdfPageExport {
  page: PdfPageConfig;
  images: PdfImageElement[];
  texts: PdfTextElement[];
  shapes: PdfShapeElement[];
  elements: PdfRenderableElement[];
}

export interface PdfExportRequest {
  page?: PdfPageConfig;
  images?: PdfImageElement[];
  texts?: PdfTextElement[];
  shapes?: PdfShapeElement[];
  elements?: PdfRenderableElement[];
  pages?: PdfPageExport[];
  outputPath: string;
}

/**
 * Collect export data from the canvas, converting canvas-pixel coordinates to
 * millimetres for the Rust PDF backend.
 *
 * Filters out non-selectable objects (e.g. the page sheet) and non-image objects.
 */
export function collectExportData(
  canvas: FabricCanvas,
  pageWidthMm: number,
  pageHeightMm: number,
  background?: string,
): Omit<PdfExportRequest, "outputPath"> {
  const objects = canvas.getObjects();
  const { currentProject, activePageId } = useProjectStore.getState();
  const currentPage = getActiveProjectPage(currentProject, activePageId);
  const imageElementsById = new Map<string, ImageElement>(
    (currentPage?.elements ?? [])
      .filter((element): element is ImageElement => element.elementType === "image")
      .map((element) => [element.id, element]),
  );

  function getObjectLeftEdge(obj: FabricObject): number {
    const widthPx = (obj.width ?? 0) * (obj.scaleX ?? 1);
    const originX = obj.originX ?? "left";
    if (originX === "center") return (obj.left ?? 0) - widthPx / 2;
    if (originX === "right") return (obj.left ?? 0) - widthPx;
    return obj.left ?? 0;
  }

  function getObjectTopEdge(obj: FabricObject): number {
    const heightPx = (obj.height ?? 0) * (obj.scaleY ?? 1);
    const originY = obj.originY ?? "top";
    if (originY === "center") return (obj.top ?? 0) - heightPx / 2;
    if (originY === "bottom") return (obj.top ?? 0) - heightPx;
    return obj.top ?? 0;
  }

  // All image positions are in the same canvas-pixel coordinate space.
  // We convert to sheet-relative coordinates using each object's actual origin.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheet = objects.find((o) => (o as any).isPageSheet === true);
  const sheetLeftEdge = sheet ? getObjectLeftEdge(sheet as FabricObject) : 0;
  const sheetTopEdge = sheet ? getObjectTopEdge(sheet as FabricObject) : 0;

  const images: PdfImageElement[] = [];

  for (const obj of objects) {
    // Skip non-selectable helpers (page sheet, grid, etc.)
    if (obj.selectable === false) continue;

    // Only export FabricImage instances
    if (!(obj instanceof FabricImage)) continue;

    const originalPath = getFabricImageSourcePath(obj as FabricObject);
    if (!isExportableImageSource(originalPath)) continue;

    const widthPx = (obj.width ?? 0) * (obj.scaleX ?? 1);
    const heightPx = (obj.height ?? 0) * (obj.scaleY ?? 1);
    const left = getObjectLeftEdge(obj as FabricObject) - sheetLeftEdge;
    const top = getObjectTopEdge(obj as FabricObject) - sheetTopEdge;
    const elementId = getFabricDocumentElementId(obj as FabricObject);
    const border = resolvePdfImageBorder(imageElementsById.get(elementId));

    images.push({
      imagePath: originalPath,
      xMm: pxToMm(left),
      yMm: pxToMm(top),
      widthMm: pxToMm(widthPx),
      heightMm: pxToMm(heightPx),
      rotationDeg: obj.angle ?? 0,
      ...border,
    });
  }

  const texts = collectTextElements(currentPage);

  const shapes = collectShapeElements(currentPage);
  const elements = collectRenderableElements(currentPage, images);

  return {
    page: { widthMm: pageWidthMm, heightMm: pageHeightMm, background },
    images,
    texts,
    shapes,
    elements,
  };
}

function mapTextElement(element: TextElement): PdfTextElement {
  return {
    content: element.content,
    xMm: pxToMm(element.position.x),
    yMm: pxToMm(element.position.y),
    widthMm: pxToMm(element.size.width),
    heightMm: pxToMm(element.size.height),
    rotationDeg: element.rotation,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    color: element.color,
    fontWeight: getTextFontWeight(element),
    textAlign: getTextAlign(element),
    letterSpacing: getTextLetterSpacing(element),
  };
}

function collectTextElements(page: Page | null | undefined): PdfTextElement[] {
  return (page?.elements ?? [])
    .filter((element): element is TextElement => element.elementType === "text" && element.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(mapTextElement);
}

function mapShapeElement(element: ShapeElement): PdfShapeElement {
  return {
    shapeKind: element.shapeKind,
    xMm: pxToMm(element.position.x),
    yMm: pxToMm(element.position.y),
    widthMm: pxToMm(element.size.width),
    heightMm: pxToMm(element.size.height),
    rotationDeg: element.rotation,
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: pxToMm(element.strokeWidth),
    opacity: element.opacity,
  };
}

function collectShapeElements(page: Page | null | undefined): PdfShapeElement[] {
  return (page?.elements ?? [])
    .filter(
      (element): element is ShapeElement => element.elementType === "shape" && element.visible,
    )
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(mapShapeElement);
}

function isExportableImageSource(src: string | undefined): src is string {
  return typeof src === "string" && src.trim().length > 0;
}

function mapImageElement(element: ImageElement): PdfImageElement {
  return {
    imagePath: element.src,
    xMm: pxToMm(element.position.x),
    yMm: pxToMm(element.position.y),
    widthMm: pxToMm(element.size.width),
    heightMm: pxToMm(element.size.height),
    rotationDeg: element.rotation,
    ...resolvePdfImageBorder(element),
  };
}

function collectRenderableElements(
  page: Page | null | undefined,
  canvasImages?: PdfImageElement[],
): PdfRenderableElement[] {
  let canvasImageIndex = 0;
  return (page?.elements ?? [])
    .filter((element) => element.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .flatMap((element): PdfRenderableElement[] => {
      if (element.elementType === "image") {
        if (!isExportableImageSource(element.src)) return [];
        const image = canvasImages?.[canvasImageIndex++] ?? mapImageElement(element);
        return [{ elementType: "image", ...image }];
      }
      if (element.elementType === "text") {
        return [{ elementType: "text", ...mapTextElement(element) }];
      }
      if (element.elementType === "shape") {
        return [{ elementType: "shape", ...mapShapeElement(element) }];
      }
      return [];
    });
}

function collectPageExportData(page: Page, project: Project): PdfPageExport {
  const unit = project.settings.unit;
  const images = page.elements
    .filter(
      (element): element is ImageElement =>
        element.elementType === "image" && element.visible && isExportableImageSource(element.src),
    )
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(mapImageElement);

  const texts = collectTextElements(page);
  const shapes = collectShapeElements(page);

  return {
    page: {
      widthMm: toMm(page.width || project.settings.width, unit),
      heightMm: toMm(page.height || project.settings.height, unit),
      background: page.backgroundColor,
    },
    images,
    texts,
    shapes,
    elements: collectRenderableElements(page),
  };
}

export function collectProjectExportData(
  canvas: FabricCanvas,
  project: Project,
): Omit<PdfExportRequest, "outputPath"> {
  void canvas;
  const normalizedProject = normalizeProjectElementCoordinates(project);
  const pages = [...normalizedProject.pages]
    .sort((a, b) => a.order - b.order)
    .map((page) => collectPageExportData(page, normalizedProject));

  return { pages };
}

const VALID_BORDER_STYLE_IDS = new Set<ImageBorderStyleId>([
  "custom",
  "matte-frame",
  "gallery-frame",
  "ornate-gold",
  "walnut-frame",
]);

export function resolvePdfImageBorder(
  imageElement?: ImageElement,
): Pick<PdfImageElement, "borderStyle" | "borderColor" | "borderWidth"> {
  if (!imageElement) return {};
  const hasAnyBorderData =
    imageElement.borderStyle !== undefined ||
    imageElement.borderColor !== undefined ||
    imageElement.borderWidth !== undefined;
  if (!hasAnyBorderData) return {};

  const styleId = imageElement.borderStyle;
  if (styleId && VALID_BORDER_STYLE_IDS.has(styleId as ImageBorderStyleId)) {
    const resolved = resolveImageBorderStyle(
      styleId as ImageBorderStyleId,
      imageElement.borderColor,
      imageElement.borderWidth,
    );
    return {
      borderStyle: resolved.styleId,
      borderColor: resolved.borderColor,
      borderWidth: pxToMm(resolved.borderWidth),
    };
  }

  return {
    borderStyle: imageElement.borderStyle,
    borderColor: imageElement.borderColor,
    borderWidth: toOptionalMm(imageElement.borderWidth),
  };
}

function toOptionalMm(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? pxToMm(value) : undefined;
}

const INCH_TO_MM = 25.4;

/**
 * Convert project-settings dimensions to millimetres based on the project
 * unit. Canvas display uses 72 DPI (DISPLAY_DPI) so px values use that ratio.
 */
function toMm(value: number, unit: "mm" | "inch" | "px"): number {
  switch (unit) {
    case "mm":
      return value;
    case "inch":
      return value * INCH_TO_MM;
    case "px":
      return pxToMm(value);
  }
}

/**
 * Run the full PDF export flow:
 *   1. Read page dimensions from the project store
 *   2. Open a native save dialog
 *   3. Collect canvas data and invoke the Rust `export_pdf` command
 */
export async function exportPdf(canvas: FabricCanvas): Promise<void> {
  const project = useProjectStore.getState().currentProject;
  if (!project) return;

  const { width, height, unit } = project.settings;
  const widthMm = toMm(width, unit);
  const heightMm = toMm(height, unit);

  const outputPath = await save({
    title: "Export PDF",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!outputPath) return;

  const data =
    project.pages.length > 1
      ? collectProjectExportData(canvas, project)
      : collectExportData(
          canvas,
          widthMm,
          heightMm,
          getActiveProjectPage(project, useProjectStore.getState().activePageId)?.backgroundColor,
        );
  const request: PdfExportRequest = { ...data, outputPath };

  try {
    await invoke<string>("export_pdf", { request });
    console.info("[export] PDF saved to", outputPath);
  } catch (err) {
    console.error("[export] PDF export failed:", err);
  }
}
