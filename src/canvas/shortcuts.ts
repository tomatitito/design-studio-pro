import type { Canvas as FabricCanvas } from "fabric";
import { ActiveSelection } from "fabric";
import { useUIStore } from "../stores";
import { useProjectStore } from "../stores";
import { getElementId } from "./handlers";
import { exportPdf } from "./export";

const NUDGE_DISTANCE = 1;
const SHIFT_NUDGE_DISTANCE = 10;

/**
 * Attach general keyboard shortcuts to the canvas.
 * Returns a cleanup function.
 */
export function attachKeyboardShortcuts(canvas: FabricCanvas): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if typing in an input/textarea
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    const isModifier = e.metaKey || e.ctrlKey;

    // Delete/Backspace: Remove selected elements
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelected(canvas);
      return;
    }

    // Escape: Deselect all
    if (e.key === "Escape") {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      useUIStore.getState().clearSelection();
      return;
    }

    // Ctrl/Cmd+A: Select all
    if (isModifier && e.key === "a") {
      e.preventDefault();
      selectAll(canvas);
      return;
    }

    // Ctrl/Cmd+D: Duplicate selection
    if (isModifier && e.key === "d") {
      e.preventDefault();
      void duplicateSelected(canvas);
      return;
    }

    // Ctrl/Cmd+E: Export PDF
    if (isModifier && e.key === "e") {
      e.preventDefault();
      void exportPdf(canvas);
      return;
    }

    // Arrow keys: Nudge selected elements
    const nudge = e.shiftKey ? SHIFT_NUDGE_DISTANCE : NUDGE_DISTANCE;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudgeSelected(canvas, -nudge, 0);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nudgeSelected(canvas, nudge, 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nudgeSelected(canvas, 0, -nudge);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nudgeSelected(canvas, 0, nudge);
    }
  };

  document.addEventListener("keydown", handleKeyDown);

  return () => {
    document.removeEventListener("keydown", handleKeyDown);
  };
}

function selectAll(canvas: FabricCanvas) {
  const objects = canvas
    .getObjects()
    .filter((obj) => obj.selectable !== false);
  if (objects.length === 0) return;

  const selection = new ActiveSelection(objects, { canvas });
  canvas.setActiveObject(selection);
  canvas.requestRenderAll();
  const ids = objects.map(getElementId).filter(Boolean);
  useUIStore.getState().setSelectedElements(ids);
}

function deleteSelected(canvas: FabricCanvas) {
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length === 0) return;

  canvas.discardActiveObject();
  for (const obj of activeObjects) {
    canvas.remove(obj);
  }
  canvas.requestRenderAll();
  useUIStore.getState().clearSelection();
  useProjectStore.getState().setDirty(true);
}

async function duplicateSelected(canvas: FabricCanvas) {
  const active = canvas.getActiveObject();
  if (!active) return;

  const cloned = await active.clone();
  cloned.set({
    left: (cloned.left ?? 0) + 10,
    top: (cloned.top ?? 0) + 10,
  });
  canvas.add(cloned);
  canvas.setActiveObject(cloned);
  canvas.requestRenderAll();
  useProjectStore.getState().setDirty(true);
}

function nudgeSelected(canvas: FabricCanvas, dx: number, dy: number) {
  const active = canvas.getActiveObject();
  if (!active) return;

  active.set({
    left: (active.left ?? 0) + dx,
    top: (active.top ?? 0) + dy,
  });
  active.setCoords();
  canvas.requestRenderAll();
  useProjectStore.getState().setDirty(true);
}
