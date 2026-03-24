import type { Canvas as FabricCanvas, FabricObject } from "fabric";
import type { Element, ImageElement } from "../types";
import { getElementId } from "./handlers";

export type BorderApplicationMode = "selected" | "all";
export type ImageBorderStyleId =
  | "custom"
  | "matte-frame"
  | "gallery-frame"
  | "ornate-gold"
  | "walnut-frame";

export interface BorderStylePreset {
  id: ImageBorderStyleId;
  label: string;
  defaultColor: string;
  defaultWidth: number;
  dash?: number[];
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

export interface ResolvedImageBorderStyle {
  styleId: ImageBorderStyleId;
  borderColor: string;
  borderWidth: number;
  dash?: number[];
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

export interface ImageBorderUpdateInput {
  mode: BorderApplicationMode;
  selectedIds: string[];
  styleId: ImageBorderStyleId;
  borderColor?: string;
  borderWidth?: number;
}

export const IMAGE_BORDER_STYLE_PRESETS: BorderStylePreset[] = [
  {
    id: "custom",
    label: "Custom",
    defaultColor: "#000000",
    defaultWidth: 2,
  },
  {
    id: "matte-frame",
    label: "Matte Frame",
    defaultColor: "#f5f1e8",
    defaultWidth: 12,
    shadow: { color: "rgba(0,0,0,0.20)", blur: 10, offsetX: 0, offsetY: 3 },
  },
  {
    id: "gallery-frame",
    label: "Gallery Frame",
    defaultColor: "#1f2937",
    defaultWidth: 6,
    dash: [2, 2],
  },
  {
    id: "ornate-gold",
    label: "Ornate Gold",
    defaultColor: "#d4af37",
    defaultWidth: 8,
    shadow: { color: "rgba(90,65,0,0.35)", blur: 6, offsetX: 0, offsetY: 2 },
  },
  {
    id: "walnut-frame",
    label: "Walnut Frame",
    defaultColor: "#5c3a21",
    defaultWidth: 10,
    shadow: { color: "rgba(0,0,0,0.30)", blur: 8, offsetX: 0, offsetY: 2 },
  },
];

function shouldUpdateImageBorder(
  element: ImageElement,
  mode: BorderApplicationMode,
  selectedIds: Set<string>,
): boolean {
  if (mode === "all") return true;
  return selectedIds.has(element.id);
}

export function resolveImageBorderStyle(
  styleId: ImageBorderStyleId,
  borderColor?: string,
  borderWidth?: number,
): ResolvedImageBorderStyle {
  const preset = IMAGE_BORDER_STYLE_PRESETS.find((entry) => entry.id === styleId) ??
    IMAGE_BORDER_STYLE_PRESETS[0];
  const safeWidth =
    typeof borderWidth === "number" && Number.isFinite(borderWidth)
      ? Math.max(0, borderWidth)
      : preset.defaultWidth;

  return {
    styleId: preset.id,
    borderColor: borderColor ?? preset.defaultColor,
    borderWidth: safeWidth,
    dash: preset.dash,
    shadow: preset.shadow,
  };
}

export function collectTargetImageIds(
  elements: Element[],
  mode: BorderApplicationMode,
  selectedIds: string[],
): string[] {
  const selected = new Set(selectedIds);
  return elements
    .filter((element): element is ImageElement => element.elementType === "image")
    .filter((element) => shouldUpdateImageBorder(element, mode, selected))
    .map((element) => element.id);
}

export function applyBorderToImageElements(
  elements: Element[],
  input: ImageBorderUpdateInput,
): Element[] {
  const selected = new Set(input.selectedIds);
  const resolved = resolveImageBorderStyle(
    input.styleId,
    input.borderColor,
    input.borderWidth,
  );

  return elements.map((element) => {
    if (element.elementType !== "image") return element;
    if (!shouldUpdateImageBorder(element, input.mode, selected)) return element;

    return {
      ...element,
      borderStyle: resolved.styleId,
      borderColor: resolved.borderColor,
      borderWidth: resolved.borderWidth,
    };
  });
}

export function applyBorderToCanvasObjects(
  canvas: FabricCanvas,
  imageIds: string[],
  style: ResolvedImageBorderStyle,
): void {
  const ids = new Set(imageIds);
  const stroke = style.borderWidth > 0 ? style.borderColor : undefined;

  for (const obj of canvas.getObjects()) {
    const id = getElementId(obj as FabricObject);
    if (!id || !ids.has(id)) continue;

    obj.set({
      stroke,
      strokeWidth: style.borderWidth,
      strokeUniform: true,
      strokeDashArray: style.dash,
      shadow: style.shadow,
    });
    obj.setCoords();
  }

  canvas.requestRenderAll();
}
