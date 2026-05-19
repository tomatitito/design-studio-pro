import { useUIStore, useHistoryStore, useProjectStore, type Tool } from "../stores";
import { useCanvasStore } from "./CanvasContext";
import { restoreSnapshot, importImageViaDialog, addImageToCanvas, PAGE_PRESETS, fitSheetInView, clampPanToSheet, exportPdf } from "../canvas";
import type { Rect } from "fabric";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;
const ZOOM_INCREMENT = 0.25;

const TOOLS: { id: Tool; label: string; shortcut: string }[] = [
  { id: "select", label: "Select", shortcut: "V" },
  { id: "text", label: "Text", shortcut: "T" },
  { id: "shape", label: "Shape", shortcut: "S" },
  { id: "image", label: "Image", shortcut: "I" },
];

type PageSheetRect = Rect & { isPageSheet?: boolean };

export function Toolbar() {
  const selectedTool = useUIStore((s) => s.selectedTool);
  const setSelectedTool = useUIStore((s) => s.setSelectedTool);
  const zoom = useUIStore((s) => s.zoom);
  const setZoom = useUIStore((s) => s.setZoom);
  const setPanOffset = useUIStore((s) => s.setPanOffset);
  const canvas = useCanvasStore((s) => s.canvas);

  const handleZoomIn = () => {
    const newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_INCREMENT);
    applyZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_INCREMENT);
    applyZoom(newZoom);
  };

  const handleZoomReset = () => {
    applyZoom(1);
  };

  const getSheet = (): Rect | null => {
    if (!canvas) return null;
    return (
      (canvas.getObjects() as PageSheetRect[]).find((object) => object.isPageSheet) ?? null
    );
  };

  const handleZoomFit = () => {
    if (!canvas) return;
    const sheet = getSheet();
    if (sheet) {
      fitSheetInView(canvas, sheet);
    }
  };

  const applyZoom = (newZoom: number) => {
    if (!canvas) return;
    const center = canvas.getCenterPoint();
    canvas.zoomToPoint(center, newZoom);

    const sheet = getSheet();
    if (sheet) {
      const vpt = [...canvas.viewportTransform] as typeof canvas.viewportTransform;
      const clamped = clampPanToSheet(canvas, sheet, newZoom, {
        x: vpt[4],
        y: vpt[5],
      });
      vpt[4] = clamped.x;
      vpt[5] = clamped.y;
      canvas.setViewportTransform(vpt);
      setZoom(newZoom);
      setPanOffset(clamped);
    } else {
      const vpt = canvas.viewportTransform;
      setZoom(newZoom);
      setPanOffset({ x: vpt[4], y: vpt[5] });
    }
    canvas.requestRenderAll();
  };

  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  const currentPresetIndex = currentProject
    ? PAGE_PRESETS.findIndex(
        (p) =>
          p.widthMm === currentProject.settings.width &&
          p.heightMm === currentProject.settings.height,
      )
    : 0;

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = PAGE_PRESETS[Number(e.target.value)];
    if (!preset || !currentProject) return;
    setCurrentProject({
      ...currentProject,
      settings: {
        ...currentProject.settings,
        width: preset.widthMm,
        height: preset.heightMm,
      },
      modifiedAt: new Date().toISOString(),
    });
  };

  const handleImageImport = async () => {
    if (!canvas) return;
    const asset = await importImageViaDialog();
    if (!asset) return;
    await addImageToCanvas(canvas, asset);
    setSelectedTool("select");
  };

  const handleToolClick = (toolId: Tool) => {
    if (toolId === "image") {
      handleImageImport().catch((err) => {
        console.error("Image import failed:", err);
      });
      return;
    }
    setSelectedTool(toolId);
  };

  const handleExportPdf = () => {
    if (!canvas) return;
    void exportPdf(canvas);
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      className="flex items-center gap-1 border-b border-neutral-700 bg-neutral-800 px-2 py-1"
      data-testid="toolbar"
    >
      {/* Tool selection */}
      <div className="flex items-center gap-0.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool.id)}
            className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              selectedTool === tool.id
                ? "bg-blue-600 text-white"
                : "text-neutral-300 hover:bg-neutral-700 hover:text-white"
            }`}
            title={`${tool.label} (${tool.shortcut})`}
            data-testid={`tool-${tool.id}`}
          >
            {tool.label}
          </button>
        ))}
      </div>

      {/* Page size picker */}
      <div className="flex items-center gap-1">
        <select
          value={currentPresetIndex === -1 ? "" : currentPresetIndex}
          onChange={handlePageSizeChange}
          className="rounded bg-neutral-700 px-2 py-1 text-xs text-neutral-200 outline-none hover:bg-neutral-600 focus:ring-1 focus:ring-blue-500"
          title="Page Size"
          data-testid="page-size-select"
        >
          {PAGE_PRESETS.map((preset, i) => (
            <option key={preset.label} value={i}>
              {preset.label} ({preset.widthMm}x{preset.heightMm}mm)
            </option>
          ))}
        </select>
      </div>

      {/* Separator */}
      <div className="mx-2 h-5 w-px bg-neutral-600" />

      {/* Undo/Redo */}
      <UndoRedoButtons />

      {/* Separator */}
      <div className="mx-2 h-5 w-px bg-neutral-600" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleZoomOut}
          className="rounded px-2 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white"
          title="Zoom Out"
          data-testid="zoom-out"
        >
          -
        </button>
        <span
          className="min-w-[3.5rem] text-center text-xs text-neutral-300"
          data-testid="zoom-level"
        >
          {zoomPercent}%
        </span>
        <button
          onClick={handleZoomIn}
          className="rounded px-2 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white"
          title="Zoom In"
          data-testid="zoom-in"
        >
          +
        </button>
        <button
          onClick={handleZoomReset}
          className="rounded px-2 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white"
          title="Reset Zoom (100%)"
          data-testid="zoom-reset"
        >
          100%
        </button>
        <button
          onClick={handleZoomFit}
          className="rounded px-2 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white"
          title="Fit to Screen"
          data-testid="zoom-fit"
        >
          Fit
        </button>
      </div>

      {/* Separator */}
      <div className="mx-2 h-5 w-px bg-neutral-600" />

      {/* Export */}
      <button
        onClick={handleExportPdf}
        className="rounded px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700 hover:text-white"
        title="Export PDF (Ctrl+E)"
        data-testid="export-pdf"
      >
        Export PDF
      </button>
    </div>
  );
}

function UndoRedoButtons() {
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  const handleUndo = () => {
    undo();
    const present = useHistoryStore.getState().present;
    if (present) {
      restoreSnapshot(present as Parameters<typeof restoreSnapshot>[0]);
    }
  };

  const handleRedo = () => {
    redo();
    const present = useHistoryStore.getState().present;
    if (present) {
      restoreSnapshot(present as Parameters<typeof restoreSnapshot>[0]);
    }
  };

  const disabledClass = "opacity-40 cursor-not-allowed";

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        className={`rounded px-2 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white ${!canUndo ? disabledClass : ""}`}
        title="Undo (Ctrl+Z)"
        data-testid="undo"
      >
        Undo
      </button>
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        className={`rounded px-2 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white ${!canRedo ? disabledClass : ""}`}
        title="Redo (Ctrl+Shift+Z)"
        data-testid="redo"
      >
        Redo
      </button>
    </div>
  );
}
