import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mmToPx } from "../canvas/sheet";
import { Canvas } from "../components/Canvas";
import { CanvasProvider } from "../components/CanvasContext";
import { useProjectStore, useUIStore } from "../stores";
import { replacePagePhotoPlaceholder } from "../calendarContracts";
import { createCalendarProject } from "../projectTemplates";
import { CALENDAR_HANDWRITING_FONT_STACK } from "../textStyles";
import type { Project } from "../types";

const fabricMock = vi.hoisted(() => {
  const canvasInstances: MockCanvas[] = [];
  const rectInstances: MockRect[] = [];
  const groupInstances: MockGroup[] = [];

  function originOffset(origin: unknown, size: number): number {
    if (origin === "left" || origin === "top") return 0;
    if (origin === "right" || origin === "bottom") return size;
    return size / 2;
  }

  function getOriginAwareBoundingRect(obj: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    scaleX?: number;
    scaleY?: number;
    originX?: unknown;
    originY?: unknown;
  }) {
    const width = (obj.width ?? 0) * (obj.scaleX ?? 1);
    const height = (obj.height ?? 0) * (obj.scaleY ?? 1);
    return {
      left: (obj.left ?? 0) - originOffset(obj.originX, width),
      top: (obj.top ?? 0) - originOffset(obj.originY, height),
      width,
      height,
    };
  }

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
      if (obj && typeof obj === "object") {
        (obj as { canvas?: MockCanvas }).canvas = this;
      }
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
    getPointer = vi.fn();

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
    scaleX = 1;
    scaleY = 1;
    originX = "center";
    originY = "center";
    fill?: unknown;
    selectable?: boolean;
    evented?: boolean;
    set = vi.fn((update: Record<string, unknown>) => {
      Object.assign(this, update);
    });
    setCoords = vi.fn();
    getBoundingRect = vi.fn(() => getOriginAwareBoundingRect(this));

    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
      rectInstances.push(this);
    }
  }

  class MockGroup {
    type = "group";
    objects: unknown[];
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    scaleX = 1;
    scaleY = 1;
    originX = "center";
    originY = "center";
    elementId = "";
    selectable?: boolean;
    evented?: boolean;
    subTargetCheck?: boolean;
    set = vi.fn((update: Record<string, unknown>) => {
      Object.assign(this, update);
    });
    setCoords = vi.fn();
    getObjects = vi.fn(() => this.objects);
    getBoundingRect = vi.fn(() => getOriginAwareBoundingRect(this));

    constructor(objects: unknown[] = [], opts: Record<string, unknown> = {}) {
      this.objects = objects;
      Object.assign(this, opts);
      this.width = this.width ?? 0;
      this.height = this.height ?? 0;
      for (const obj of objects) {
        const bounds = getOriginAwareBoundingRect(obj as Parameters<typeof getOriginAwareBoundingRect>[0]);
        this.width = Math.max(this.width ?? 0, bounds.left + bounds.width);
        this.height = Math.max(this.height ?? 0, bounds.top + bounds.height);
      }
      groupInstances.push(this);
    }
  }

  class MockTextbox {
    type = "textbox";
    text: string;
    width?: number;
    height?: number;
    left = 0;
    top = 0;
    scaleX = 1;
    scaleY = 1;
    originX = "center";
    originY = "center";
    elementId = "";
    set = vi.fn((update: Record<string, unknown>) => {
      Object.assign(this, update);
    });
    setCoords = vi.fn();
    enterEditing = vi.fn();
    selectAll = vi.fn();
    getBoundingRect = vi.fn(() => getOriginAwareBoundingRect(this));

    constructor(text: string, opts: Record<string, unknown> = {}) {
      this.text = text;
      Object.assign(this, opts);
    }
  }

  const fabricImageFromURL = vi.fn(async (url: string) => {
    const image = {
      type: "image",
      width: 100,
      height: 50,
      src: url,
      left: 0,
      top: 0,
      scaleX: 1,
      scaleY: 1,
      originX: "center",
      originY: "center",
      elementId: "",
      set: vi.fn((update: Record<string, unknown>) => {
        Object.assign(image, update);
      }),
      setCoords: vi.fn(),
      getBoundingRect: vi.fn(() => getOriginAwareBoundingRect(image)),
    };
    return image;
  });

  return { canvasInstances, rectInstances, groupInstances, MockCanvas, MockRect, MockGroup, MockTextbox, fabricImageFromURL };
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
  FabricImage: { fromURL: fabricMock.fabricImageFromURL },
  Group: fabricMock.MockGroup,
  Textbox: fabricMock.MockTextbox,
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

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
  invoke: vi.fn(),
}));

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
    fabricMock.groupInstances.length = 0;
    fabricMock.fabricImageFromURL.mockClear();

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
      activePageId: TEST_PROJECT.pages[0]?.id ?? null,
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

  it("renders January calendar objects at the sheet origin plus their mm offsets", async () => {
    const project = createCalendarProject(2031, "2026-01-01T00:00:00Z");
    const january = project.pages.find((page) => page.id === "calendar-month-1");
    if (!january) throw new Error("January page not found");
    const januaryWithImage = replacePagePhotoPlaceholder(january, "calendar-month-1-photo-1", {
      src: "/photos/january.jpg",
      alt: "January photo",
    });
    project.pages = project.pages.map((page) =>
      page.id === januaryWithImage.id ? januaryWithImage : page,
    );
    useProjectStore.setState({ currentProject: project, activePageId: "calendar-month-1" });

    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];

    await waitFor(() => {
      expect(
        canvas.objects.some(
          (obj) => (obj as { elementId?: string }).elementId === "calendar-month-1-photo-1",
        ),
      ).toBe(true);
      expect(
        canvas.objects.some(
          (obj) => (obj as { elementId?: string }).elementId === "calendar-month-1-photo-2",
        ),
      ).toBe(true);
      expect(
        canvas.objects.some(
          (obj) => (obj as { elementId?: string }).elementId === "calendar-month-1-data",
        ),
      ).toBe(true);
    });

    type RenderedObject = {
      left: number;
      top: number;
      originX?: string;
      originY?: string;
      getBoundingRect: () => { left: number; top: number; width: number; height: number };
      getObjects?: () => RenderedObject[];
    };
    const findObjectById = (objects: unknown[], id: string): RenderedObject | undefined => {
      for (const obj of objects as RenderedObject[]) {
        if ((obj as { elementId?: string }).elementId === id) return obj;
        const child = obj.getObjects ? findObjectById(obj.getObjects(), id) : undefined;
        if (child) return child;
      }
      return undefined;
    };
    const getRenderedObject = (id: string) => findObjectById(canvas.objects, id) as RenderedObject;
    const expectTopLeftOriginAt = (obj: RenderedObject, x: number, y: number) => {
      expect(obj.originX).toBe("left");
      expect(obj.originY).toBe("top");
      expect(obj.left).toBeCloseTo(x);
      expect(obj.top).toBeCloseTo(y);
      const bounds = obj.getBoundingRect();
      expect(bounds.left).toBeCloseTo(x);
      expect(bounds.top).toBeCloseTo(y);
    };

    const image = getRenderedObject("calendar-month-1-photo-1");
    const placeholder = getRenderedObject("calendar-month-1-photo-2");
    const calendarData = getRenderedObject("calendar-month-1-data");
    const dateGrid = getRenderedObject("calendar-month-1-date-grid");

    expectTopLeftOriginAt(image, (sheet.left ?? 0) + mmToPx(18), (sheet.top ?? 0) + mmToPx(20));
    expectTopLeftOriginAt(placeholder, (sheet.left ?? 0) + mmToPx(109), (sheet.top ?? 0) + mmToPx(20));
    expectTopLeftOriginAt(calendarData, (sheet.left ?? 0) + mmToPx(18), (sheet.top ?? 0) + mmToPx(161));
    expectTopLeftOriginAt(dateGrid, 0, mmToPx(20));

    const positionsBefore = project.pages
      .find((page) => page.id === "calendar-month-1")
      ?.elements.map((element) => ({ id: element.id, position: element.position }));

    act(() => {
      useUIStore.getState().toggleSidebar();
      useUIStore.getState().setActivePanel("properties");
    });

    expect(
      useProjectStore
        .getState()
        .currentProject?.pages.find((page) => page.id === "calendar-month-1")
        ?.elements.map((element) => ({ id: element.id, position: element.position })),
    ).toEqual(positionsBefore);
  });

  it("renders group elements as one selectable Fabric group with group-relative children", async () => {
    const project: Project = {
      ...structuredClone(TEST_PROJECT),
      pages: [
        {
          ...structuredClone(TEST_PROJECT.pages[0]),
          elements: [
            {
              id: "group-1",
              elementType: "group",
              position: { x: 50, y: 60 },
              size: { width: 120, height: 90 },
              rotation: 0,
              opacity: 1,
              zIndex: 0,
              locked: false,
              visible: true,
              children: [
                {
                  id: "child-shape",
                  elementType: "shape",
                  shapeKind: "rectangle",
                  fill: "#ff0000",
                  stroke: "#000000",
                  strokeWidth: 0,
                  position: { x: 10, y: 20 },
                  size: { width: 30, height: 40 },
                  rotation: 0,
                  opacity: 1,
                  zIndex: 0,
                  locked: false,
                  visible: true,
                },
              ],
            },
          ],
        },
      ],
    };
    useProjectStore.setState({ currentProject: project, activePageId: "page-1" });

    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];

    await waitFor(() => {
      expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "group-1")).toBe(true);
    });

    const group = canvas.objects.find((obj) => (obj as { elementId?: string }).elementId === "group-1") as {
      type: string;
      left: number;
      top: number;
      selectable: boolean;
      evented: boolean;
      getObjects: () => Array<{ elementId?: string; left?: number; top?: number; selectable?: boolean; evented?: boolean }>;
    };
    expect(group.type).toBe("group");
    expect(group.left).toBeCloseTo((sheet.left ?? 0) + 50);
    expect(group.top).toBeCloseTo((sheet.top ?? 0) + 60);
    expect(group.selectable).toBe(true);
    expect(group.evented).toBe(true);
    expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "child-shape")).toBe(false);

    const child = group.getObjects().find((obj) => obj.elementId === "child-shape");
    expect(child).toMatchObject({
      left: 10,
      top: 20,
      selectable: false,
      evented: false,
    });
  });

  it("persists moved Fabric group geometry to the GroupElement", async () => {
    const project: Project = {
      ...structuredClone(TEST_PROJECT),
      pages: [
        {
          ...structuredClone(TEST_PROJECT.pages[0]),
          elements: [
            {
              id: "group-1",
              elementType: "group",
              position: { x: 50, y: 60 },
              size: { width: 120, height: 90 },
              rotation: 0,
              opacity: 1,
              zIndex: 0,
              locked: false,
              visible: true,
              children: [
                {
                  id: "child-shape",
                  elementType: "shape",
                  shapeKind: "rectangle",
                  fill: "#ff0000",
                  stroke: "#000000",
                  strokeWidth: 0,
                  position: { x: 10, y: 20 },
                  size: { width: 30, height: 40 },
                  rotation: 0,
                  opacity: 1,
                  zIndex: 0,
                  locked: false,
                  visible: true,
                },
              ],
            },
          ],
        },
      ],
    };
    useProjectStore.setState({ currentProject: project, activePageId: "page-1" });

    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];

    await waitFor(() => {
      expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "group-1")).toBe(true);
    });

    const group = canvas.objects.find((obj) => (obj as { elementId?: string }).elementId === "group-1") as {
      left: number;
      top: number;
      width: number;
      height: number;
      scaleX: number;
      scaleY: number;
      angle?: number;
    };

    act(() => {
      group.left = (sheet.left ?? 0) + 80;
      group.top = (sheet.top ?? 0) + 95;
      group.scaleX = 1.5;
      group.scaleY = 2;
      group.angle = 15;
      canvas.emit("object:modified", { target: group });
    });

    const updatedGroup = useProjectStore
      .getState()
      .currentProject?.pages[0].elements.find((element) => element.id === "group-1");
    expect(updatedGroup?.elementType).toBe("group");
    if (updatedGroup?.elementType === "group") {
      expect(updatedGroup.position).toEqual({ x: 80, y: 95 });
      expect(updatedGroup.size).toEqual({ width: 180, height: 180 });
      expect(updatedGroup.rotation).toBe(15);
      expect(updatedGroup.children[0]).toMatchObject({ id: "child-shape", position: { x: 10, y: 20 } });
    }
    expect(useProjectStore.getState().isDirty).toBe(true);
  });

  it("persists moved calendar-data group geometry without rewriting grouped date children", async () => {
    const project = createCalendarProject(2031, "2026-01-01T00:00:00Z");
    useProjectStore.setState({ currentProject: project, activePageId: "calendar-month-1" });

    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];

    await waitFor(() => {
      expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "calendar-month-1-data")).toBe(true);
    });

    const group = canvas.objects.find((obj) => (obj as { elementId?: string }).elementId === "calendar-month-1-data") as {
      left: number;
      top: number;
      width: number;
      height: number;
      scaleX: number;
      scaleY: number;
      angle?: number;
    };

    act(() => {
      group.left = (sheet.left ?? 0) + 12;
      group.top = (sheet.top ?? 0) + 24;
      group.angle = 4;
      canvas.emit("object:modified", { target: group });
    });

    const updatedGroup = useProjectStore
      .getState()
      .currentProject?.pages.find((page) => page.id === "calendar-month-1")
      ?.elements.find((element) => element.id === "calendar-month-1-data");

    expect(updatedGroup?.elementType).toBe("group");
    if (updatedGroup?.elementType === "group") {
      expect(updatedGroup.position).toEqual({ x: 12, y: 24 });
      expect(updatedGroup.rotation).toBe(4);
      expect(updatedGroup.children).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "calendar-month-1-label", position: { x: 0, y: 0 } }),
          expect.objectContaining({ id: "calendar-month-1-date-grid", position: { x: 0, y: mmToPx(20) } }),
        ]),
      );
    }
    expect(useProjectStore.getState().isDirty).toBe(true);
  });

  it("persists modified nested group children by id", async () => {
    const project: Project = {
      ...structuredClone(TEST_PROJECT),
      pages: [
        {
          ...structuredClone(TEST_PROJECT.pages[0]),
          elements: [
            {
              id: "group-1",
              elementType: "group",
              position: { x: 50, y: 60 },
              size: { width: 120, height: 90 },
              rotation: 0,
              opacity: 1,
              zIndex: 0,
              locked: false,
              visible: true,
              children: [
                {
                  id: "child-shape",
                  elementType: "shape",
                  shapeKind: "rectangle",
                  fill: "#ff0000",
                  stroke: "#000000",
                  strokeWidth: 0,
                  position: { x: 10, y: 20 },
                  size: { width: 30, height: 40 },
                  rotation: 0,
                  opacity: 1,
                  zIndex: 0,
                  locked: false,
                  visible: true,
                },
              ],
            },
          ],
        },
      ],
    };
    useProjectStore.setState({ currentProject: project, activePageId: "page-1" });

    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    await waitFor(() => {
      expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "group-1")).toBe(true);
    });

    act(() => {
      canvas.emit("object:modified", {
        target: {
          elementId: "child-shape",
          left: 25,
          top: 35,
          width: 45,
          height: 55,
          scaleX: 1,
          scaleY: 1,
          angle: 5,
        },
      });
    });

    const updatedGroup = useProjectStore
      .getState()
      .currentProject?.pages[0].elements.find((element) => element.id === "group-1");
    expect(updatedGroup?.elementType).toBe("group");
    if (updatedGroup?.elementType === "group") {
      expect(updatedGroup.children[0]).toMatchObject({
        id: "child-shape",
        position: { x: 25, y: 35 },
        size: { width: 45, height: 55 },
        rotation: 5,
      });
    }
  });

  it("renders text elements and persists text edits from Fabric", async () => {
    const project: Project = {
      ...structuredClone(TEST_PROJECT),
      pages: [
        {
          ...structuredClone(TEST_PROJECT.pages[0]),
          elements: [
            {
              id: "title-text",
              elementType: "text",
              content: "Kalender 2027",
              fontFamily: CALENDAR_HANDWRITING_FONT_STACK,
              fontSize: 24,
              color: "#111111",
              fontWeight: "700",
              textAlign: "center",
              letterSpacing: 1.2,
              position: { x: 10, y: 20 },
              size: { width: 160, height: 40 },
              rotation: 0,
              opacity: 1,
              zIndex: 0,
              locked: false,
              visible: true,
            },
          ],
        },
      ],
    };
    useProjectStore.setState({ currentProject: project, activePageId: "page-1" });

    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    await waitFor(() => {
      expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "title-text")).toBe(true);
    });

    const textObject = canvas.objects.find(
      (obj) => (obj as { elementId?: string }).elementId === "title-text",
    ) as { text: string; fontFamily: string; fontWeight: string; textAlign: string; charSpacing: number };
    expect(textObject.text).toBe("Kalender 2027");
    expect(textObject.fontFamily).toBe(CALENDAR_HANDWRITING_FONT_STACK);
    expect(textObject.fontWeight).toBe("700");
    expect(textObject.textAlign).toBe("center");
    expect(textObject.charSpacing).toBe(1200);

    act(() => {
      textObject.text = "Kalender 2028";
      canvas.emit("text:changed", { target: textObject });
    });

    const updatedText = useProjectStore
      .getState()
      .currentProject?.pages[0].elements.find((element) => element.id === "title-text");
    expect(updatedText?.elementType).toBe("text");
    if (updatedText?.elementType === "text") {
      expect(updatedText.content).toBe("Kalender 2028");
    }
  });

  it("adds a selectable editable text box with defaults when using the text tool", async () => {
    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];
    expect(canvas).toBeDefined();
    expect(sheet).toBeDefined();

    act(() => {
      useUIStore.getState().setSelectedTool("text");
      canvas.emit("mouse:down", { scenePoint: { x: (sheet.left ?? 0) + 20, y: (sheet.top ?? 0) + 30 } });
      canvas.emit("mouse:up", { scenePoint: { x: (sheet.left ?? 0) + 20, y: (sheet.top ?? 0) + 30 } });
    });

    const addedText = useProjectStore.getState().currentProject?.pages[0].elements.find(
      (element) => element.elementType === "text" && element.content === "Text",
    );
    expect(addedText).toBeDefined();
    expect(addedText).toMatchObject({
      elementType: "text",
      position: { x: 20, y: 30 },
      size: { width: 70, height: 18 },
      fontSize: 12,
      color: "#111111",
      locked: false,
      visible: true,
    });
    expect(useProjectStore.getState().isDirty).toBe(true);
    expect(useUIStore.getState().selectedTool).toBe("select");
    expect(useUIStore.getState().selectedElementIds).toEqual([addedText?.id]);
    expect(useUIStore.getState().activePanel).toBe("properties");

    await waitFor(() => {
      const textObjects = canvas.objects.filter(
        (obj) => (obj as { elementId?: string }).elementId === addedText?.id,
      ) as Array<{ enterEditing?: ReturnType<typeof vi.fn>; selectAll?: ReturnType<typeof vi.fn> }>;
      expect(textObjects.length).toBeGreaterThan(0);
      expect(canvas.setActiveObject).toHaveBeenCalled();
      const activatedText = canvas.setActiveObject.mock.calls.find(
        ([obj]) => (obj as { elementId?: string }).elementId === addedText?.id,
      )?.[0] as
        | {
            enterEditing?: ReturnType<typeof vi.fn>;
            selectAll?: ReturnType<typeof vi.fn>;
            originX?: string;
            originY?: string;
            left?: number;
            top?: number;
            getBoundingRect?: () => { left: number; top: number };
          }
        | undefined;
      expect(activatedText?.originX).toBe("left");
      expect(activatedText?.originY).toBe("top");
      expect(activatedText?.left).toBeCloseTo((sheet.left ?? 0) + 20);
      expect(activatedText?.top).toBeCloseTo((sheet.top ?? 0) + 30);
      expect(activatedText?.getBoundingRect?.().left).toBeCloseTo((sheet.left ?? 0) + 20);
      expect(activatedText?.getBoundingRect?.().top).toBeCloseTo((sheet.top ?? 0) + 30);
      expect(activatedText?.enterEditing).toHaveBeenCalled();
      expect(activatedText?.selectAll).toHaveBeenCalled();
    });
  });

  it("sizes a new text box from a text-tool drag", () => {
    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];

    act(() => {
      useUIStore.getState().setSelectedTool("text");
      canvas.emit("mouse:down", { scenePoint: { x: (sheet.left ?? 0) + 10, y: (sheet.top ?? 0) + 15 } });
      canvas.emit("mouse:up", { scenePoint: { x: (sheet.left ?? 0) + 90, y: (sheet.top ?? 0) + 55 } });
    });

    const addedText = useProjectStore.getState().currentProject?.pages[0].elements.find(
      (element) => element.elementType === "text" && element.content === "Text",
    );
    expect(addedText).toMatchObject({
      position: { x: 10, y: 15 },
      size: { width: 80, height: 40 },
    });
  });

  it("places a clicked text box near the rendered right and bottom page edges", () => {
    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];
    const x = mmToPx(210) - 40;
    const y = mmToPx(297) - 30;

    act(() => {
      useUIStore.getState().setSelectedTool("text");
      canvas.emit("mouse:down", { scenePoint: { x: (sheet.left ?? 0) + x, y: (sheet.top ?? 0) + y } });
      canvas.emit("mouse:up", { scenePoint: { x: (sheet.left ?? 0) + x, y: (sheet.top ?? 0) + y } });
    });

    const addedText = useProjectStore.getState().currentProject?.pages[0].elements.find(
      (element) => element.elementType === "text" && element.content === "Text",
    );
    expect(addedText?.position.x).toBeCloseTo(x);
    expect(addedText?.position.y).toBeCloseTo(y);
    expect(addedText?.size.width).toBeCloseTo(40);
    expect(addedText?.size.height).toBeCloseTo(18);
  });

  it("sizes a dragged text box near the rendered right and bottom page edges", () => {
    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];
    const start = { x: mmToPx(210) - 100, y: mmToPx(297) - 80 };
    const end = { x: mmToPx(210) - 10, y: mmToPx(297) - 15 };

    act(() => {
      useUIStore.getState().setSelectedTool("text");
      canvas.emit("mouse:down", { scenePoint: { x: (sheet.left ?? 0) + start.x, y: (sheet.top ?? 0) + start.y } });
      canvas.emit("mouse:up", { scenePoint: { x: (sheet.left ?? 0) + end.x, y: (sheet.top ?? 0) + end.y } });
    });

    const addedText = useProjectStore.getState().currentProject?.pages[0].elements.find(
      (element) => element.elementType === "text" && element.content === "Text",
    );
    expect(addedText?.position.x).toBeCloseTo(start.x);
    expect(addedText?.position.y).toBeCloseTo(start.y);
    expect(addedText?.size.width).toBeCloseTo(end.x - start.x);
    expect(addedText?.size.height).toBeCloseTo(end.y - start.y);
  });

  it("renders only the active page content and background when switching pages", async () => {
    const project: Project = {
      ...structuredClone(TEST_PROJECT),
      pages: [
        {
          ...structuredClone(TEST_PROJECT.pages[0]),
          id: "page-1",
          backgroundColor: "#ffffff",
          elements: [
            {
              id: "image-page-1",
              elementType: "image",
              src: "/tmp/page-1.png",
              alt: "Page 1 image",
              position: { x: 10, y: 20 },
              size: { width: 200, height: 100 },
              rotation: 0,
              opacity: 1,
              zIndex: 0,
              locked: false,
              visible: true,
            },
          ],
        },
        {
          ...structuredClone(TEST_PROJECT.pages[0]),
          id: "page-2",
          name: "Page 2",
          backgroundColor: "#22304a",
          order: 1,
          elements: [
            {
              id: "image-page-2",
              elementType: "image",
              src: "/tmp/page-2.png",
              alt: "Page 2 image",
              position: { x: 30, y: 40 },
              size: { width: 50, height: 25 },
              rotation: 0,
              opacity: 1,
              zIndex: 0,
              locked: false,
              visible: true,
            },
          ],
        },
      ],
    };
    useProjectStore.setState({
      currentProject: project,
      activePageId: "page-1",
    });

    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    const sheet = fabricMock.rectInstances[0];

    await waitFor(() => {
      expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "image-page-1")).toBe(true);
    });
    expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "image-page-2")).toBe(false);
    expect(sheet.fill).toBe("#ffffff");

    act(() => {
      useProjectStore.getState().setActivePage("page-2");
    });

    await waitFor(() => {
      expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "image-page-2")).toBe(true);
    });
    expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "image-page-1")).toBe(false);
    expect(sheet.fill).toBe("#22304a");

    act(() => {
      useProjectStore.getState().setActivePage("page-1");
    });

    await waitFor(() => {
      expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "image-page-1")).toBe(true);
    });
    expect(canvas.objects.some((obj) => (obj as { elementId?: string }).elementId === "image-page-2")).toBe(false);
    expect(sheet.fill).toBe("#ffffff");
  });

  it("re-fits the page after the first resize so the sheet stays centered when viewport grows", async () => {
    class TestResizeObserver {
      static instances: TestResizeObserver[] = [];
      callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        TestResizeObserver.instances.push(this);
      }

      observe() {}
      disconnect() {}

      trigger() {
        this.callback([], this as unknown as ResizeObserver);
      }
    }

    let rectCalls = 0;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => {
      rectCalls += 1;
      if (rectCalls === 1) {
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 400,
          top: 0,
          left: 0,
          right: 800,
          bottom: 400,
          toJSON: () => ({}),
        };
      }
      return {
        x: 0,
        y: 0,
        width: 800,
        height: 800,
        top: 0,
        left: 0,
        right: 800,
        bottom: 800,
        toJSON: () => ({}),
      };
    });
    vi.stubGlobal("ResizeObserver", TestResizeObserver);

    render(
      <CanvasProvider>
        <Canvas />
      </CanvasProvider>,
    );

    const canvas = fabricMock.canvasInstances[0];
    expect(canvas).toBeDefined();

    const observer = TestResizeObserver.instances[0];
    expect(observer).toBeDefined();

    const initialFitCalls = canvas.zoomToPoint.mock.calls.length;
    act(() => {
      observer.trigger();
    });

    await waitFor(() => {
      expect(canvas.zoomToPoint.mock.calls.length).toBeGreaterThan(initialFitCalls);
    });
  });
});
