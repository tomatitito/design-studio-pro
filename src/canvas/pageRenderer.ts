import { FabricImage } from "fabric";
import type { Canvas as FabricCanvas, FabricObject } from "fabric";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Element, ImageElement, Page } from "../types";
import { setElementId } from "./handlers";

const PAGE_SHEET_FLAG = "isPageSheet";
const PAGE_CONTENT_FLAG = "isPageContent";

function isPageSheet(obj: FabricObject): boolean {
  return Boolean((obj as unknown as Record<string, unknown>)[PAGE_SHEET_FLAG]);
}

function markPageContent(obj: FabricObject): void {
  (obj as unknown as Record<string, unknown>)[PAGE_CONTENT_FLAG] = true;
}

function isPageContent(obj: FabricObject): boolean {
  const record = obj as unknown as Record<string, unknown>;
  return Boolean(record[PAGE_CONTENT_FLAG]) || (!isPageSheet(obj) && Boolean(record.elementId));
}

function getPageSheetOrigin(canvas: FabricCanvas): { left: number; top: number } {
  const sheet = canvas
    .getObjects()
    .find((obj) => (obj as unknown as Record<string, unknown>)[PAGE_SHEET_FLAG]);
  return { left: sheet?.left ?? 0, top: sheet?.top ?? 0 };
}

function removePageContent(canvas: FabricCanvas): void {
  const objects = canvas.getObjects() as FabricObject[];
  const contentObjects = objects.filter(isPageContent);

  for (const obj of contentObjects) {
    canvas.remove(obj);

    // Some lightweight test doubles record remove() calls without mutating their
    // object list. Keep the backing array in sync when it is mutable.
    const index = objects.indexOf(obj);
    if (index !== -1) {
      objects.splice(index, 1);
    }
  }
}

function applyBaseElementProps(
  obj: FabricObject,
  element: Element,
  origin: { left: number; top: number },
): void {
  obj.set({
    left: origin.left + element.position.x,
    top: origin.top + element.position.y,
    angle: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
    selectable: !element.locked,
    evented: !element.locked,
  });
  setElementId(obj, element.id);
  markPageContent(obj);
  obj.setCoords();
}

async function createImageObject(
  element: ImageElement,
  origin: { left: number; top: number },
): Promise<FabricObject> {
  const image = await FabricImage.fromURL(convertFileSrc(element.src));
  const width = image.width ?? 0;
  const height = image.height ?? 0;
  const scaleX = width > 0 ? element.size.width / width : 1;
  const scaleY = height > 0 ? element.size.height / height : 1;

  image.set({
    scaleX,
    scaleY,
    lockUniScaling: true,
    strokeWidth: element.borderWidth ?? 0,
    stroke: element.borderColor,
    strokeUniform: true,
  });
  (image as unknown as Record<string, unknown>).originalFilePath = element.src;
  applyBaseElementProps(image as FabricObject, element, origin);

  return image as FabricObject;
}

async function createObjectForElement(
  element: Element,
  origin: { left: number; top: number },
): Promise<FabricObject | null> {
  switch (element.elementType) {
    case "image":
      return createImageObject(element, origin);
    default:
      // Rendering for text/shapes/groups is not implemented yet. Keep the
      // switch exhaustive so image page switching works without leaking stale
      // objects from other pages.
      return null;
  }
}

/**
 * Replace all Fabric objects that belong to page content with objects
 * reconstructed from the supplied page model. Helper objects such as the page
 * sheet are left in place.
 */
export async function renderPageContent(
  canvas: FabricCanvas,
  page: Page | null,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  removePageContent(canvas);
  canvas.discardActiveObject();

  if (!page || !shouldContinue()) {
    canvas.requestRenderAll();
    return;
  }

  const origin = getPageSheetOrigin(canvas);
  const elements = [...page.elements].sort((a, b) => a.zIndex - b.zIndex);
  for (const element of elements) {
    const obj = await createObjectForElement(element, origin);
    if (!shouldContinue()) return;
    if (obj) {
      canvas.add(obj);
    }
  }

  canvas.requestRenderAll();
}
