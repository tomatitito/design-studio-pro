import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FabricImage } from "fabric";
import type { Canvas as FabricCanvas } from "fabric";
import type { Asset, ImageElement, Position } from "../types";
import { setElementId } from "./handlers";
import { useProjectStore } from "../stores";

/** Image file extensions supported for import. */
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif", "gif"];

/** File filter for the native dialog. */
const IMAGE_FILTER = {
  name: "Images",
  extensions: IMAGE_EXTENSIONS,
};

/**
 * Opens a native file dialog filtered to image formats and imports
 * the selected file as a project asset.
 *
 * Returns the imported Asset, or null if the user cancelled.
 */
export async function importImageViaDialog(
  projectDir?: string,
): Promise<Asset | null> {
  const selected = await open({
    multiple: false,
    filters: [IMAGE_FILTER],
    title: "Import Image",
  });

  if (!selected) return null;

  // `open` with `multiple: false` returns a single string path
  const filePath = selected as string;
  const fileName = filePath.split(/[/\\]/).pop() ?? "image";

  const asset = await invoke<Asset>("import_asset", {
    name: fileName,
    filePath,
    projectDir: projectDir ?? null,
  });

  return asset;
}

/**
 * Returns whether a file extension is a supported image format.
 */
export function isSupportedImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Extracts file paths from a DragEvent's dataTransfer, filtering
 * to supported image formats.
 *
 * Note: In Tauri, dropped file paths come from the `dataTransfer.files`
 * list. The actual file system path is available via `file.name` or
 * through Tauri's file drop events.
 */
export function getDroppedImageFiles(event: DragEvent): File[] {
  const files = event.dataTransfer?.files;
  if (!files) return [];

  return Array.from(files).filter((file) => isSupportedImageFile(file.name));
}

/**
 * Creates a Fabric.js image from an imported Asset and adds it to the canvas.
 *
 * Also creates a corresponding ImageElement in the project store for the
 * current page. The image is selected immediately after being added.
 *
 * @param canvas  The Fabric.js canvas instance.
 * @param asset   The imported asset returned from `importImageViaDialog` or `invoke("import_asset")`.
 * @param position  Optional canvas-space position. Defaults to the center of the current viewport.
 * @returns The created FabricImage object.
 */
export async function addImageToCanvas(
  canvas: FabricCanvas,
  asset: Asset,
  position?: Position,
): Promise<FabricImage> {
  const url = convertFileSrc(asset.filePath);
  let img: FabricImage;
  try {
    img = await FabricImage.fromURL(url);
  } catch (err) {
    console.error(
      `Failed to load image from asset protocol URL: ${url} (original path: ${asset.filePath})`,
      err,
    );
    throw err;
  }

  if (!img.width || !img.height) {
    const msg = `Image loaded but has zero dimensions (width=${img.width}, height=${img.height}). The asset protocol may not be serving the file. URL: ${url}`;
    console.error(msg);
    throw new Error(msg);
  }

  // Determine placement position — default to center of viewport
  if (position) {
    img.set({ left: position.x, top: position.y });
  } else {
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    const centerX = (canvas.getWidth() / 2 - vpt[4]) / zoom;
    const centerY = (canvas.getHeight() / 2 - vpt[5]) / zoom;
    img.set({
      left: centerX - (img.width ?? 0) / 2,
      top: centerY - (img.height ?? 0) / 2,
    });
  }

  // Store the original filesystem path so the export pipeline can reference
  // the actual file instead of the convertFileSrc URL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (img as any).originalFilePath = asset.filePath;

  setElementId(img, asset.id);
  canvas.add(img);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();

  // Persist the element in the project store
  const projectStore = useProjectStore.getState();
  const project = projectStore.currentProject;
  if (project && project.pages.length > 0) {
    const page = project.pages[0];
    const imageElement: ImageElement = {
      id: asset.id,
      elementType: "image",
      src: asset.filePath,
      alt: asset.name,
      position: {
        x: img.left ?? 0,
        y: img.top ?? 0,
      },
      size: {
        width: (img.width ?? 0) * (img.scaleX ?? 1),
        height: (img.height ?? 0) * (img.scaleY ?? 1),
      },
      rotation: 0,
      opacity: 1,
      zIndex: page.elements.length,
      locked: false,
      visible: true,
    };
    projectStore.updatePage(page.id, {
      elements: [...page.elements, imageElement],
    });
    projectStore.setDirty(true);
  }

  return img;
}
