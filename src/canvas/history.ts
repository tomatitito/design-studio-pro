import type { Canvas as FabricCanvas } from "fabric";
import { useHistoryStore } from "../stores";
import { useProjectStore } from "../stores";
import type { Element } from "../types";

const DEBOUNCE_MS = 300;

interface CanvasSnapshot {
  pageId: string;
  elements: Element[];
}

/**
 * Attach history tracking to canvas operations.
 * Captures element state before/after modifications and pushes to historyStore.
 * Debounces rapid changes (e.g., continuous dragging) to a single undo step.
 * Returns a cleanup function.
 */
export function attachHistoryTracking(canvas: FabricCanvas): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function getCurrentSnapshot(): CanvasSnapshot | null {
    const project = useProjectStore.getState().currentProject;
    if (!project || project.pages.length === 0) return null;
    // Use the first page or the active page
    const page = project.pages[0];
    return {
      pageId: page.id,
      elements: structuredClone(page.elements),
    };
  }

  function pushSnapshot() {
    const snapshot = getCurrentSnapshot();
    if (snapshot) {
      useHistoryStore.getState().push(snapshot);
    }
  }

  function debouncedPush() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      pushSnapshot();
      debounceTimer = null;
    }, DEBOUNCE_MS);
  }

  const handleModified = () => {
    debouncedPush();
  };

  const handleAdded = () => {
    debouncedPush();
  };

  const handleRemoved = () => {
    debouncedPush();
  };

  // Capture initial state
  pushSnapshot();

  canvas.on("object:modified", handleModified);
  canvas.on("object:added", handleAdded);
  canvas.on("object:removed", handleRemoved);

  return () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    canvas.off("object:modified", handleModified);
    canvas.off("object:added", handleAdded);
    canvas.off("object:removed", handleRemoved);
  };
}

/**
 * Restore a canvas snapshot by updating the project store.
 * The canvas should re-render based on the store update.
 */
export function restoreSnapshot(snapshot: CanvasSnapshot): void {
  const projectStore = useProjectStore.getState();
  projectStore.updatePage(snapshot.pageId, {
    elements: snapshot.elements,
  });
}

/**
 * Attach keyboard shortcuts for undo/redo.
 * Ctrl/Cmd+Z for undo, Ctrl/Cmd+Shift+Z for redo.
 * Returns a cleanup function.
 */
export function attachUndoRedoShortcuts(): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    const isModifier = e.metaKey || e.ctrlKey;
    if (!isModifier) return;

    if (e.key === "z" && e.shiftKey) {
      // Redo
      e.preventDefault();
      const history = useHistoryStore.getState();
      if (history.canRedo()) {
        history.redo();
        const present = useHistoryStore.getState().present as CanvasSnapshot | null;
        if (present) {
          restoreSnapshot(present);
        }
      }
    } else if (e.key === "z") {
      // Undo
      e.preventDefault();
      const history = useHistoryStore.getState();
      if (history.canUndo()) {
        history.undo();
        const present = useHistoryStore.getState().present as CanvasSnapshot | null;
        if (present) {
          restoreSnapshot(present);
        }
      }
    }
  };

  document.addEventListener("keydown", handleKeyDown);

  return () => {
    document.removeEventListener("keydown", handleKeyDown);
  };
}
