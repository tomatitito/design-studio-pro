import type { Canvas as FabricCanvas, FabricObject, ModifiedEvent } from "fabric";
import type { TEvent } from "fabric";
import { useUIStore } from "../stores";
import { useProjectStore } from "../stores";

/**
 * We store our application element ID on Fabric objects using this key.
 */
const ELEMENT_ID_KEY = "elementId";

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
  };

  const handleSelectionUpdated = (
    e: Partial<TEvent> & {
      selected: FabricObject[];
      deselected: FabricObject[];
    },
  ) => {
    const ids = e.selected.map(getElementId).filter(Boolean);
    useUIStore.getState().setSelectedElements(ids);
  };

  const handleSelectionCleared = () => {
    useUIStore.getState().clearSelection();
  };

  const handleObjectModified = (e: ModifiedEvent) => {
    const target = e.target;
    if (!target) return;

    const id = getElementId(target);
    if (!id) return;

    const projectStore = useProjectStore.getState();
    const project = projectStore.currentProject;
    if (!project) return;

    // Find the page that contains this element and update it
    for (const page of project.pages) {
      const elementIndex = page.elements.findIndex((el) => el.id === id);
      if (elementIndex === -1) continue;

      const updatedElements = [...page.elements];
      updatedElements[elementIndex] = {
        ...updatedElements[elementIndex],
        position: {
          x: target.left ?? 0,
          y: target.top ?? 0,
        },
        size: {
          width: (target.width ?? 0) * (target.scaleX ?? 1),
          height: (target.height ?? 0) * (target.scaleY ?? 1),
        },
        rotation: target.angle ?? 0,
      };

      projectStore.updatePage(page.id, { elements: updatedElements });
      projectStore.setDirty(true);
      break;
    }
  };

  canvas.on("selection:created", handleSelectionCreated);
  canvas.on("selection:updated", handleSelectionUpdated);
  canvas.on("selection:cleared", handleSelectionCleared);
  canvas.on("object:modified", handleObjectModified);

  return () => {
    canvas.off("selection:created", handleSelectionCreated);
    canvas.off("selection:updated", handleSelectionUpdated);
    canvas.off("selection:cleared", handleSelectionCleared);
    canvas.off("object:modified", handleObjectModified);
  };
}
