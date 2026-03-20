import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { Canvas as FabricCanvas } from "fabric";
import { FabricImage } from "fabric";
import { pxToMm } from "./sheet";
import { useProjectStore } from "../stores";

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
}

/** Request structure for PDF export. */
export interface PdfExportRequest {
  page: PdfPageConfig;
  images: PdfImageElement[];
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

  // The page sheet is placed at the centre of the canvas.  All image positions
  // are in the same canvas-pixel coordinate space, so we need to express them
  // relative to the sheet origin.
  //
  // Fabric.js v7 defaults to originX/originY = "center", so `left`/`top`
  // refer to the *centre* of each object.  We need the top-left edges to
  // compute correct PDF placement.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheet = objects.find((o) => (o as any).isPageSheet === true);
  const sheetLeftEdge = (sheet?.left ?? 0) - (sheet?.width ?? 0) / 2;
  const sheetTopEdge = (sheet?.top ?? 0) - (sheet?.height ?? 0) / 2;

  const images: PdfImageElement[] = [];

  for (const obj of objects) {
    // Skip non-selectable helpers (page sheet, grid, etc.)
    if (obj.selectable === false) continue;

    // Only export FabricImage instances
    if (!(obj instanceof FabricImage)) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalPath = (obj as any).originalFilePath as string | undefined;
    if (!originalPath) continue;

    const widthPx = (obj.width ?? 0) * (obj.scaleX ?? 1);
    const heightPx = (obj.height ?? 0) * (obj.scaleY ?? 1);
    const left = (obj.left ?? 0) - widthPx / 2 - sheetLeftEdge;
    const top = (obj.top ?? 0) - heightPx / 2 - sheetTopEdge;

    images.push({
      imagePath: originalPath,
      xMm: pxToMm(left),
      yMm: pxToMm(top),
      widthMm: pxToMm(widthPx),
      heightMm: pxToMm(heightPx),
      rotationDeg: obj.angle ?? 0,
    });
  }

  return {
    page: { widthMm: pageWidthMm, heightMm: pageHeightMm, background },
    images,
  };
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

  const pageBackground = project.pages[0]?.backgroundColor;
  const data = collectExportData(canvas, widthMm, heightMm, pageBackground);
  const request: PdfExportRequest = { ...data, outputPath };

  try {
    await invoke<string>("export_pdf", { request });
    console.info("[export] PDF saved to", outputPath);
  } catch (err) {
    console.error("[export] PDF export failed:", err);
  }
}
