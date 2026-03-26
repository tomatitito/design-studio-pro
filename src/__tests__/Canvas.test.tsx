import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Canvas } from "../components/Canvas";
import { CanvasProvider } from "../components/CanvasContext";
import { useProjectStore, useUIStore } from "../stores";
import type { Project } from "../types";

const fabricMock = vi.hoisted(() => {
  const canvasInstances: MockCanvas[] = [];
  const rectInstances: MockRect[] = [];

  class MockCanvas {
    listeners = new Map<string, Array<(event: unknown) => void>>();
    objects: unknown[] = [];
    viewportTransform = [1, 0, 0, 1, 0, 0];
    width = 800;
    height = 600;
    setDimensions = vi.fn(({ width, height }: { width: number; height: number }) => {
      this.width = width;
      this.height = height;
    });
    requestRenderAll = vi.fn();
    setZoom = vi.fn();
    getZoom = vi.fn(() => 1);
    setViewportTransform = vi.fn((vpt: number[]) => {
      this.viewportTransform = [...vpt];
    });
    add = vi.fn((obj: unknown) => {
      this.objects.push(obj);
    });
    remove = vi.fn();
    on = vi.fn((eventName: string, handler: (event: unknown) => void) => {
      const existing = this.listeners.get(eventName) ?? [];
      existing.push(handler);
      this.listeners.set(eventName, existing);
    });
    off = vi.fn((eventName: string, handler: (event: unknown) => void) => {
      const existing = this.listeners.get(eventName) ?? [];
      this.listeners.set(
        eventName,
        existing.filter((registered) => registered !== handler),
      );
    });
    dispose = vi.fn();
    sendObjectToBack = vi.fn();
    zoomToPoint = vi.fn();
    getWidth = vi.fn(() => this.width);
    getHeight = vi.fn(() => this.height);
    getObjects = vi.fn(() => this.objects);
    getContext = vi.fn(() => ({
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setTransform: vi.fn(),
      setLineDash: vi.fn(),
      strokeStyle: "",
      lineWidth: 1,
    }));
    discardActiveObject = vi.fn();
    getActiveObject = vi.fn();
    getActiveObjects = vi.fn(() => []);
    setActiveObject = vi.fn();

    constructor() {
      canvasInstances.push(this);
    }

    emit(eventName: string, event: unknown) {
      const handlers = this.listeners.get(eventName) ?? [];
      handlers.forEach((handler) => handler(event));
    }
  }

  class MockRect {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    fill?: unknown;
    selectable?: boolean;
    evented?: boolean;
    set = vi.fn((update: Record<string, unknown>) => {
      Object.assign(this, update);
    });
    setCoords = vi.fn();
    getBoundingRect = vi.fn(() => ({
      left: this.left ?? 0,
      top: this.top ?? 0,
      width: this.width ?? 0,
      height: this.height ?? 0,
    }));

    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
      rectInstances.push(this);
    }
  }

  return { canvasInstances, rectInstances, MockCanvas, MockRect };
});

