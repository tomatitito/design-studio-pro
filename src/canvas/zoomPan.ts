import type { Canvas as FabricCanvas, TPointerEventInfo } from "fabric";
import { Point } from "fabric";
import type { Rect } from "fabric";
import { useUIStore } from "../stores";
import { clampPanToSheet } from "./sheet";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.05;

/**
 * Attach zoom and pan handlers to a Fabric canvas.
 * - Ctrl+scroll / pinch: zoom centered on cursor, clamped to sheet bounds
 * - Regular scroll: pan within sheet bounds (only when zoomed in past sheet size)
 * Returns a cleanup function.
 */
export function attachZoomPanHandlers(
  canvas: FabricCanvas,
  sheetRef: { current: Rect | null },
): () => void {
  const handleWheel = (opt: TPointerEventInfo<WheelEvent>) => {
    const e = opt.e;
    e.preventDefault();
    e.stopPropagation();

    const sheet = sheetRef.current;
    if (!sheet) return;

    if (e.ctrlKey) {
      // Pinch-to-zoom on macOS trackpads, or Ctrl+scroll on desktop
      const delta = e.deltaY;
      const currentZoom = canvas.getZoom();
      let newZoom =
        delta > 0
          ? currentZoom * (1 - ZOOM_STEP)
          : currentZoom * (1 + ZOOM_STEP);
      newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));

      // Zoom to cursor point
      const point = new Point(e.offsetX, e.offsetY);
      canvas.zoomToPoint(point, newZoom);

      // Clamp pan to sheet bounds after zoom
      const vpt = canvas.viewportTransform;
      const clamped = clampPanToSheet(canvas, sheet, newZoom, {
        x: vpt[4],
        y: vpt[5],
      });
      vpt[4] = clamped.x;
      vpt[5] = clamped.y;
      canvas.setViewportTransform([...vpt] as typeof vpt);

      useUIStore.getState().setZoom(newZoom);
      useUIStore.getState().setPanOffset(clamped);
    } else {
      // Regular scroll: pan, but clamped to sheet bounds
      const vpt = [
        ...canvas.viewportTransform,
      ] as typeof canvas.viewportTransform;
      const zoom = canvas.getZoom();
      const proposedPan = {
        x: vpt[4] - e.deltaX,
        y: vpt[5] - e.deltaY,
      };
      const clamped = clampPanToSheet(canvas, sheet, zoom, proposedPan);
      vpt[4] = clamped.x;
      vpt[5] = clamped.y;
      canvas.setViewportTransform(vpt);
      useUIStore.getState().setPanOffset(clamped);
    }
  };

  canvas.on("mouse:wheel", handleWheel);

  return () => {
    canvas.off("mouse:wheel", handleWheel);
  };
}
