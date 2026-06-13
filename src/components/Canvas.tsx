import { useEffect, useRef, useCallback } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { useUIStore, useProjectStore, getActiveProjectPage } from "../stores";
import { useCanvasStore, useCanvasStoreApi } from "./CanvasContext";
import {
  attachCanvasHandlers,
  attachZoomPanHandlers,
  attachHistoryTracking,
  attachUndoRedoShortcuts,
  attachKeyboardShortcuts,
  attachSmartGuides,
  attachTextToolHandlers,
  createPageSheet,
  updatePageSheet,
  fitSheetInView,
  clampPanToSheet,
  renderPageContent,
} from "../canvas";
import { useCanvasDropImport } from "./useCanvasDropImport";
import type { Rect } from "fabric";
import { createPhotoPageProject } from "../projectTemplates";

const CANVAS_DEFAULT_BG = "#1a1a1a";

function restoreCanvasSelection(canvas: FabricCanvas): void {
  const record = canvas as unknown as { __pendingEditTextElementId?: string };
  const pendingEditTextElementId = record.__pendingEditTextElementId;
  const selectedElementId = pendingEditTextElementId ?? useUIStore.getState().selectedElementIds[0];
  if (!selectedElementId) return;

  const object = canvas
    .getObjects()
    .find((obj) => (obj as unknown as { elementId?: string }).elementId === selectedElementId);
  if (!object) return;

  canvas.setActiveObject(object);
  useUIStore.getState().setSelectedElements([selectedElementId]);

  if (pendingEditTextElementId === selectedElementId) {
    const editable = object as unknown as { enterEditing?: () => void; selectAll?: () => void };
    editable.enterEditing?.();
    editable.selectAll?.();
    delete record.__pendingEditTextElementId;
  }
}

