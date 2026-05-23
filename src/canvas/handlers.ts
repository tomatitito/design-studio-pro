import type { Canvas as FabricCanvas, FabricObject, ModifiedEvent } from "fabric";
import type { TEvent } from "fabric";
import { useUIStore } from "../stores";
import { getActiveProjectPage, useProjectStore } from "../stores";

/**
 * We store our application element ID on Fabric objects using this key.
 */
const ELEMENT_ID_KEY = "elementId";
const PAGE_SHEET_FLAG = "isPageSheet";
const PAGE_DRAG_LEFT_KEY = "__pageDragLeft";
const PAGE_DRAG_TOP_KEY = "__pageDragTop";

/**
 * Set the application-level element ID on a Fabric object.
 */
export function setElementId(obj: FabricObject, id: string): void {
  (obj as unknown as Record<string, unknown>)[ELEMENT_ID_KEY] = id;
}

/**
 * Get the application-level element ID from a Fabric object.
 */
export function getElementId(obj: FabricObject): string {
  return (
    ((obj as unknown as Record<string, unknown>)[ELEMENT_ID_KEY] as string) ??
    ""
  );
}

function isPageSheet(obj: FabricObject): boolean {
  return Boolean(
    (obj as unknown as Record<string, unknown>)[PAGE_SHEET_FLAG],
  );
}

function setPageDragPosition(obj: FabricObject): void {
  const record = obj as unknown as Record<string, unknown>;
  record[PAGE_DRAG_LEFT_KEY] = obj.left ?? 0;
  record[PAGE_DRAG_TOP_KEY] = obj.top ?? 0;
}

function getPageDragPosition(obj: FabricObject): { left: number; top: number } {
  const record = obj as unknown as Record<string, unknown>;
  return {
    left: (record[PAGE_DRAG_LEFT_KEY] as number) ?? obj.left ?? 0,
    top: (record[PAGE_DRAG_TOP_KEY] as number) ?? obj.top ?? 0,
  };
}

function getPageSheetOriginFromCanvasObject(target: FabricObject): { left: number; top: number } {
  const canvas = target.canvas;
  const sheet = canvas
    ?.getObjects()
    .find((obj) => (obj as unknown as Record<string, unknown>)[PAGE_SHEET_FLAG]);
  return { left: sheet?.left ?? 0, top: sheet?.top ?? 0 };
}

function persistObjectPosition(target: FabricObject): boolean {
  const id = getElementId(target);
  if (!id) return false;

  const projectStore = useProjectStore.getState();
  const page = getActiveProjectPage(projectStore.currentProject, projectStore.activePageId);
  if (!page) return false;

  const elementIndex = page.elements.findIndex((el) => el.id === id);
  if (elementIndex === -1) return false;

  const origin = getPageSheetOriginFromCanvasObject(target);
  const updatedElements = [...page.elements];
  updatedElements[elementIndex] = {
    ...updatedElements[elementIndex],
    position: {
      x: (target.left ?? 0) - origin.left,
      y: (target.top ?? 0) - origin.top,
    },
    size: {
      width: (target.width ?? 0) * (target.scaleX ?? 1),
      height: (target.height ?? 0) * (target.scaleY ?? 1),
    },
    rotation: target.angle ?? 0,
  };

  projectStore.updatePage(page.id, { elements: updatedElements });
  return true;
}

function bringSelectedImagesToFront(
  canvas: FabricCanvas,
  selected: FabricObject[],
): void {
  let didReorder = false;
  for (const obj of selected) {
    const record = obj as unknown as Record<string, unknown>;
    if (record.type !== "image") continue;

    const bringToFront = record.bringToFront;
    if (typeof bringToFront !== "function") continue;

    (bringToFront as () => void).call(obj);
    didReorder = true;
  }

  if (didReorder) {
    canvas.requestRenderAll();
  }
}

/**
 * Attach canvas event handlers that bridge Fabric.js events to Zustand stores.
 * Returns a cleanup function that removes all listeners.
 */
export function attachCanvasHandlers(canvas: FabricCanvas): () => void {
  const handleSelectionCreated = (
    e: Partial<TEvent> & { selected: FabricObject[] },
  ) => {
    const ids = e.selected.map(getElementId).filter(Boolean);
    useUIStore.getState().setSelectedElements(ids);
    bringSelectedImagesToFront(canvas, e.selected);
  };

  const handleSelectionUpdated = (
    e: Partial<TEvent> & {
      selected: FabricObject[];
      deselected: FabricObject[];
    },
  ) => {
    const ids = e.selected.map(getElementId).filter(Boolean);
    useUIStore.getState().setSelectedElements(ids);
    bringSelectedImagesToFront(canvas, e.selected);
  };

  const handleSelectionCleared = () => {
    useUIStore.getState().clearSelection();
  };

  const handleObjectMoving = (e: Partial<TEvent> & { target?: FabricObject }) => {
    const target = e.target;
    if (!target || !isPageSheet(target)) return;

    const previous = getPageDragPosition(target);
    const nextLeft = target.left ?? 0;
    const nextTop = target.top ?? 0;
    const deltaX = nextLeft - previous.left;
    const deltaY = nextTop - previous.top;

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    for (const obj of canvas.getObjects()) {
      if (obj === target) continue;
      obj.set({
        left: (obj.left ?? 0) + deltaX,
        top: (obj.top ?? 0) + deltaY,
      });
      obj.setCoords();
    }

    setPageDragPosition(target);
    canvas.requestRenderAll();
  };

  const handleObjectModified = (e: ModifiedEvent) => {
    const target = e.target;
    if (!target) return;

    const projectStore = useProjectStore.getState();

    if (isPageSheet(target)) {
      setPageDragPosition(target);

      let didPersist = false;
      for (const obj of canvas.getObjects()) {
        if (obj === target) continue;
        didPersist = persistObjectPosition(obj) || didPersist;
      }

      if (didPersist) {
        projectStore.setDirty(true);
      }
      return;
    }

    if (persistObjectPosition(target)) {
      projectStore.setDirty(true);
    }
  };

  canvas.on("selection:created", handleSelectionCreated);
  canvas.on("selection:updated", handleSelectionUpdated);
  canvas.on("selection:cleared", handleSelectionCleared);
  canvas.on("object:moving", handleObjectMoving);
  canvas.on("object:modified", handleObjectModified);

  return () => {
    canvas.off("selection:created", handleSelectionCreated);
    canvas.off("selection:updated", handleSelectionUpdated);
    canvas.off("selection:cleared", handleSelectionCleared);
    canvas.off("object:moving", handleObjectMoving);
    canvas.off("object:modified", handleObjectModified);
  };
}
