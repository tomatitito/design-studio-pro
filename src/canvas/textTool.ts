import { Textbox } from "fabric";
import type { Canvas as FabricCanvas, FabricObject, TEvent } from "fabric";
import { getActiveProjectPage, useProjectStore, useUIStore } from "../stores";
import type { Position, TextElement } from "../types";
import { CALENDAR_FONT_OPTIONS } from "../textStyles";
import { setElementId } from "./handlers";

const PAGE_SHEET_FLAG = "isPageSheet";
const DEFAULT_TEXT_CONTENT = "Text";
const DEFAULT_TEXT_WIDTH = 70;
const DEFAULT_TEXT_HEIGHT = 18;
const DEFAULT_FONT_SIZE = 12;
const MIN_DRAG_SIZE = 6;
const CLICK_THRESHOLD = 3;

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `text-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function findPageSheet(canvas: FabricCanvas): FabricObject | null {
  return (
    canvas
      .getObjects()
      .find((obj) => (obj as unknown as Record<string, unknown>)[PAGE_SHEET_FLAG]) ?? null
  );
}

function getEventPoint(canvas: FabricCanvas, event: Partial<TEvent>): Position | null {
  const pointerSource = event as Partial<TEvent> & {
    scenePoint?: { x: number; y: number };
    pointer?: { x: number; y: number };
    absolutePointer?: { x: number; y: number };
    e?: Event;
  };

  if (pointerSource.scenePoint) return pointerSource.scenePoint;
  if (pointerSource.pointer) return pointerSource.pointer;
  if (pointerSource.absolutePointer) return pointerSource.absolutePointer;

  const getPointer = (canvas as unknown as { getPointer?: (event: Event) => Position }).getPointer;
  if (pointerSource.e && typeof getPointer === "function") {
    return getPointer.call(canvas, pointerSource.e);
  }

  return null;
}

function isInsideSheet(point: Position, sheet: FabricObject): boolean {
  const left = sheet.left ?? 0;
  const top = sheet.top ?? 0;
  const width = (sheet.width ?? 0) * (sheet.scaleX ?? 1);
  const height = (sheet.height ?? 0) * (sheet.scaleY ?? 1);
  return point.x >= left && point.x <= left + width && point.y >= top && point.y <= top + height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createDefaultTextElement(start: Position, end: Position | null, pageDisplaySize: { width: number; height: number }): TextElement | null {
  const projectStore = useProjectStore.getState();
  const page = getActiveProjectPage(projectStore.currentProject, projectStore.activePageId);
  if (!page) return null;

  const rawWidth = end ? Math.abs(end.x - start.x) : DEFAULT_TEXT_WIDTH;
  const rawHeight = end ? Math.abs(end.y - start.y) : DEFAULT_TEXT_HEIGHT;
  const width = end ? Math.max(rawWidth, MIN_DRAG_SIZE) : DEFAULT_TEXT_WIDTH;
  const height = end ? Math.max(rawHeight, MIN_DRAG_SIZE) : DEFAULT_TEXT_HEIGHT;
  const x = end ? Math.min(start.x, end.x) : start.x;
  const y = end ? Math.min(start.y, end.y) : start.y;
  const position = {
    x: clamp(x, 0, Math.max(0, pageDisplaySize.width - MIN_DRAG_SIZE)),
    y: clamp(y, 0, Math.max(0, pageDisplaySize.height - MIN_DRAG_SIZE)),
  };
  const maxZ = page.elements.reduce((current, element) => Math.max(current, element.zIndex), -1);

  return {
    id: createId(),
    elementType: "text",
    content: DEFAULT_TEXT_CONTENT,
    fontFamily: CALENDAR_FONT_OPTIONS[0]?.family ?? "Arial, Helvetica, sans-serif",
    fontSize: DEFAULT_FONT_SIZE,
    color: "#111111",
    fontWeight: "400",
    textAlign: "left",
    letterSpacing: 0,
    position,
    size: {
      width: Math.min(width, Math.max(MIN_DRAG_SIZE, pageDisplaySize.width - position.x)),
      height: Math.min(height, Math.max(MIN_DRAG_SIZE, pageDisplaySize.height - position.y)),
    },
    rotation: 0,
    opacity: 1,
    zIndex: maxZ + 1,
    locked: false,
    visible: true,
  };
}

function addTextElementToProject(element: TextElement): void {
  const projectStore = useProjectStore.getState();
  const page = getActiveProjectPage(projectStore.currentProject, projectStore.activePageId);
  if (!page) return;

  projectStore.updatePage(page.id, { elements: [...page.elements, element] });
  projectStore.setDirty(true);
}

function addTextObjectToCanvas(
  canvas: FabricCanvas,
  element: TextElement,
  origin: Position,
): FabricObject {
  const text = new Textbox(element.content, {
    width: element.size.width,
    height: element.size.height,
    originX: "left",
    originY: "top",
    left: origin.x + element.position.x,
    top: origin.y + element.position.y,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fill: element.color,
    fontWeight: element.fontWeight,
    textAlign: element.textAlign,
    charSpacing: (element.letterSpacing ?? 0) * 1000,
    splitByGrapheme: true,
  }) as FabricObject;

  text.set({
    angle: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
    selectable: true,
    evented: true,
  });
  setElementId(text, element.id);
  text.setCoords();
  canvas.add(text);
  canvas.setActiveObject(text);
  canvas.requestRenderAll();

  const editable = text as FabricObject & { enterEditing?: () => void; selectAll?: () => void };
  editable.enterEditing?.();
  editable.selectAll?.();

  return text;
}

/**
 * Attach the add-text workflow. With the text tool selected, clicking the page
 * creates a default textbox; dragging creates a textbox sized to the drag area.
 */
export function attachTextToolHandlers(canvas: FabricCanvas): () => void {
  let startPoint: Position | null = null;

  const handleMouseDown = (event: Partial<TEvent>) => {
    if (useUIStore.getState().selectedTool !== "text") return;
    const point = getEventPoint(canvas, event);
    const sheet = findPageSheet(canvas);
    if (!point || !sheet || !isInsideSheet(point, sheet)) return;

    startPoint = { x: point.x, y: point.y };
    canvas.discardActiveObject();
  };

  const handleMouseUp = (event: Partial<TEvent>) => {
    if (useUIStore.getState().selectedTool !== "text" || !startPoint) return;

    const point = getEventPoint(canvas, event) ?? startPoint;
    const sheet = findPageSheet(canvas);
    const startedAt = startPoint;
    startPoint = null;
    if (!sheet) return;

    const sheetLeft = sheet.left ?? 0;
    const sheetTop = sheet.top ?? 0;
    const sheetWidth = (sheet.width ?? 0) * (sheet.scaleX ?? 1);
    const sheetHeight = (sheet.height ?? 0) * (sheet.scaleY ?? 1);
    const clampedEnd = {
      x: clamp(point.x, sheetLeft, sheetLeft + sheetWidth),
      y: clamp(point.y, sheetTop, sheetTop + sheetHeight),
    };
    const start = { x: startedAt.x - sheetLeft, y: startedAt.y - sheetTop };
    const end = { x: clampedEnd.x - sheetLeft, y: clampedEnd.y - sheetTop };
    const isClick = Math.abs(end.x - start.x) < CLICK_THRESHOLD && Math.abs(end.y - start.y) < CLICK_THRESHOLD;
    const element = createDefaultTextElement(start, isClick ? null : end, {
      width: sheetWidth,
      height: sheetHeight,
    });
    if (!element) return;

    (canvas as unknown as { __pendingEditTextElementId?: string }).__pendingEditTextElementId = element.id;
    addTextElementToProject(element);
    addTextObjectToCanvas(canvas, element, { x: sheetLeft, y: sheetTop });

    const uiStore = useUIStore.getState();
    uiStore.setSelectedElements([element.id]);
    uiStore.setActivePanel("properties");
    uiStore.setSelectedTool("select");
  };

  canvas.on("mouse:down", handleMouseDown);
  canvas.on("mouse:up", handleMouseUp);

  return () => {
    canvas.off("mouse:down", handleMouseDown);
    canvas.off("mouse:up", handleMouseUp);
  };
}
