import type { Canvas as FabricCanvas, TPointerEventInfo } from "fabric";
import { Point } from "fabric";
import { useUIStore } from "../stores";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.05;

/**
 * Attach zoom and pan handlers to a Fabric canvas.
 * - Mouse wheel: zoom centered on cursor position
 * - Middle-mouse drag or Space+drag: pan the canvas
 * Returns a cleanup function.
 */
export function attachZoomPanHandlers(canvas: FabricCanvas): () => void {
  let isPanning = false;
  let isSpaceDown = false;
  let lastPointer = { x: 0, y: 0 };

  const handleWheel = (opt: TPointerEventInfo<WheelEvent>) => {
    const e = opt.e;
    e.preventDefault();
    e.stopPropagation();

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

      // Sync to store
      const vpt = canvas.viewportTransform;
      useUIStore.getState().setZoom(newZoom);
      useUIStore.getState().setPanOffset({ x: vpt[4], y: vpt[5] });
    } else {
      // Regular two-finger scroll / mouse wheel: pan the canvas
      const vpt = [
        ...canvas.viewportTransform,
      ] as typeof canvas.viewportTransform;
      vpt[4] -= e.deltaX;
      vpt[5] -= e.deltaY;
      canvas.setViewportTransform(vpt);
      useUIStore.getState().setPanOffset({ x: vpt[4], y: vpt[5] });
    }
  };

  const handleMouseDown = (opt: TPointerEventInfo) => {
    const e = opt.e;
    // Only handle mouse events (not touch)
    if (!("button" in e)) return;
    const mouseEvent = e as MouseEvent;

    // Middle mouse button or space+left click
    if (mouseEvent.button === 1 || (isSpaceDown && mouseEvent.button === 0)) {
      isPanning = true;
      lastPointer = { x: mouseEvent.clientX, y: mouseEvent.clientY };
      canvas.selection = false;
      canvas.setCursor("grabbing");
      mouseEvent.preventDefault();
    }
  };

  const handleMouseMove = (opt: TPointerEventInfo) => {
    if (!isPanning) return;
    const e = opt.e;
    if (!("clientX" in e)) return;
    const mouseEvent = e as MouseEvent;

    const dx = mouseEvent.clientX - lastPointer.x;
    const dy = mouseEvent.clientY - lastPointer.y;
    lastPointer = { x: mouseEvent.clientX, y: mouseEvent.clientY };

    const vpt = [
      ...canvas.viewportTransform,
    ] as typeof canvas.viewportTransform;
    vpt[4] += dx;
    vpt[5] += dy;
    canvas.setViewportTransform(vpt);

    useUIStore.getState().setPanOffset({ x: vpt[4], y: vpt[5] });
  };

  const handleMouseUp = () => {
    if (isPanning) {
      isPanning = false;
      canvas.selection = true;
      const tool = useUIStore.getState().selectedTool;
      canvas.setCursor(tool === "pan" ? "grab" : "default");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space" && !e.repeat) {
      isSpaceDown = true;
      canvas.setCursor("grab");
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      isSpaceDown = false;
      if (!isPanning) {
        canvas.setCursor("default");
      }
    }
  };

  canvas.on("mouse:wheel", handleWheel);
  canvas.on("mouse:down", handleMouseDown);
  canvas.on("mouse:move", handleMouseMove);
  canvas.on("mouse:up", handleMouseUp);

  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  return () => {
    canvas.off("mouse:wheel", handleWheel);
    canvas.off("mouse:down", handleMouseDown);
    canvas.off("mouse:move", handleMouseMove);
    canvas.off("mouse:up", handleMouseUp);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
  };
}
