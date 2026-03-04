import type { Canvas as FabricCanvas, BasicTransformEvent, FabricObject } from "fabric";
import { getElementId } from "./handlers";

const GUIDE_COLOR = "#ff3366";
const GUIDE_LINE_WIDTH = 1;
const SNAP_THRESHOLD = 5;

interface GuideLine {
  orientation: "horizontal" | "vertical";
  position: number;
}

/**
 * Attach smart alignment guides to the canvas.
 * Shows guides when dragging objects near edges/centers of other objects.
 * Returns a cleanup function.
 */
export function attachSmartGuides(canvas: FabricCanvas): () => void {
  let guides: GuideLine[] = [];

  const clearGuides = () => {
    guides = [];
  };

  const handleMoving = (opt: BasicTransformEvent & { target: FabricObject }) => {
    const target = opt.target;
    if (!target) return;

    const objects = canvas.getObjects().filter((obj) => {
      return obj !== target && getElementId(obj) !== getElementId(target);
    });

    guides = [];

    const targetBounds = target.getBoundingRect();
    const targetCenter = {
      x: targetBounds.left + targetBounds.width / 2,
      y: targetBounds.top + targetBounds.height / 2,
    };
    const targetEdges = {
      left: targetBounds.left,
      right: targetBounds.left + targetBounds.width,
      top: targetBounds.top,
      bottom: targetBounds.top + targetBounds.height,
    };

    for (const obj of objects) {
      const bounds = obj.getBoundingRect();
      const center = {
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      };
      const edges = {
        left: bounds.left,
        right: bounds.left + bounds.width,
        top: bounds.top,
        bottom: bounds.top + bounds.height,
      };

      // Check vertical alignments (left, center, right)
      checkAlignment(targetEdges.left, edges.left, "vertical", guides);
      checkAlignment(targetEdges.left, center.x, "vertical", guides);
      checkAlignment(targetEdges.left, edges.right, "vertical", guides);
      checkAlignment(targetCenter.x, edges.left, "vertical", guides);
      checkAlignment(targetCenter.x, center.x, "vertical", guides);
      checkAlignment(targetCenter.x, edges.right, "vertical", guides);
      checkAlignment(targetEdges.right, edges.left, "vertical", guides);
      checkAlignment(targetEdges.right, center.x, "vertical", guides);
      checkAlignment(targetEdges.right, edges.right, "vertical", guides);

      // Check horizontal alignments (top, center, bottom)
      checkAlignment(targetEdges.top, edges.top, "horizontal", guides);
      checkAlignment(targetEdges.top, center.y, "horizontal", guides);
      checkAlignment(targetEdges.top, edges.bottom, "horizontal", guides);
      checkAlignment(targetCenter.y, edges.top, "horizontal", guides);
      checkAlignment(targetCenter.y, center.y, "horizontal", guides);
      checkAlignment(targetCenter.y, edges.bottom, "horizontal", guides);
      checkAlignment(targetEdges.bottom, edges.top, "horizontal", guides);
      checkAlignment(targetEdges.bottom, center.y, "horizontal", guides);
      checkAlignment(targetEdges.bottom, edges.bottom, "horizontal", guides);
    }

    canvas.requestRenderAll();
  };

  const handleAfterRender = () => {
    if (guides.length === 0) return;

    const ctx = canvas.getContext();
    const zoom = canvas.getZoom();

    ctx.save();
    ctx.strokeStyle = GUIDE_COLOR;
    ctx.lineWidth = GUIDE_LINE_WIDTH / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);

    const width = canvas.width ?? 0;
    const height = canvas.height ?? 0;

    for (const guide of guides) {
      ctx.beginPath();
      if (guide.orientation === "vertical") {
        ctx.moveTo(guide.position, 0);
        ctx.lineTo(guide.position, height / zoom);
      } else {
        ctx.moveTo(0, guide.position);
        ctx.lineTo(width / zoom, guide.position);
      }
      ctx.stroke();
    }

    ctx.restore();
  };

  const handleModified = () => {
    clearGuides();
    canvas.requestRenderAll();
  };

  canvas.on("object:moving", handleMoving);
  canvas.on("after:render", handleAfterRender);
  canvas.on("object:modified", handleModified);

  return () => {
    canvas.off("object:moving", handleMoving);
    canvas.off("after:render", handleAfterRender);
    canvas.off("object:modified", handleModified);
  };
}

function checkAlignment(
  sourcePos: number,
  targetPos: number,
  orientation: "horizontal" | "vertical",
  guides: GuideLine[],
): void {
  if (Math.abs(sourcePos - targetPos) <= SNAP_THRESHOLD) {
    const alreadyExists = guides.some(
      (g) =>
        g.orientation === orientation &&
        Math.abs(g.position - targetPos) < 0.5,
    );
    if (!alreadyExists) {
      guides.push({ orientation, position: targetPos });
    }
  }
}
