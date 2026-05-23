import { beforeEach, describe, expect, it, vi } from "vitest";
import { addImageToCanvas } from "../canvas/importers";
import { useProjectStore } from "../stores";
import type { Asset } from "../types";

const { fabricImageFromURL } = vi.hoisted(() => ({
  fabricImageFromURL: vi.fn(),
}));

vi.mock("fabric", () => ({
  FabricImage: {
    fromURL: fabricImageFromURL,
  },
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

describe("addImageToCanvas", () => {
  beforeEach(() => {
    fabricImageFromURL.mockReset();
    useProjectStore.setState({
      currentProject: {
        id: "project-1",
        name: "Project",
        pages: [
          {
            id: "page-1",
            name: "Page 1",
            elements: [],
            width: 210,
            height: 297,
            backgroundColor: "#ffffff",
            order: 0,
          },
        ],
        createdAt: "2026-01-01T00:00:00Z",
        modifiedAt: "2026-01-01T00:00:00Z",
        settings: {
          width: 210,
          height: 297,
          orientation: "portrait",
          unit: "mm",
        },
      },
      projects: [],
      activePageId: "page-1",
      isDirty: false,
    });
  });

  it("scales imported images to fit the page sheet quadrant and centers default imports", async () => {
    const image = {
      width: 2000,
      height: 1000,
      scaleX: 1,
      scaleY: 1,
      left: 0,
      top: 0,
      set: vi.fn((update: Record<string, unknown>) => {
        Object.assign(image, update);
      }),
    };
    fabricImageFromURL.mockResolvedValue(image);

    const sheet = {
      isPageSheet: true,
      left: 100,
      top: 80,
      width: 840,
      height: 1188,
      scaleX: 1,
      scaleY: 1,
    };
    const canvas = {
      viewportTransform: [1, 0, 0, 1, 0, 0],
      getZoom: vi.fn(() => 1),
      getWidth: vi.fn(() => 800),
      getHeight: vi.fn(() => 600),
      getObjects: vi.fn(() => [sheet]),
      add: vi.fn(),
      setActiveObject: vi.fn(),
      requestRenderAll: vi.fn(),
    };
    const asset: Asset = {
      id: "asset-1",
      name: "photo.jpg",
      filePath: "/tmp/photo.jpg",
      thumbnailPath: null,
      fileSize: 0,
      mimeType: "image/jpeg",
      dimensions: { width: 2000, height: 1000 },
      createdAt: "2026-01-01T00:00:00Z",
    };

    await addImageToCanvas(canvas as never, asset);

    const expectedScale = Math.min(1, (840 * 0.5) / 2000, (1188 * 0.5) / 1000);
    expect(image.scaleX).toBeCloseTo(expectedScale);
    expect(image.scaleY).toBeCloseTo(expectedScale);
    const expectedWidth = 2000 * expectedScale;
    const expectedHeight = 1000 * expectedScale;
    expect(image.left).toBeCloseTo(100 + (840 - expectedWidth) / 2);
    expect(image.top).toBeCloseTo(80 + (1188 - expectedHeight) / 2);

    const pageElements = useProjectStore.getState().currentProject?.pages[0]?.elements ?? [];
    expect(pageElements).toHaveLength(1);
    expect(pageElements[0].position.x).toBeCloseTo((840 - expectedWidth) / 2);
    expect(pageElements[0].position.y).toBeCloseTo((1188 - expectedHeight) / 2);
    expect(pageElements[0].size.width).toBeCloseTo(expectedWidth);
    expect(pageElements[0].size.height).toBeCloseTo(expectedHeight);
  });

  it("persists explicit drop positions relative to the page sheet", async () => {
    const image = {
      width: 400,
      height: 200,
      scaleX: 1,
      scaleY: 1,
      left: 0,
      top: 0,
      set: vi.fn((update: Record<string, unknown>) => {
        Object.assign(image, update);
      }),
    };
    fabricImageFromURL.mockResolvedValue(image);

    const sheet = {
      isPageSheet: true,
      left: 100,
      top: 80,
      width: 840,
      height: 1188,
      scaleX: 1,
      scaleY: 1,
    };
    const canvas = {
      viewportTransform: [1, 0, 0, 1, 0, 0],
      getZoom: vi.fn(() => 1),
      getWidth: vi.fn(() => 800),
      getHeight: vi.fn(() => 600),
      getObjects: vi.fn(() => [sheet]),
      add: vi.fn(),
      setActiveObject: vi.fn(),
      requestRenderAll: vi.fn(),
    };
    const asset: Asset = {
      id: "asset-2",
      name: "drop.jpg",
      filePath: "/tmp/drop.jpg",
      thumbnailPath: null,
      fileSize: 0,
      mimeType: "image/jpeg",
      dimensions: { width: 400, height: 200 },
      createdAt: "2026-01-01T00:00:00Z",
    };

    await addImageToCanvas(canvas as never, asset, { x: 250, y: 200 });

    expect(image.left).toBe(250);
    expect(image.top).toBe(200);
    const pageElements = useProjectStore.getState().currentProject?.pages[0]?.elements ?? [];
    expect(pageElements[0].position).toEqual({ x: 150, y: 120 });
  });
});
