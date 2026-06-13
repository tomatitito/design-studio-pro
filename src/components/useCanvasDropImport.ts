import { useCallback, type DragEvent, type RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Canvas as FabricCanvas } from "fabric";
import { useUIStore } from "../stores";
import type { Asset } from "../types";
import {
  addImageToCanvas,
  getDroppedImageFilePath,
  getDroppedImageFiles,
  screenToCanvas,
} from "../canvas";

/**
 * Handles path-based desktop image drops.
 *
 * Browser File drops do not expose a trustworthy filesystem path, while the
 * Rust `import_asset` command intentionally accepts absolute paths only. When
 * Tauri/browser does not provide a path on the dropped File object, the drop is
 * ignored instead of passing `file.name` and creating a broken import request.
 */
export function useCanvasDropImport(
  canvas: FabricCanvas | null,
  containerRef: RefObject<HTMLDivElement | null>,
): {
  handleDragOver: (e: DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>) => Promise<void>;
} {
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

      const containerRect = containerRef.current?.getBoundingClientRect();
      const currentZoom = useUIStore.getState().zoom;
      const currentPanOffset = useUIStore.getState().panOffset;
      const dropScreenPos = {
        x: e.clientX - (containerRect?.left ?? 0),
        y: e.clientY - (containerRect?.top ?? 0),
      };
      const dropCanvasPos = screenToCanvas(dropScreenPos, currentZoom, currentPanOffset);

      for (const file of imageFiles) {
        const filePath = getDroppedImageFilePath(file);
        if (!filePath) {
          console.warn(
            "Image drag/drop is only supported when the desktop runtime provides an absolute filesystem path.",
            file.name,
          );
          continue;
        }

        const asset = await invoke<Asset>("import_asset", {
          name: file.name,
          filePath,
          projectDir: null,
        });
        await addImageToCanvas(canvas, asset, dropCanvasPos);
      }
    },
    [canvas, containerRef],
  );

  return { handleDragOver, handleDrop };
}