export function Canvas() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<Rect | null>(null);
  const sheetSizeRef = useRef<{ width: number; height: number } | null>(null);
  const projectIdRef = useRef<string | null>(null);
  const renderVersionRef = useRef(0);
  const shouldAutoFitOnNextResizeRef = useRef(true);
  const storeApi = useCanvasStoreApi();
  const canvas = useCanvasStore((s) => s.canvas);
  const zoom = useUIStore((s) => s.zoom);
  const panOffset = useUIStore((s) => s.panOffset);
  const currentProject = useProjectStore((s) => s.currentProject);
  const activePageId = useProjectStore((s) => s.activePageId);
  const { handleDragOver, handleDrop } = useCanvasDropImport(canvas, containerRef);

  const handleResize = useCallback((fabricCanvas: FabricCanvas) => {
    const container = containerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    fabricCanvas.setDimensions({ width, height });

    // Re-center/clamp the sheet after resize
    const sheet = sheetRef.current;
    if (sheet) {
      if (shouldAutoFitOnNextResizeRef.current) {
        fitSheetInView(fabricCanvas, sheet);
        shouldAutoFitOnNextResizeRef.current = false;
        return;
      }

      const zoom = fabricCanvas.getZoom();
      const vpt = fabricCanvas.viewportTransform;
      const clamped = clampPanToSheet(fabricCanvas, sheet, zoom, {
        x: vpt[4],
        y: vpt[5],
      });
      vpt[4] = clamped.x;
      vpt[5] = clamped.y;
      fabricCanvas.setViewportTransform([...vpt] as typeof vpt);
      useUIStore.getState().setPanOffset(clamped);
    }

    fabricCanvas.requestRenderAll();
  }, []);

  useEffect(() => {
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;

    const fabricCanvas = new FabricCanvas(canvasEl, {
      backgroundColor: CANVAS_DEFAULT_BG,
      selection: true,
      preserveObjectStacking: true,
    });

    // Set initial dimensions from container
    handleResize(fabricCanvas);

    // Observe container resize
    const resizeObserver = new ResizeObserver(() => {
      handleResize(fabricCanvas);
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    const detachHandlers = attachCanvasHandlers(fabricCanvas);
    const detachZoomPan = attachZoomPanHandlers(fabricCanvas, sheetRef);
    const detachHistory = attachHistoryTracking(fabricCanvas);
    const detachUndoRedoShortcuts = attachUndoRedoShortcuts();
    const detachKeyboardShortcuts = attachKeyboardShortcuts(fabricCanvas);
    const detachSmartGuides = attachSmartGuides(fabricCanvas);
    const detachTextTool = attachTextToolHandlers(fabricCanvas);
    storeApi.getState().setCanvas(fabricCanvas);

    // Create default project if none exists and render page sheet
    let project = useProjectStore.getState().currentProject;
    if (!project) {
      project = createPhotoPageProject();
      useProjectStore.getState().setCurrentProject(project);
    }
    const activePage = getActiveProjectPage(project, useProjectStore.getState().activePageId);
    const width = activePage?.width ?? project.settings.width;
    const height = activePage?.height ?? project.settings.height;
    const background = activePage?.backgroundColor ?? "#ffffff";
    sheetRef.current = createPageSheet(fabricCanvas, width, height, background);
    sheetSizeRef.current = { width, height };
    projectIdRef.current = project.id;
    fitSheetInView(fabricCanvas, sheetRef.current);
    const initialRenderVersion = renderVersionRef.current + 1;
    renderVersionRef.current = initialRenderVersion;
    void renderPageContent(
      fabricCanvas,
      activePage,
      () => renderVersionRef.current === initialRenderVersion,
    ).then(() => {
      if (renderVersionRef.current === initialRenderVersion) {
        restoreCanvasSelection(fabricCanvas);
      }
    });
    shouldAutoFitOnNextResizeRef.current = true;

    return () => {
      detachHandlers();
      detachZoomPan();
      detachHistory();
      detachUndoRedoShortcuts();
      detachKeyboardShortcuts();
      detachSmartGuides();
      detachTextTool();
      renderVersionRef.current += 1;
      resizeObserver.disconnect();
      storeApi.getState().setCanvas(null);
      fabricCanvas.dispose();
    };
  }, [handleResize, storeApi]);

  // Sync zoom from uiStore to Fabric canvas
  useEffect(() => {
    if (!canvas) return;
    canvas.setZoom(zoom);
    canvas.requestRenderAll();
  }, [canvas, zoom]);

  // Sync pan offset from uiStore to Fabric canvas
  useEffect(() => {
    if (!canvas) return;
    const vpt = [...canvas.viewportTransform] as typeof canvas.viewportTransform;
    vpt[4] = panOffset.x;
    vpt[5] = panOffset.y;
    canvas.setViewportTransform(vpt);
    canvas.requestRenderAll();
  }, [canvas, panOffset]);

  // Sync page sheet and page content when the active page/project changes.
  useEffect(() => {
    if (!canvas || !currentProject || !sheetRef.current) return;

    const activePage = getActiveProjectPage(currentProject, activePageId);
    const width = activePage?.width ?? currentProject.settings.width;
    const height = activePage?.height ?? currentProject.settings.height;
    const background = activePage?.backgroundColor ?? "#ffffff";
    const previousSize = sheetSizeRef.current;
    const previousProjectId = projectIdRef.current;
    const sizeChanged =
      !previousSize || previousSize.width !== width || previousSize.height !== height;
    const projectChanged = previousProjectId !== currentProject.id;

    updatePageSheet(canvas, sheetRef.current, width, height, background);
    sheetSizeRef.current = { width, height };
    projectIdRef.current = currentProject.id;

    if (sizeChanged || projectChanged) {
      fitSheetInView(canvas, sheetRef.current);
      shouldAutoFitOnNextResizeRef.current = true;
    }

    const renderVersion = renderVersionRef.current + 1;
    renderVersionRef.current = renderVersion;
    void renderPageContent(canvas, activePage, () => renderVersionRef.current === renderVersion).then(() => {
      if (renderVersionRef.current === renderVersion) {
        restoreCanvasSelection(canvas);
      }
    });
  }, [canvas, currentProject, activePageId]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-neutral-900"
      data-testid="canvas-container"
      onDragOver={handleDragOver}
      onDrop={(e) => void handleDrop(e)}
    >
      <canvas ref={canvasElRef} data-testid="fabric-canvas" />
    </div>
  );
}
