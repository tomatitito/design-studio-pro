import { useMemo, useState } from "react";
import {
  BACKGROUND_PRESETS,
  getBackgroundPreviewStyle,
  applyBorderToImageElements,
  applyBorderToCanvasObjects,
  collectTargetImageIds,
  IMAGE_BORDER_STYLE_PRESETS,
  resolveImageBorderStyle,
  type ImageBorderStyleId,
} from "../canvas";
import { useProjectStore, useUIStore, type Panel } from "../stores";
import { useCanvasStore } from "./CanvasContext";
import { AssetLibrary } from "./AssetLibrary";

const PANELS: { id: Panel; label: string }[] = [
  { id: "layers", label: "Layers" },
  { id: "properties", label: "Props" },
  { id: "assets", label: "Assets" },
  { id: "pages", label: "Pages" },
];

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const activePanel = useUIStore((s) => s.activePanel);
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const currentProject = useProjectStore((s) => s.currentProject);
  const selectedElementIds = useUIStore((s) => s.selectedElementIds);
  const updatePage = useProjectStore((s) => s.updatePage);
  const setDirty = useProjectStore((s) => s.setDirty);
  const canvas = useCanvasStore((s) => s.canvas);
  const [borderColor, setBorderColor] = useState("#000000");
  const [borderWidth, setBorderWidth] = useState(2);
  const [borderStyle, setBorderStyle] = useState<ImageBorderStyleId>("custom");
  const currentPage = currentProject?.pages[0] ?? null;
  const activeSolidColor = useMemo(() => {
    if (!currentPage) return "#ffffff";
    return currentPage.backgroundColor.startsWith("#") ? currentPage.backgroundColor : "#ffffff";
  }, [currentPage]);

  const applyBackground = (backgroundColor: string) => {
    if (!currentPage) return;
    updatePage(currentPage.id, { backgroundColor });
    setDirty(true);
  };

  const applyImageBorder = (mode: "selected" | "all") => {
    if (!currentPage) return;
    const resolvedStyle = resolveImageBorderStyle(
      borderStyle,
      borderColor,
      borderWidth,
    );
    const targetIds = collectTargetImageIds(
      currentPage.elements,
      mode,
      selectedElementIds,
    );
    if (targetIds.length === 0) return;

    const elements = applyBorderToImageElements(currentPage.elements, {
      mode,
      selectedIds: selectedElementIds,
      styleId: borderStyle,
      borderColor: borderColor,
      borderWidth: borderWidth,
    });

    updatePage(currentPage.id, { elements });
    setDirty(true);

    if (canvas) {
      applyBorderToCanvasObjects(canvas, targetIds, resolvedStyle);
    }
  };

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col border-l border-neutral-700 bg-neutral-800">
        <button
          onClick={toggleSidebar}
          className="px-2 py-3 text-xs text-neutral-400 hover:text-white"
          title="Open sidebar"
          data-testid="sidebar-expand"
        >
          &laquo;
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex w-64 flex-col border-l border-neutral-700 bg-neutral-800"
      data-testid="sidebar"
    >
      {/* Panel tabs */}
      <div className="flex items-center border-b border-neutral-700">
        {PANELS.map((panel) => (
          <button
            key={panel.id}
            onClick={() => setActivePanel(panel.id)}
            className={`flex-1 px-1 py-2 text-[11px] font-medium transition-colors ${
              activePanel === panel.id
                ? "border-b-2 border-blue-500 text-white"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            data-testid={`panel-tab-${panel.id}`}
          >
            {panel.label}
          </button>
        ))}
        <button
          onClick={toggleSidebar}
          className="px-2 py-2 text-xs text-neutral-400 hover:text-white"
          title="Close sidebar"
          data-testid="sidebar-collapse"
        >
          &raquo;
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === "assets" && <AssetLibrary />}

        {activePanel === "layers" && (
          <div className="p-3 text-xs text-neutral-500">Layers panel</div>
        )}

        {activePanel === "properties" && (
          <div className="space-y-4 p-3 text-xs text-neutral-300">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Photo Sheet Background
              </div>
              <label className="flex items-center gap-3 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2">
                <input
                  type="color"
                  value={activeSolidColor}
                  onChange={(event) => applyBackground(event.target.value)}
                  className="h-9 w-10 rounded border-0 bg-transparent p-0"
                  data-testid="background-color-input"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-white">Custom solid</div>
                  <div className="truncate text-[10px] text-neutral-500">
                    {currentPage?.backgroundColor ?? "#ffffff"}
                  </div>
                </div>
              </label>
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Presets
              </div>
              <div className="grid grid-cols-2 gap-2">
                {BACKGROUND_PRESETS.map((preset) => {
                  const isActive = currentPage?.backgroundColor === preset.spec;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyBackground(preset.spec)}
                      className={`rounded-lg border p-2 text-left transition ${
                        isActive
                          ? "border-blue-400 bg-neutral-900"
                          : "border-neutral-700 bg-neutral-900/60 hover:border-neutral-500"
                      }`}
                      data-testid={`background-preset-${preset.id}`}
                    >
                      <div
                        className="mb-2 h-14 rounded-md border border-white/10"
                        style={{
                          background: getBackgroundPreviewStyle(preset.preview),
                        }}
                      />
                      <div className="text-[11px] font-medium text-white">{preset.label}</div>
                      <div className="truncate text-[10px] text-neutral-500">{preset.id}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Picture Border
              </div>
              <div className="space-y-2 rounded-md border border-neutral-700 bg-neutral-900/60 p-3">
                <label className="flex items-center justify-between gap-3 text-[11px] text-neutral-300">
                  <span>Style</span>
                  <select
                    value={borderStyle}
                    onChange={(event) => {
                      const nextStyle = event.target.value as ImageBorderStyleId;
                      const resolved = resolveImageBorderStyle(nextStyle);
                      setBorderStyle(nextStyle);
                      setBorderColor(resolved.borderColor);
                      setBorderWidth(resolved.borderWidth);
                    }}
                    className="w-32 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-[11px] text-white"
                    data-testid="image-border-style-select"
                  >
                    {IMAGE_BORDER_STYLE_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center justify-between gap-3 text-[11px] text-neutral-300">
                  <span>Color</span>
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(event) => setBorderColor(event.target.value)}
                    className="h-7 w-9 rounded border-0 bg-transparent p-0"
                    data-testid="image-border-color-input"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 text-[11px] text-neutral-300">
                  <span>Width</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={borderWidth}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      setBorderWidth(Number.isFinite(parsed) ? parsed : 0);
                    }}
                    className="w-16 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-right text-[11px] text-white"
                    data-testid="image-border-width-input"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => applyImageBorder("selected")}
                    className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-[11px] text-white transition hover:border-neutral-400"
                    data-testid="apply-image-border-selected"
                  >
                    Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => applyImageBorder("all")}
                    className="rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-[11px] text-white transition hover:border-neutral-400"
                    data-testid="apply-image-border-all"
                  >
                    All Images
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activePanel === "pages" && <div className="p-3 text-xs text-neutral-500">Pages panel</div>}
      </div>
    </div>
  );
}
