import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "../App";

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

  class MockShadow {
    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
    }
  }

  return {
    Canvas: MockCanvas,
    Rect: MockRect,
    Shadow: MockShadow,
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

describe("App", () => {
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

  it("renders tool buttons", () => {
    render(<App />);
    expect(screen.getByTestId("tool-select")).toBeInTheDocument();
    expect(screen.getByTestId("tool-text")).toBeInTheDocument();
    expect(screen.getByTestId("tool-shape")).toBeInTheDocument();
    expect(screen.getByTestId("tool-pan")).toBeInTheDocument();
  });

  it("renders zoom controls", () => {
    render(<App />);
    expect(screen.getByTestId("zoom-in")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-out")).toBeInTheDocument();
    expect(screen.getByTestId("zoom-level")).toBeInTheDocument();
  });

  it("renders rulers", () => {
    render(<App />);
    expect(screen.getByTestId("ruler-horizontal")).toBeInTheDocument();
    expect(screen.getByTestId("ruler-vertical")).toBeInTheDocument();
    expect(screen.getByTestId("ruler-corner")).toBeInTheDocument();
  });
});
