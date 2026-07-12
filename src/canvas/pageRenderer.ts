import { FabricImage, Group, Rect, Textbox } from "fabric";
import type { Canvas as FabricCanvas, FabricObject } from "fabric";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Element, GroupElement, ImageElement, Page, ShapeElement, TextElement } from "../types";
import { getTextAlign, getTextFontWeight, getTextLetterSpacing } from "../textStyles";
import { bindImageElementToFabricObject } from "./documentAdapter";
import { setElementId } from "./handlers";

const PAGE_SHEET_FLAG = "isPageSheet";
const PAGE_CONTENT_FLAG = "isPageContent";
const ZERO_ORIGIN = { left: 0, top: 0 };

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
    originX: "left",
    originY: "top",
    left: origin.left + element.position.x,
    top: origin.top + element.position.y,
    angle: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
    selectable: !element.locked,
    evented: !element.locked,
  });
  setElementId(obj, element.id);
  if (element.elementType === "image") {
    bindImageElementToFabricObject(obj, element);
  }
  markPageContent(obj);
  obj.setCoords();
}

async function createImageObject(
  element: ImageElement,
  origin: { left: number; top: number },
): Promise<FabricObject> {
  if (!element.src) {
    const placeholder = new Rect({
      width: element.size.width,
      height: element.size.height,
      fill: "#ffffff",
      stroke: "#9ca3af",
      strokeWidth: 1,
      strokeDashArray: [4, 4],
    });
    applyBaseElementProps(placeholder as FabricObject, element, origin);
    return placeholder as FabricObject;
  }

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
  applyBaseElementProps(image as FabricObject, element, origin);

  return image as FabricObject;
}

function createTextObject(
  element: TextElement,
  origin: { left: number; top: number },
): FabricObject {
  const text = new Textbox(element.content, {
    width: element.size.width,
    height: element.size.height,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fill: element.color,
    fontWeight: getTextFontWeight(element),
    textAlign: getTextAlign(element),
    charSpacing: getTextLetterSpacing(element) * 1000,
    splitByGrapheme: true,
  });

  applyBaseElementProps(text as FabricObject, element, origin);

  return text as FabricObject;
}

function createShapeObject(
  element: ShapeElement,
  origin: { left: number; top: number },
): FabricObject | null {
  if (element.shapeKind !== "rectangle") return null;

  const shape = new Rect({
    width: element.size.width,
    height: element.size.height,
    fill: element.fill,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
  });
  applyBaseElementProps(shape as FabricObject, element, origin);

  return shape as FabricObject;
}

function createGroupBoundsObject(element: GroupElement): FabricObject {
  return new Rect({
    left: 0,
    top: 0,
    width: element.size.width,
    height: element.size.height,
    originX: "left",
    originY: "top",
    fill: "rgba(0,0,0,0)",
    strokeWidth: 0,
    selectable: false,
    evented: false,
    excludeFromExport: true,
  }) as FabricObject;
}

function makeGroupChildObject(obj: FabricObject): FabricObject {
  obj.set({
    selectable: false,
    evented: false,
  });
  obj.setCoords();
  return obj;
}

async function createGroupObject(
  element: GroupElement,
  origin: { left: number; top: number },
): Promise<FabricObject> {
  const children = [...element.children].sort((a, b) => a.zIndex - b.zIndex);
  const childObjects: FabricObject[] = [createGroupBoundsObject(element)];

  for (const child of children) {
    const childObject = await createObjectForElement(child, ZERO_ORIGIN);
    if (childObject) {
      childObjects.push(makeGroupChildObject(childObject));
    }
  }

  const group = new Group(childObjects, {
    subTargetCheck: false,
  });
  applyBaseElementProps(group as FabricObject, element, origin);

  return group as FabricObject;
}

async function createObjectForElement(
  element: Element,
  origin: { left: number; top: number },
): Promise<FabricObject | null> {
  switch (element.elementType) {
    case "image":
      return createImageObject(element, origin);
    case "text":
      return createTextObject(element, origin);
    case "shape":
      return createShapeObject(element, origin);
    case "group":
      return createGroupObject(element, origin);
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
