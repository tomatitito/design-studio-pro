import type { FabricObject } from "fabric";
import type { ImageElement } from "../types";
import { getElementId, setElementId } from "./handlers";

const ORIGINAL_FILE_PATH = "originalFilePath";

/**
 * Narrow adapter boundary between the persisted page document and Fabric object
 * metadata. Fabric internals stay here instead of being duplicated by render,
 * import, and export code paths.
 */
export function bindImageElementToFabricObject(obj: FabricObject, element: ImageElement): void {
  setElementId(obj, element.id);
  setFabricImageSourcePath(obj, element.src);
}

export function setFabricImageSourcePath(obj: FabricObject, sourcePath: string): void {
  (obj as unknown as Record<string, unknown>)[ORIGINAL_FILE_PATH] = sourcePath;
}

export function getFabricImageSourcePath(obj: FabricObject): string | undefined {
  const value = (obj as unknown as Record<string, unknown>)[ORIGINAL_FILE_PATH];
  return typeof value === "string" ? value : undefined;
}

export function getFabricDocumentElementId(obj: FabricObject): string {
  return getElementId(obj);
}
