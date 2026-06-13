import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import App from "../App";
import { useHistoryStore, useProjectStore, useUIStore } from "../stores";

const openProjectFromDialogMock = vi.hoisted(() => vi.fn());

// Mock fabric to avoid canvas API issues in test environment
vi.mock("fabric", () => {
  function MockCanvas() {
    return {
      on: vi.fn(),
      off: vi.fn(),
      dispose: vi.fn(),
      setDimensions: vi.fn(),
      requestRenderAll: vi.fn(),
      setZoom: vi.fn(),
      getZoom: vi.fn().mockReturnValue(1),
      setViewportTransform: vi.fn(),
      viewportTransform: [1, 0, 0, 1, 0, 0],
      setCursor: vi.fn(),
      getObjects: vi.fn().mockReturnValue([]),
      getCenterPoint: vi.fn().mockReturnValue({ x: 0, y: 0 }),
      getContext: vi.fn().mockReturnValue({
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
      }),
      discardActiveObject: vi.fn(),
      getActiveObject: vi.fn(),
      getActiveObjects: vi.fn().mockReturnValue([]),
      setActiveObject: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
      selection: true,
      width: 800,
      height: 600,
      getWidth: vi.fn().mockReturnValue(800),
      getHeight: vi.fn().mockReturnValue(600),
      sendObjectToBack: vi.fn(),
      zoomToPoint: vi.fn(),
    };
  }

  class MockRect {
    set = vi.fn();
    setCoords = vi.fn();
    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
    }
  }

  class MockTextbox {
    set = vi.fn();
    setCoords = vi.fn();
    constructor(text: string, opts: Record<string, unknown> = {}) {
      Object.assign(this, opts, { text });
    }
  }

  class MockShadow {
    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
    }
  }

  return {
    Canvas: MockCanvas,
    Rect: MockRect,
    Shadow: MockShadow,
    Textbox: MockTextbox,
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
  };
});

vi.mock("@tauri-apps/api/core");