vi.mock("fabric", () => ({
  Canvas: fabricMock.MockCanvas,
  Rect: fabricMock.MockRect,
  Shadow: class {
    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
    }
  },
  Gradient: class {
    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
    }
  },
  FabricImage: { fromURL: vi.fn() },
  ActiveSelection: vi.fn(),
  Point: class {
    x: number;
    y: number;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

vi.mock("@tauri-apps/api/core");

const TEST_PROJECT: Project = {
  id: "project-1",
  name: "Test Project",
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
};

describe("Canvas", () => {
  beforeEach(() => {
    fabricMock.canvasInstances.length = 0;
    fabricMock.rectInstances.length = 0;

    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      toJSON: () => ({}),
    });

    useProjectStore.setState({
      currentProject: structuredClone(TEST_PROJECT),
      projects: [],
      isDirty: false,
    });
    useUIStore.setState({
      selectedTool: "select",
      selectedElementIds: [],
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      sidebarOpen: true,
      activePanel: "layers",
    });
  });

  it("does not refit the viewport when only the page background changes", async () => {
    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];

    expect(canvas).toBeDefined();
    expect(sheet).toBeDefined();

    sheet.left = 120;
    sheet.top = 80;
    canvas.zoomToPoint.mockClear();
    canvas.setViewportTransform.mockClear();

    act(() => {
      useProjectStore.getState().updatePage("page-1", {
        backgroundColor: "linear-gradient(135deg, #0f766e 0%, #38bdf8 100%)",
      });
    });

    await waitFor(() => {
      expect(sheet.left).toBe(120);
      expect(sheet.top).toBe(80);
    });

    expect(canvas.zoomToPoint).not.toHaveBeenCalled();
    expect(canvas.setViewportTransform).not.toHaveBeenCalled();
  });

  it("refits the viewport when opening a different project with the same page size", async () => {
    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];

    expect(canvas).toBeDefined();
    expect(sheet).toBeDefined();

    sheet.left = 120;
    sheet.top = 80;
    canvas.zoomToPoint.mockClear();
    canvas.setViewportTransform.mockClear();

    const nextProject: Project = {
      ...structuredClone(TEST_PROJECT),
      id: "project-2",
      name: "Fresh Project",
      modifiedAt: "2026-01-02T00:00:00Z",
    };

    act(() => {
      useProjectStore.getState().setCurrentProject(nextProject);
    });

    await waitFor(() => {
      expect(canvas.zoomToPoint).toHaveBeenCalled();
      expect(canvas.setViewportTransform).toHaveBeenCalled();
    });
  });

  it("moves existing images together with the page when the page is dragged", () => {
    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0] as (typeof fabricMock.rectInstances)[number] & {
      isPageSheet?: boolean;
    };
    const image = {
      left: 40,
      top: 60,
      width: 120,
      height: 90,
      set: vi.fn((update: Record<string, unknown>) => {
        Object.assign(image, update);
      }),
      setCoords: vi.fn(),
      getBoundingRect: vi.fn(() => ({
        left: image.left,
        top: image.top,
        width: image.width,
        height: image.height,
      })),
    };

    sheet.isPageSheet = true;
    canvas.add(image);

    const originalSheetLeft = sheet.left ?? 0;
    const originalSheetTop = sheet.top ?? 0;
    const deltaX = 25;
    const deltaY = -15;

    sheet.left = originalSheetLeft + deltaX;
    sheet.top = originalSheetTop + deltaY;

    canvas.emit("object:moving", { target: sheet });

    expect(image.left).toBe(40 + deltaX);
    expect(image.top).toBe(60 + deltaY);
  });

  it("does not move the page when an image is dragged", () => {
    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];
    const originalSheetLeft = sheet.left;
    const originalSheetTop = sheet.top;
    const image = {
      left: 90,
      top: 110,
      width: 100,
      height: 80,
      getBoundingRect: vi.fn(() => ({
        left: image.left,
        top: image.top,
        width: image.width,
        height: image.height,
      })),
    };

    canvas.emit("object:moving", { target: image });

    expect(sheet.left).toBe(originalSheetLeft);
    expect(sheet.top).toBe(originalSheetTop);
  });

  it("brings a selected image to the front when overlapping images exist", () => {
    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const lowerImage = {
      type: "image",
      elementId: "image-1",
      bringToFront: vi.fn(),
    };
    const selectedImage = {
      type: "image",
      elementId: "image-2",
      bringToFront: vi.fn(),
    };

    canvas.add(lowerImage);
    canvas.add(selectedImage);
    canvas.requestRenderAll.mockClear();

    canvas.emit("selection:created", { selected: [selectedImage] });

    expect(selectedImage.bringToFront).toHaveBeenCalledTimes(1);
    expect(lowerImage.bringToFront).not.toHaveBeenCalled();
    expect(canvas.requestRenderAll).toHaveBeenCalled();
  });
});
