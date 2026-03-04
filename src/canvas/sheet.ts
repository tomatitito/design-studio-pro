import { Rect, Shadow, Point, type Canvas as FabricCanvas } from "fabric";
import { useUIStore } from "../stores";

/** DPI used to convert mm to screen pixels. */
export const DISPLAY_DPI = 72;

export interface PagePreset {
  label: string;
  widthMm: number;
  heightMm: number;
}

export const PAGE_PRESETS: PagePreset[] = [
  { label: "A4", widthMm: 210, heightMm: 297 },
  { label: "A3", widthMm: 297, heightMm: 420 },
  { label: "Letter", widthMm: 215.9, heightMm: 279.4 },
  { label: "Square 30cm", widthMm: 300, heightMm: 300 },
];

/** Convert millimetres to display pixels. */
export function mmToPx(mm: number): number {
  return (mm * DISPLAY_DPI) / 25.4;
}

/** Convert display pixels to millimetres. */
export function pxToMm(px: number): number {
  return (px * 25.4) / DISPLAY_DPI;
}

/**
 * Create a white page sheet rectangle on the canvas.
 * The sheet is non-selectable and sent to the back.
 */
export function createPageSheet(
  canvas: FabricCanvas,
  widthMm: number,
  heightMm: number,
): Rect {
  const w = mmToPx(widthMm);
  const h = mmToPx(heightMm);

  const canvasW = canvas.getWidth();
  const canvasH = canvas.getHeight();

  const sheet = new Rect({
    width: w,
    height: h,
    left: (canvasW - w) / 2,
    top: (canvasH - h) / 2,
    fill: "#ffffff",
    strokeWidth: 0,
    selectable: false,
    evented: false,
    hoverCursor: "default",
    shadow: new Shadow({
      color: "rgba(0,0,0,0.3)",
      blur: 20,
      offsetX: 5,
      offsetY: 5,
    }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sheet as any).isPageSheet = true;

  canvas.add(sheet);
  canvas.sendObjectToBack(sheet);
  canvas.requestRenderAll();

  return sheet;
}

/**
 * Update an existing page sheet to new dimensions and re-center it.
 */
export function updatePageSheet(
  canvas: FabricCanvas,
  sheet: Rect,
  widthMm: number,
  heightMm: number,
): void {
  const w = mmToPx(widthMm);
  const h = mmToPx(heightMm);

  const canvasW = canvas.getWidth();
  const canvasH = canvas.getHeight();

  sheet.set({
    width: w,
    height: h,
    left: (canvasW - w) / 2,
    top: (canvasH - h) / 2,
  });

  sheet.setCoords();
  canvas.requestRenderAll();
}

/**
 * Fit the page sheet within the visible viewport by adjusting zoom and pan.
 * Adds padding so the sheet shadow is also visible.
 */
export function fitSheetInView(canvas: FabricCanvas, sheet: Rect): void {
  const padding = 48;

  const viewportW = canvas.getWidth();
  const viewportH = canvas.getHeight();

  const sheetW = sheet.width!;
  const sheetH = sheet.height!;

  // Calculate zoom so the sheet fits within the viewport with padding
  const zoomFit = Math.min(
    (viewportW - padding * 2) / sheetW,
    (viewportH - padding * 2) / sheetH,
  );

  // Center of the sheet in canvas coordinates
  const sheetCenterX = sheet.left! + sheetW / 2;
  const sheetCenterY = sheet.top! + sheetH / 2;

  // Apply zoom centered on the sheet center
  canvas.zoomToPoint(new Point(viewportW / 2, viewportH / 2), zoomFit);

  // After zooming, adjust pan so the sheet center aligns with viewport center
  const panX = viewportW / 2 - sheetCenterX * zoomFit;
  const panY = viewportH / 2 - sheetCenterY * zoomFit;

  const vpt = [...canvas.viewportTransform] as typeof canvas.viewportTransform;
  vpt[4] = panX;
  vpt[5] = panY;
  canvas.setViewportTransform(vpt);

  canvas.requestRenderAll();

  // Sync zoom and pan to the UI store
  useUIStore.getState().setZoom(zoomFit);
  useUIStore.getState().setPanOffset({ x: panX, y: panY });
}
