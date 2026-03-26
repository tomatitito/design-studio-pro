import { describe, expect, it, vi } from "vitest";
import { createPageSheet, updatePageSheet } from "../canvas/sheet";

vi.mock("fabric", () => {
  class MockRect {
    set(update: Record<string, unknown>) {
      Object.assign(this, update);
    }

    setCoords() {}

    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
    }
  }

  class MockShadow {
    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
    }
  }

  class MockGradient {
    constructor(opts: Record<string, unknown> = {}) {
      Object.assign(this, opts);
    }
  }

  class MockPoint {
    x: number;
    y: number;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  }

  return {
    Rect: MockRect,
    Shadow: MockShadow,
    Gradient: MockGradient,
    Point: MockPoint,
  };
});

describe("createPageSheet", () => {
  function makeCanvas() {
    return {
      getWidth: () => 800,
      getHeight: () => 600,
      add: vi.fn(),
      sendObjectToBack: vi.fn(),
      requestRenderAll: vi.fn(),
    };
  }

  it("creates a page sheet that can be dragged on the canvas", () => {
    const canvas = makeCanvas();

    const sheet = createPageSheet(
      canvas as never,
      210,
      297,
      "#ffffff",
    ) as unknown as {
      selectable?: boolean;
      evented?: boolean;
    };

    expect(sheet.selectable).toBe(true);
    expect(sheet.evented).toBe(true);
  });

  it("keeps a dragged page position when only the background changes", () => {
    const canvas = makeCanvas();
    const sheet = createPageSheet(
      canvas as never,
      210,
      297,
      "#ffffff",
    ) as unknown as {
      left: number;
      top: number;
      width: number;
      height: number;
      set: (update: Record<string, unknown>) => void;
      setCoords: () => void;
    };

    sheet.left = 120;
    sheet.top = 80;

    updatePageSheet(
      canvas as never,
      sheet as never,
      210,
      297,
      "linear-gradient(135deg, #0f766e 0%, #38bdf8 100%)",
    );

    expect(sheet.left).toBe(120);
    expect(sheet.top).toBe(80);
  });

  it("pins page sheet origin to top-left for stable centering math", () => {
    const canvas = makeCanvas();

    const sheet = createPageSheet(
      canvas as never,
      210,
      297,
      "#ffffff",
    ) as unknown as {
      originX?: string;
      originY?: string;
    };

    expect(sheet.originX).toBe("left");
    expect(sheet.originY).toBe("top");
  });
});
