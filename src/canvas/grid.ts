import type { Canvas as FabricCanvas } from "fabric";

const GRID_COLOR = "rgba(255, 255, 255, 0.06)";
const GRID_MAJOR_COLOR = "rgba(255, 255, 255, 0.12)";

/**
 * Draw a grid overlay on the canvas.
 * Called as part of the canvas afterRender event.
 */
export function drawGrid(
  canvas: FabricCanvas,
  gridSize: number,
  majorEvery: number = 5,
): void {
  const ctx = canvas.getContext();
  const vpt = canvas.viewportTransform;
  const zoom = canvas.getZoom();

  const width = canvas.width ?? 0;
  const height = canvas.height ?? 0;

  // Calculate visible area in canvas coordinates
  const startX = -vpt[4] / zoom;
  const startY = -vpt[5] / zoom;
  const endX = (width - vpt[4]) / zoom;
  const endY = (height - vpt[5]) / zoom;

  const gridStart = {
    x: Math.floor(startX / gridSize) * gridSize,
    y: Math.floor(startY / gridSize) * gridSize,
  };

  ctx.save();
  ctx.setTransform(
    vpt[0],
    vpt[1],
    vpt[2],
    vpt[3],
    vpt[4],
    vpt[5],
  );

  // Draw vertical lines
  for (let x = gridStart.x; x <= endX; x += gridSize) {
    const isMajor =
      majorEvery > 0 && Math.abs(x % (gridSize * majorEvery)) < 0.001;
    ctx.strokeStyle = isMajor ? GRID_MAJOR_COLOR : GRID_COLOR;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }

  // Draw horizontal lines
  for (let y = gridStart.y; y <= endY; y += gridSize) {
    const isMajor =
      majorEvery > 0 && Math.abs(y % (gridSize * majorEvery)) < 0.001;
    ctx.strokeStyle = isMajor ? GRID_MAJOR_COLOR : GRID_COLOR;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Attach grid overlay rendering to a canvas.
 * Returns a cleanup function.
 */
export function attachGridOverlay(
  canvas: FabricCanvas,
  gridSize: number,
  enabled: boolean,
): () => void {
  const handler = () => {
    if (enabled) {
      drawGrid(canvas, gridSize);
    }
  };

  canvas.on("after:render", handler);

  return () => {
    canvas.off("after:render", handler);
  };
}

/**
 * Snap a coordinate value to the nearest grid position.
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}
