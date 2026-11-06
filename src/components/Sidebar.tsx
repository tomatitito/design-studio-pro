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
import { selectActivePage, useProjectStore, useUIStore, type Panel } from "../stores";
import { useCanvasStore } from "./CanvasContext";
import { AssetLibrary } from "./AssetLibrary";
import { PropsExtensions } from "../extensions/PropsExtensions";
import {
  CALENDAR_FONT_OPTIONS,
  getTextAlign,
  getTextFontWeight,
  getTextLetterSpacing,
} from "../textStyles";
import {
  applyCalendarPhotoLayoutPreset,
  CALENDAR_PHOTO_LAYOUT_PRESETS,
} from "../calendarContracts";
import { findElementById, updateElementById } from "../elementTree";
import { getOrderedUnits, getPhysicalPages } from "../spreads";
import type { Page, ProjectUnit, Spread, TextAlign, TextElement } from "../types";

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
  const activePageId = useProjectStore((s) => s.activePageId);
  const selectedElementIds = useUIStore((s) => s.selectedElementIds);
  const setActivePage = useProjectStore((s) => s.setActivePage);
  const addPage = useProjectStore((s) => s.addPage);
  const updatePage = useProjectStore((s) => s.updatePage);
  const insertSpreadAfter = useProjectStore((s) => s.insertSpreadAfter);
  const deleteSpread = useProjectStore((s) => s.deleteSpread);
  const deleteSinglePage = useProjectStore((s) => s.deleteSinglePage);
  const moveUnit = useProjectStore((s) => s.moveUnit);
  const setDirty = useProjectStore((s) => s.setDirty);
  const canvas = useCanvasStore((s) => s.canvas);
  const [borderColor, setBorderColor] = useState("#000000");
  const [borderWidth, setBorderWidth] = useState(2);
  const [borderStyle, setBorderStyle] = useState<ImageBorderStyleId>("custom");
  const [alignmentPrompt, setAlignmentPrompt] = useState<{ afterUnitId: string } | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<{ pageId: string } | null>(null);
  const currentPage = useProjectStore(selectActivePage);
  const orderedPages = useMemo(
    () => [...(currentProject?.pages ?? [])].sort((a, b) => a.order - b.order),
    [currentProject?.pages],
  );
  const pageUnits = useMemo(() => (currentProject ? getOrderedUnits(currentProject) : []), [currentProject]);
  const physicalPages = useMemo(() => (currentProject ? getPhysicalPages(currentProject) : []), [currentProject]);
  const canDeletePages = physicalPages.length > 1;
  const activeSolidColor = useMemo(() => {
    if (!currentPage) return "#ffffff";
    return currentPage.backgroundColor.startsWith("#") ? currentPage.backgroundColor : "#ffffff";
  }, [currentPage]);
  const selectedTextElement = useMemo<TextElement | null>(() => {
    if (!currentPage || selectedElementIds.length !== 1) return null;
    const element = findElementById(currentPage.elements, selectedElementIds[0]);
    return element?.elementType === "text" ? element : null;
  }, [currentPage, selectedElementIds]);
  const calendarPhotoLayoutGroups = useMemo(
    () =>
      [1, 2, 3, 4].map((count) => ({
        count,
        presets: CALENDAR_PHOTO_LAYOUT_PRESETS.filter((preset) => preset.photoCount === count),
      })),
    [],
  );
  const showCalendarPhotoLayouts =
    currentProject?.projectType === "calendar" && currentPage?.role === "month";
  const showCalendarTitleLayoutHelp =
    currentProject?.projectType === "calendar" && currentPage?.role === "title";

  const applyBackground = (backgroundColor: string) => {
    if (!currentPage) return;
    updatePage(currentPage.id, { backgroundColor });
    setDirty(true);
  };

  const createPageId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `page-${Date.now()}`;
  };

  const createBlankPage = (name: string, pageKind?: Page["pageKind"]): Page => ({
    id: createPageId(),
    name,
    elements: [],
    width: currentProject?.settings.width ?? 210,
    height: currentProject?.settings.height ?? 297,
    backgroundColor: "#ffffff",
    order: orderedPages.length,
    pageKind,
  });

  const createSpread = (): { spread: Spread; leftPage: Page; rightPage: Page } => {
    const id = createPageId();
    const leftPage = createBlankPage(`Spread ${pageUnits.length + 1} left`);
    const rightPage = createBlankPage(`Spread ${pageUnits.length + 1} right`);
    leftPage.id = `${id}-left`;
    rightPage.id = `${id}-right`;
    return {
      spread: {
        id: `spread-${id}`,
        name: `Spread ${pageUnits.length + 1}`,
        leftPageId: leftPage.id,
        rightPageId: rightPage.id,
        elements: [],
      },
      leftPage,
      rightPage,
    };
  };

  const handleAddPage = () => {
    if (!currentProject) return;
    const page = createBlankPage(`Page ${orderedPages.length + 1}`);

    addPage(page);
    setActivePage(page.id);
    setDirty(true);
  };

  const getActiveUnit = (): ProjectUnit | null => {
    if (!currentProject) return null;
    return (
      pageUnits.find((unit) => {
        if (unit.unitType === "single") return unit.pageId === activePageId;
        const spread = currentProject.spreads?.find((item) => item.id === unit.spreadId);
        return spread?.leftPageId === activePageId || spread?.rightPageId === activePageId;
      }) ?? pageUnits[pageUnits.length - 1] ?? null
    );
  };

  const insertSpreadAfterUnit = (afterUnitId: string) => {
    const { spread, leftPage, rightPage } = createSpread();
    const result = insertSpreadAfter(afterUnitId, spread, leftPage, rightPage);
    if (result.status === "requires-blank") {
      setAlignmentPrompt({ afterUnitId });
      return;
    }
    if (result.status === "reserved-opening") return;
    setAlignmentPrompt(null);
    setActivePage(leftPage.id);
    setDirty(true);
  };

  const handleAddSpread = () => {
    const unit = getActiveUnit();
    if (!unit) return;
    insertSpreadAfterUnit(unit.id);
  };

  const handleInsertEditableBlankThenSpread = () => {
    if (!currentProject || !alignmentPrompt) return;
    const afterIndex = pageUnits.findIndex((unit) => unit.id === alignmentPrompt.afterUnitId);
    const blank = createBlankPage("Editable blank page", "editable-blank");
    addPage(blank);
    const moved = moveUnit(`unit-${blank.id}`, afterIndex + 1);
    if (moved.status !== "moved") return;
    const next = createSpread();
    const result = insertSpreadAfter(`unit-${blank.id}`, next.spread, next.leftPage, next.rightPage);
    if (result.status === "inserted") {
      setActivePage(next.leftPage.id);
      setAlignmentPrompt(null);
      setDirty(true);
    }
  };

  const handleSelectPage = (pageId: string) => {
    if (pageId === activePageId) return;
    setActivePage(pageId);
  };

  const handleDeletePage = (pageId: string) => {
    if (!canDeletePages) return;
    const result = deleteSinglePage(pageId);
    if (result.status === "requires-blank-replacement") {
      setDeletePrompt({ pageId });
      return;
    }
    if (result.status === "deleted") setDirty(true);
  };

  const handleDeleteWithBlankReplacement = () => {
    if (!deletePrompt) return;
    const result = deleteSinglePage(deletePrompt.pageId, true);
    if (result.status === "deleted") {
      setDeletePrompt(null);
      setDirty(true);
    }
  };

  const handleDeleteSpread = (spreadId: string) => {
    if (!canDeletePages) return;
    deleteSpread(spreadId);
    setDirty(true);
  };

  const handleMoveUnit = (unitId: string, toIndex: number) => {
    const result = moveUnit(unitId, toIndex);
    if (result.status === "moved") setDirty(true);
  };

  const updateSelectedText = (
    patch: Partial<
      Pick<
        TextElement,
        | "content"
        | "fontFamily"
        | "fontSize"
        | "color"
        | "fontWeight"
        | "textAlign"
        | "letterSpacing"
      >
    >,
  ) => {
    if (!currentPage || !selectedTextElement) return;
    const { elements, updated } = updateElementById(currentPage.elements, selectedTextElement.id, (element) =>
      element.elementType === "text" ? { ...element, ...patch } : element,
    );
    if (!updated) return;

    updatePage(currentPage.id, { elements });
    setDirty(true);

    const fabricUpdate: Record<string, unknown> = {};
    if (patch.content !== undefined) fabricUpdate.text = patch.content;
    if (patch.fontFamily !== undefined) fabricUpdate.fontFamily = patch.fontFamily;
    if (patch.fontSize !== undefined) fabricUpdate.fontSize = patch.fontSize;
    if (patch.color !== undefined) fabricUpdate.fill = patch.color;
    if (patch.fontWeight !== undefined) fabricUpdate.fontWeight = patch.fontWeight;
    if (patch.textAlign !== undefined) fabricUpdate.textAlign = patch.textAlign;
    if (patch.letterSpacing !== undefined) fabricUpdate.charSpacing = patch.letterSpacing * 1000;

    const fabricText = canvas
      ?.getObjects()
      .find(
        (obj) => (obj as unknown as { elementId?: string }).elementId === selectedTextElement.id,
      ) as unknown as
      | { set?: (update: Record<string, unknown>) => void; setCoords?: () => void }
      | undefined;
    fabricText?.set?.(fabricUpdate);
    fabricText?.setCoords?.();
    canvas?.requestRenderAll();
  };

  const applyCalendarPhotoLayout = (presetId: string) => {
    if (!currentPage) return;
    const nextPage = applyCalendarPhotoLayoutPreset(currentPage, presetId);
    if (nextPage === currentPage) return;
    updatePage(currentPage.id, { elements: nextPage.elements });
    setDirty(true);
  };

  const applyImageBorder = (mode: "selected" | "all") => {
    if (!currentPage) return;
    const resolvedStyle = resolveImageBorderStyle(borderStyle, borderColor, borderWidth);
    const targetIds = collectTargetImageIds(currentPage.elements, mode, selectedElementIds);
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
      <div className="flex h-full min-h-0 flex-col border-l border-neutral-700 bg-neutral-800">
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
      className="flex h-full min-h-0 w-64 flex-col border-l border-neutral-700 bg-neutral-800"
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
      <div className="min-h-0 flex-1 overflow-hidden">
        {activePanel === "assets" && <AssetLibrary />}

        {activePanel === "layers" && (
          <div className="p-3 text-xs text-neutral-500">Layers panel</div>
        )}

        {activePanel === "properties" && (
          <div
            className="h-full space-y-4 overflow-y-auto p-3 text-xs text-neutral-300"
            data-testid="properties-panel"
          >
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

            <PropsExtensions />

            {showCalendarTitleLayoutHelp && (
              <div
                className="rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-[11px] text-blue-100"
                data-testid="calendar-title-layout-help"
              >
                Photo layout presets are available on month pages. Select January or another month
                in Pages to change its photo layout.
              </div>
            )}

            {showCalendarPhotoLayouts && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Calendar Photo Layout
                </div>
                <div className="space-y-3 rounded-md border border-neutral-700 bg-neutral-900/60 p-3">
                  {calendarPhotoLayoutGroups.map(({ count, presets }) => (
                    <div key={count}>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        {count} photo{count === 1 ? "" : "s"}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {presets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyCalendarPhotoLayout(preset.id)}
                            className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-left text-[11px] text-white transition hover:border-blue-400"
                            data-testid={`calendar-photo-layout-${preset.id}`}
                          >
                            <span className="block font-medium">{preset.label}</span>
                            <span className="text-[10px] text-neutral-500">
                              {preset.photoCount} slots
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTextElement && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Text
                </div>
                <div className="space-y-3 rounded-md border border-neutral-700 bg-neutral-900/60 p-3">
                  <label className="block">
                    <span className="mb-2 block text-[11px] text-neutral-300">Content</span>
                    <textarea
                      value={selectedTextElement.content}
                      onChange={(event) => updateSelectedText({ content: event.target.value })}
                      className="min-h-24 w-full rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-[11px] text-white"
                      data-testid="text-content-input"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 text-[11px] text-neutral-300">
                    <span>Font</span>
                    <select
                      value={selectedTextElement.fontFamily}
                      onChange={(event) => updateSelectedText({ fontFamily: event.target.value })}
                      className="w-36 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-[11px] text-white"
                      data-testid="text-font-family-select"
                    >
                      {!CALENDAR_FONT_OPTIONS.some(
                        (font) => font.family === selectedTextElement.fontFamily,
                      ) && <option value={selectedTextElement.fontFamily}>Current font</option>}
                      {CALENDAR_FONT_OPTIONS.map((font) => (
                        <option key={font.id} value={font.family} title={font.description}>
                          {font.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-neutral-300">
                      <span className="mb-1 block">Size</span>
                      <input
                        type="number"
                        min={4}
                        max={160}
                        step={1}
                        value={selectedTextElement.fontSize}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          updateSelectedText({ fontSize: Number.isFinite(parsed) ? parsed : 4 });
                        }}
                        className="w-full rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-right text-[11px] text-white"
                        data-testid="text-font-size-input"
                      />
                    </label>
                    <label className="text-[11px] text-neutral-300">
                      <span className="mb-1 block">Letter</span>
                      <input
                        type="number"
                        min={-5}
                        max={20}
                        step={0.1}
                        value={getTextLetterSpacing(selectedTextElement)}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          updateSelectedText({
                            letterSpacing: Number.isFinite(parsed) ? parsed : 0,
                          });
                        }}
                        className="w-full rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-right text-[11px] text-white"
                        data-testid="text-letter-spacing-input"
                      />
                    </label>
                  </div>

                  <label className="flex items-center justify-between gap-3 text-[11px] text-neutral-300">
                    <span>Color</span>
                    <input
                      type="color"
                      value={selectedTextElement.color}
                      onChange={(event) => updateSelectedText({ color: event.target.value })}
                      className="h-7 w-9 rounded border-0 bg-transparent p-0"
                      data-testid="text-color-input"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 text-[11px] text-neutral-300">
                    <span>Weight</span>
                    <select
                      value={getTextFontWeight(selectedTextElement)}
                      onChange={(event) => updateSelectedText({ fontWeight: event.target.value })}
                      className="w-28 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-[11px] text-white"
                      data-testid="text-font-weight-select"
                    >
                      <option value="300">Light</option>
                      <option value="400">Regular</option>
                      <option value="600">Semi Bold</option>
                      <option value="700">Bold</option>
                    </select>
                  </label>

                  <label className="flex items-center justify-between gap-3 text-[11px] text-neutral-300">
                    <span>Align</span>
                    <select
                      value={getTextAlign(selectedTextElement)}
                      onChange={(event) =>
                        updateSelectedText({ textAlign: event.target.value as TextAlign })
                      }
                      className="w-28 rounded border border-neutral-600 bg-neutral-800 px-2 py-1 text-[11px] text-white"
                      data-testid="text-align-select"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                      <option value="justify">Justify</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

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

        {activePanel === "pages" && (
          <div className="flex h-full min-h-0 flex-col p-3 text-xs text-neutral-300">
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Pages
                </div>
                <button
                  type="button"
                  onClick={handleAddPage}
                  disabled={!currentProject}
                  className="rounded border border-blue-500/70 bg-blue-600 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-800 disabled:text-neutral-500"
                  data-testid="add-page-button"
                >
                  Add Page
                </button>
              </div>
              <button
                type="button"
                onClick={handleAddSpread}
                disabled={!currentProject || pageUnits.length === 0}
                className="w-full rounded border border-purple-500/70 bg-purple-600 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:bg-neutral-800 disabled:text-neutral-500"
                data-testid="add-spread-button"
              >
                Add double page
              </button>
            </div>

            {alignmentPrompt && (
              <div className="mb-3 rounded border border-amber-500/50 bg-amber-500/10 p-2" data-testid="spread-alignment-prompt">
                <div className="mb-2 text-[11px] text-amber-100">Double page must start on a left page.</div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleInsertEditableBlankThenSpread} className="rounded bg-amber-500 px-2 py-1 text-[10px] font-medium text-neutral-950" data-testid="insert-editable-blank-choice">
                    Insert editable blank page
                  </button>
                  <button type="button" onClick={() => setAlignmentPrompt(null)} className="rounded border border-neutral-600 px-2 py-1 text-[10px] text-neutral-200" data-testid="cancel-spread-insert-choice">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {deletePrompt && (
              <div className="mb-3 rounded border border-red-500/50 bg-red-500/10 p-2" data-testid="delete-page-prompt">
                <div className="mb-2 text-[11px] text-red-100">Deleting this page would invalidate a later spread.</div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleDeleteWithBlankReplacement} className="rounded bg-red-500 px-2 py-1 text-[10px] font-medium text-white" data-testid="insert-blank-replacement-choice">
                    Insert blank replacement
                  </button>
                  <button type="button" onClick={() => setDeletePrompt(null)} className="rounded border border-neutral-600 px-2 py-1 text-[10px] text-neutral-200" data-testid="cancel-deletion-choice">
                    Cancel deletion
                  </button>
                </div>
              </div>
            )}

            {!currentProject && (
              <div className="rounded border border-neutral-700 bg-neutral-900/60 p-3 text-neutral-500">
                No project loaded.
              </div>
            )}

            {currentProject && orderedPages.length === 0 && (
              <div className="rounded border border-neutral-700 bg-neutral-900/60 p-3 text-neutral-500">
                No pages yet. Add a page to get started.
              </div>
            )}

            {currentProject && pageUnits.length > 0 && (
              <div
                className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
                data-testid="pages-list"
              >
                {pageUnits.map((unit, unitIndex) => {
                  if (unit.unitType === "spread") {
                    const spread = currentProject.spreads?.find((item) => item.id === unit.spreadId);
                    const left = currentProject.pages.find((page) => page.id === spread?.leftPageId);
                    const right = currentProject.pages.find((page) => page.id === spread?.rightPageId);
                    if (!spread || !left || !right) return null;
                    const isActive = activePageId === left.id || activePageId === right.id;
                    return (
                      <div
                        key={unit.id}
                        className={`rounded-lg border p-2 transition ${isActive ? "border-blue-400 bg-blue-500/15" : "border-purple-500/40 bg-neutral-900/60"}`}
                        data-testid={`spread-item-${spread.id}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectPage(left.id)}
                          className="w-full text-left"
                          aria-current={isActive ? "page" : undefined}
                          data-testid={`select-spread-${spread.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-white">{spread.name}</span>
                            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-200">Spread</span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-neutral-400">
                            <div className="rounded border border-neutral-700 bg-neutral-800 p-1" data-testid={`spread-left-${spread.id}`}>Left · {left.name}</div>
                            <div className="rounded border border-neutral-700 bg-neutral-800 p-1" data-testid={`spread-right-${spread.id}`}>Right · {right.name}</div>
                          </div>
                        </button>
                        <div className="mt-2 flex justify-end gap-1">
                          <button type="button" onClick={() => handleMoveUnit(unit.id, unitIndex - 1)} className="rounded border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300" data-testid={`move-up-${unit.id}`}>Up</button>
                          <button type="button" onClick={() => handleMoveUnit(unit.id, unitIndex + 1)} className="rounded border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300" data-testid={`move-down-${unit.id}`}>Down</button>
                          <button type="button" onClick={() => handleDeleteSpread(spread.id)} disabled={!canDeletePages} className="rounded border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300 transition hover:border-red-400 hover:text-red-200 disabled:cursor-not-allowed disabled:text-neutral-600" data-testid={`delete-spread-${spread.id}`}>Delete</button>
                        </div>
                      </div>
                    );
                  }

                  const page = currentProject.pages.find((item) => item.id === unit.pageId);
                  if (!page) return null;
                  const physical = physicalPages.find((ref) => ref.page.id === page.id);
                  const index = physicalPages.findIndex((ref) => ref.page.id === page.id);
                  const isActive = page.id === activePageId;
                  return (
                    <div
                      key={page.id}
                      className={`rounded-lg border p-2 transition ${
                        isActive
                          ? "border-blue-400 bg-blue-500/15"
                          : "border-neutral-700 bg-neutral-900/60"
                      }`}
                      data-testid={`page-item-${page.id}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectPage(page.id)}
                        className="w-full text-left"
                        aria-current={isActive ? "page" : undefined}
                        data-testid={`select-page-${page.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-white">{page.name}</span>
                          <span className="rounded bg-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-200">
                            {page.pageKind === "editable-blank" ? "Editable blank" : physical?.side === "left" ? "Left" : "Right"}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-neutral-500">
                          Page {index + 1} · {page.width} × {page.height}
                        </div>
                      </button>

                      <div className="mt-2 flex justify-end gap-1">
                        <button type="button" onClick={() => handleMoveUnit(unit.id, unitIndex - 1)} className="rounded border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300" data-testid={`move-up-${unit.id}`}>Up</button>
                        <button type="button" onClick={() => handleMoveUnit(unit.id, unitIndex + 1)} className="rounded border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300" data-testid={`move-down-${unit.id}`}>Down</button>
                        <button
                          type="button"
                          onClick={() => handleDeletePage(page.id)}
                          disabled={!canDeletePages}
                          className="rounded border border-neutral-700 px-2 py-1 text-[10px] text-neutral-300 transition hover:border-red-400 hover:text-red-200 disabled:cursor-not-allowed disabled:text-neutral-600 disabled:hover:border-neutral-700"
                          data-testid={`delete-page-${page.id}`}
                          title={canDeletePages ? "Delete page" : "Cannot delete final page"}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
