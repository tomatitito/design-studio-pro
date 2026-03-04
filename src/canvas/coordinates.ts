import type { Position } from "../types";

/**
 * Convert a screen-space point to canvas-space coordinates,
 * accounting for the current zoom level and pan offset.
 */
export function screenToCanvas(
  point: Position,
  zoom: number,
  panOffset: Position,
): Position {
  return {
    x: (point.x - panOffset.x) / zoom,
    y: (point.y - panOffset.y) / zoom,
  };
}

/**
 * Convert a canvas-space point to screen-space coordinates,
 * accounting for the current zoom level and pan offset.
 */
export function canvasToScreen(
  point: Position,
  zoom: number,
  panOffset: Position,
): Position {
  return {
    x: point.x * zoom + panOffset.x,
    y: point.y * zoom + panOffset.y,
  };
}
