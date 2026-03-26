import { useEffect, useRef, useCallback, type DragEvent } from "react";
import { Canvas as FabricCanvas } from "fabric";
import { invoke } from "@tauri-apps/api/core";
import { useUIStore, useProjectStore } from "../stores";
import { useCanvasStore, useCanvasStoreApi } from "./CanvasContext";
import {
  attachCanvasHandlers,
  attachZoomPanHandlers,
  attachHistoryTracking,
  attachUndoRedoShortcuts,
  attachKeyboardShortcuts,
  attachSmartGuides,
  createPageSheet,
  updatePageSheet,
  fitSheetInView,
  clampPanToSheet,
  getDroppedImageFiles,
  addImageToCanvas,
  screenToCanvas,
} from "../canvas";
import type { Rect } from "fabric";
import type { Project, Asset } from "../types";

const CANVAS_DEFAULT_BG = "#1a1a1a";

const DEFAULT_PROJECT: Project = {
  id: "default",
  name: "Untitled",
  pages: [
    {
      id: "page-1",
      name: "Page 1",
      elements: [],
      width: 210,
      height: 297,
      backgroundColor: "#ffffff",
      order: 0,
    },
  ],
  createdAt: new Date().toISOString(),
  modifiedAt: new Date().toISOString(),
  settings: {
    width: 210,
    height: 297,
    orientation: "portrait",
    unit: "mm",
  },
};

export function Canvas() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<Rect | null>(null);
  const sheetSizeRef = useRef<{ width: number; height: number } | null>(null);
  const projectIdRef = useRef<string | null>(null);
  const shouldAutoFitOnNextResizeRef = useRef(true);
  const storeApi = useCanvasStoreApi();
  const canvas = useCanvasStore((s) => s.canvas);
  const zoom = useUIStore((s) => s.zoom);
  const panOffset = useUIStore((s) => s.panOffset);
  const currentProject = useProjectStore((s) => s.currentProject);

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
    storeApi.getState().setCanvas(fabricCanvas);

    // Create default project if none exists and render page sheet
    let project = useProjectStore.getState().currentProject;
    if (!project) {
      useProjectStore.getState().setCurrentProject(DEFAULT_PROJECT);
      project = DEFAULT_PROJECT;
    }
    const { width, height } = project.settings;
    const background = project.pages[0]?.backgroundColor ?? "#ffffff";
    sheetRef.current = createPageSheet(fabricCanvas, width, height, background);
    sheetSizeRef.current = { width, height };
    projectIdRef.current = project.id;
    fitSheetInView(fabricCanvas, sheetRef.current);
    shouldAutoFitOnNextResizeRef.current = true;

    return () => {
      detachHandlers();
      detachZoomPan();
      detachHistory();
      detachUndoRedoShortcuts();
      detachKeyboardShortcuts();
      detachSmartGuides();
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

  // Sync page sheet when project settings change
  useEffect(() => {
    if (!canvas || !currentProject || !sheetRef.current) return;
    const { width, height } = currentProject.settings;
    const background = currentProject.pages[0]?.backgroundColor ?? "#ffffff";
    const previousSize = sheetSizeRef.current;
    const previousProjectId = projectIdRef.current;
    const sizeChanged =
      !previousSize ||
      previousSize.width !== width ||
      previousSize.height !== height;
    const projectChanged = previousProjectId !== currentProject.id;

    updatePageSheet(canvas, sheetRef.current, width, height, background);
    sheetSizeRef.current = { width, height };
    projectIdRef.current = currentProject.id;

    if (sizeChanged || projectChanged) {
      fitSheetInView(canvas, sheetRef.current);
      shouldAutoFitOnNextResizeRef.current = true;
    }
  }, [canvas, currentProject]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!canvas) return;

      const imageFiles = getDroppedImageFiles(e.nativeEvent);
      if (imageFiles.length === 0) return;

      // Convert drop position from screen to canvas coordinates
      const containerRect = containerRef.current?.getBoundingClientRect();
      const currentZoom = useUIStore.getState().zoom;
      const currentPanOffset = useUIStore.getState().panOffset;
      const dropScreenPos = {
        x: e.clientX - (containerRect?.left ?? 0),
        y: e.clientY - (containerRect?.top ?? 0),
      };
      const dropCanvasPos = screenToCanvas(dropScreenPos, currentZoom, currentPanOffset);

      for (const file of imageFiles) {
        const asset = await invoke<Asset>("import_asset", {
          name: file.name,
          filePath: file.name,
          projectDir: null,
        });
        await addImageToCanvas(canvas, asset, dropCanvasPos);
      }
    },
    [canvas],
  );

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