vi.mock("../projectFiles", () => ({
  openProjectFromDialog: openProjectFromDialogMock,
  saveProjectAs: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    openProjectFromDialogMock.mockReset();
    useProjectStore.setState({
      currentProject: null,
      projects: [],
      activePageId: null,
      isDirty: false,
    });
    useHistoryStore.setState({
      past: [],
      present: null,
      future: [],
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

  it("renders the toolbar", () => {
    render(<App />);
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
  });

  it("renders the canvas container", () => {
    render(<App />);
    expect(screen.getByTestId("canvas-container")).toBeInTheDocument();
  });

  it("renders the status bar", () => {
    render(<App />);
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
  });

  it("renders new project type choices", () => {
    render(<App />);
    expect(screen.getByTestId("new-photo-page-project")).toBeInTheDocument();
    expect(screen.getByTestId("new-calendar-project")).toBeInTheDocument();
  });

  it("renders tool buttons", () => {
    render(<App />);
    expect(screen.getByTestId("tool-select")).toBeInTheDocument();
    expect(screen.getByTestId("tool-text")).toBeInTheDocument();
    expect(screen.getByTestId("tool-shape")).toBeInTheDocument();
    expect(screen.getByTestId("tool-image")).toBeInTheDocument();
  });

  it("renders zoom controls", () => {
    render(<App />);
    expect(screen.getByTestId("zoom-in")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-out")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-level")).toBeInTheDocument();
  });

  it("creates a visible DIN A4 German calendar project from a confirmed year", () => {
    render(<App />);

    fireEvent.click(screen.getByTestId("new-calendar-project"));
    expect(screen.getByTestId("calendar-create-dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("calendar-year-input"), { target: { value: "2031" } });
    fireEvent.click(screen.getByTestId("calendar-create-confirm"));

    const project = useProjectStore.getState().currentProject;
    expect(project?.projectType).toBe("calendar");
    expect(project?.calendar).toEqual({ year: 2031, locale: "de-DE", themeId: "classic" });
    expect(project?.settings).toEqual({
      width: 210,
      height: 297,
      orientation: "portrait",
      unit: "mm",
    });
    expect(project?.pages).toHaveLength(13);
    expect(project?.pages[0]?.name).toBe("Title Page");
    expect(project?.pages[0]?.role).toBe("title");
    expect(project?.pages[0]?.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "title-text", content: "Kalender 2031" }),
        expect.objectContaining({ role: "subtitle-text" }),
        expect.objectContaining({ role: "photo-placeholder" }),
      ]),
    );
    expect(project?.pages[1]).toMatchObject({
      name: "Januar",
      role: "month",
      calendar: { month: 1 },
    });
    expect(project?.pages[1]?.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "month-label", content: "Januar 2031" }),
        expect.objectContaining({ role: "date-grid" }),
      ]),
    );
    expect(
      project?.pages[1]?.elements.filter((element) => element.role === "photo-placeholder"),
    ).toHaveLength(4);
    expect(project?.pages[12]).toMatchObject({
      name: "Dezember",
      role: "month",
      calendar: { month: 12 },
    });
    expect(project?.pages[12]?.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "month-label", content: "Dezember 2031" }),
        expect.objectContaining({ role: "date-grid" }),
      ]),
    );
    expect(
      project?.pages[12]?.elements.filter((element) => element.role === "photo-placeholder"),
    ).toHaveLength(4);
    expect(useProjectStore.getState().activePageId).toBe(project?.pages[1]?.id);
    expect(useUIStore.getState().activePanel).toBe("properties");
    expect(useProjectStore.getState().isDirty).toBe(true);
    expect(screen.getByText("Calendar Photo Layout")).toBeInTheDocument();
    expect(screen.getByText("1 photo")).toBeInTheDocument();
  });

  it("leaves the current project unchanged when calendar creation is canceled", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("new-photo-page-project"));
    const originalProject = useProjectStore.getState().currentProject;

    fireEvent.click(screen.getByTestId("new-calendar-project"));
    fireEvent.change(screen.getByTestId("calendar-year-input"), { target: { value: "2031" } });
    fireEvent.click(screen.getByTestId("calendar-create-cancel"));

    expect(screen.queryByTestId("calendar-create-dialog")).not.toBeInTheDocument();
    expect(useProjectStore.getState().currentProject).toBe(originalProject);
  });

  it("rejects invalid or partial calendar years without changing project state", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("new-photo-page-project"));
    const originalProject = useProjectStore.getState().currentProject;

    fireEvent.click(screen.getByTestId("new-calendar-project"));
    fireEvent.change(screen.getByTestId("calendar-year-input"), { target: { value: "2031abc" } });
    fireEvent.click(screen.getByTestId("calendar-create-confirm"));

    expect(screen.getByTestId("calendar-year-error")).toHaveTextContent("four-digit year");
    expect(useProjectStore.getState().currentProject).toBe(originalProject);
  });

  it("creates a photo page project from the toolbar", () => {
    render(<App />);

    fireEvent.click(screen.getByTestId("new-photo-page-project"));

    const project = useProjectStore.getState().currentProject;
    expect(project?.projectType).toBe("photo-page");
    expect(project?.pages[0]?.name).toBe("Page 1");
  });

  it("opens a saved project from the toolbar", async () => {
    useProjectStore.getState().setDirty(true);
    useHistoryStore.getState().push({ pageId: "old-page" });
    openProjectFromDialogMock.mockResolvedValue({
      id: "opened-project",
      name: "Opened Project",
      pages: [
        {
          id: "opened-page",
          name: "Opened Page",
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
    });

    render(<App />);
    fireEvent.click(screen.getByTestId("open-project"));

    await waitFor(() => {
      expect(useProjectStore.getState().currentProject?.id).toBe("opened-project");
    });
    expect(useProjectStore.getState().activePageId).toBe("opened-page");
    expect(useProjectStore.getState().isDirty).toBe(false);
    expect(useHistoryStore.getState().present).toBeNull();
  });

  it("renders rulers", () => {
    render(<App />);
    expect(screen.getByTestId("ruler-horizontal")).toBeInTheDocument();
    expect(screen.getByTestId("ruler-vertical")).toBeInTheDocument();
    expect(screen.getByTestId("ruler-corner")).toBeInTheDocument();
  });
});
