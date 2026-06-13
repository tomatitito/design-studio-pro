import { afterEach, describe, expect, it } from "vitest";
import type { Canvas as FabricCanvas } from "fabric";
import type { ImageElement, Project, ShapeElement, TextElement } from "../types";
import {
  collectExportData,
  collectProjectExportData,
  resolvePdfImageBorder,
} from "../canvas/export";
import { useProjectStore } from "../stores";

function image(overrides: Partial<ImageElement>): ImageElement {
  return {
    id: "image-1",
    elementType: "image",
    src: "/tmp/photo.png",
    alt: "photo",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    locked: false,
    visible: true,
    ...overrides,
  };
}

function shape(overrides: Partial<ShapeElement>): ShapeElement {
  return {
    id: "shape-1",
    elementType: "shape",
    shapeKind: "rectangle",
    fill: "#f4e7d3",
    stroke: "#c084fc",
    strokeWidth: 2,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    locked: false,
    visible: true,
    ...overrides,
  };
}

function text(overrides: Partial<TextElement>): TextElement {
  return {
    id: "title-text",
    elementType: "text",
    role: "title-text",
    content: "Kalender 2027",
    fontFamily: "Arial",
    fontSize: 24,
    color: "#111111",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 40 },
    rotation: 0,
    opacity: 1,
    zIndex: 0,
    locked: false,
    visible: true,
    ...overrides,
  };
}

afterEach(() => {
  useProjectStore.getState().setCurrentProject(null);
});

describe("resolvePdfImageBorder", () => {
  it("uses style preset defaults when only style is set", () => {
    const result = resolvePdfImageBorder(
      image({ borderStyle: "matte-frame", borderColor: undefined, borderWidth: undefined }),
    );

    expect(result).toEqual({
      borderStyle: "matte-frame",
      borderColor: "#f5f1e8",
      borderWidth: expect.closeTo(4.233333333333333),
    });
  });

  it("keeps explicit color and width overrides", () => {
    const result = resolvePdfImageBorder(
      image({ borderStyle: "ornate-gold", borderColor: "#ffffff", borderWidth: 3 }),
    );

    expect(result).toEqual({
      borderStyle: "ornate-gold",
      borderColor: "#ffffff",
      borderWidth: expect.closeTo(1.0583333333333333),
    });
  });

  it("returns empty fields when no border is set", () => {
    expect(resolvePdfImageBorder(image({}))).toEqual({});
  });
});

describe("collectProjectExportData", () => {
  it("normalizes moved/resized text display-pixel coordinates for single-page A4 PDF export data", () => {
    const project: Project = {
      id: "project-1",
      name: "Calendar",
      projectType: "calendar",
      calendar: { year: 2027, locale: "de-DE" },
      pages: [
        {
          id: "page-1",
          name: "Title",
          role: "title",
          elements: [text({ position: { x: 72, y: 144 }, size: { width: 216, height: 36 } })],
          width: 210,
          height: 297,
          backgroundColor: "#ffffff",
          order: 0,
        },
      ],
      createdAt: "2026-06-11T00:00:00Z",
      modifiedAt: "2026-06-11T00:00:00Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
    };
    useProjectStore.getState().setCurrentProject(project);

    const data = collectExportData(
      { getObjects: () => [] } as unknown as FabricCanvas,
      210,
      297,
      "#ffffff",
    );

    expect(data.texts).toEqual([
      expect.objectContaining({
        xMm: expect.closeTo(25.4),
        yMm: expect.closeTo(50.8),
        widthMm: expect.closeTo(76.2),
        heightMm: expect.closeTo(12.7),
      }),
    ]);
  });

  it("exports themed backgrounds, decorative shapes, text, and skips empty placeholders", () => {
    const project: Project = {
      id: "project-1",
      name: "Calendar",
      projectType: "calendar",
      calendar: { year: 2027, locale: "de-DE" },
      pages: [
        {
          id: "page-1",
          name: "Title",
          role: "title",
          elements: [
            shape({ id: "theme-band", role: "theme", zIndex: 0, position: { x: 0, y: 0 } }),
            image({ id: "empty-placeholder", src: "", zIndex: 1, position: { x: 12, y: 12 } }),
            image({
              id: "photo",
              src: "/tmp/photo.png",
              zIndex: 2,
              position: { x: 72, y: 96 },
              borderStyle: "custom",
              borderColor: "#000000",
              borderWidth: 6,
            }),
            text({ zIndex: 3, position: { x: 36, y: 24 } }),
          ],
          width: 210,
          height: 297,
          backgroundColor: "#dce8d8",
          order: 0,
        },
      ],
      createdAt: "2026-06-11T00:00:00Z",
      modifiedAt: "2026-06-11T00:00:00Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
    };

    const data = collectProjectExportData({} as FabricCanvas, project);
    const page = data.pages?.[0];

    expect(page?.page.background).toBe("#dce8d8");
    expect(page?.images).toHaveLength(1);
    expect(page?.shapes).toEqual([
      expect.objectContaining({
        shapeKind: "rectangle",
        fill: "#f4e7d3",
        stroke: "#c084fc",
        opacity: 1,
        xMm: 0,
      }),
    ]);
    expect(page?.elements.map((element) => element.elementType)).toEqual([
      "shape",
      "image",
      "text",
    ]);
    expect(page?.elements[1]).toEqual(
      expect.objectContaining({
        imagePath: "/tmp/photo.png",
        borderColor: "#000000",
        borderWidth: expect.closeTo(2.1166666666666667),
      }),
    );
  });

  it("exports German calendar date-grid text styling for PDF backend rendering", () => {
    const project: Project = {
      id: "project-1",
      name: "Calendar",
      projectType: "calendar",
      calendar: { year: 2027, locale: "de-DE" },
      pages: [
        {
          id: "page-1",
          name: "März",
          role: "month",
          elements: [
            text({
              id: "grid-text",
              role: "date-grid",
              content: "Mo Di Mi Do Fr Sa So\n 1  2  3  4  5  6  7\nGrüße im März",
              position: { x: 36, y: 216 },
              size: { width: 432, height: 144 },
              fontFamily: "Courier New, Courier, monospace",
              fontSize: 10,
              fontWeight: "600",
              textAlign: "center",
              letterSpacing: 0.25,
            }),
          ],
          width: 210,
          height: 297,
          backgroundColor: "#ffffff",
          order: 0,
        },
      ],
      createdAt: "2026-06-11T00:00:00Z",
      modifiedAt: "2026-06-11T00:00:00Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
    };

    const data = collectProjectExportData({} as FabricCanvas, project);

    expect(data.pages?.[0].texts).toEqual([
      expect.objectContaining({
        content: expect.stringContaining("Grüße im März"),
        fontFamily: "Courier New, Courier, monospace",
        fontSize: 10,
        fontWeight: "600",
        textAlign: "center",
        letterSpacing: 0.25,
        xMm: expect.closeTo(12.7),
        yMm: expect.closeTo(76.2),
        widthMm: expect.closeTo(152.4),
        heightMm: expect.closeTo(50.8),
      }),
    ]);
  });

  it("normalizes moved/resized text display-pixel coordinates for multi-page A4 PDF export data", () => {
    const project: Project = {
      id: "project-1",
      name: "Calendar",
      projectType: "calendar",
      calendar: { year: 2027, locale: "de-DE" },
      pages: [
        {
          id: "page-1",
          name: "Title",
          role: "title",
          elements: [
            text({
              position: { x: 72, y: 144 },
              size: { width: 216, height: 36 },
              rotation: 15,
              fontFamily: "Inter",
              fontWeight: "700",
              textAlign: "center",
              letterSpacing: 1.25,
            }),
          ],
          width: 210,
          height: 297,
          backgroundColor: "#ffffff",
          order: 0,
        },
      ],
      createdAt: "2026-06-11T00:00:00Z",
      modifiedAt: "2026-06-11T00:00:00Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
    };

    const data = collectProjectExportData({} as FabricCanvas, project);

    expect(data.pages?.[0].texts).toEqual([
      expect.objectContaining({
        content: "Kalender 2027",
        fontFamily: "Inter",
        fontSize: 24,
        color: "#111111",
        fontWeight: "700",
        textAlign: "center",
        letterSpacing: 1.25,
        xMm: expect.closeTo(25.4),
        yMm: expect.closeTo(50.8),
        widthMm: expect.closeTo(76.2),
        heightMm: expect.closeTo(12.7),
        rotationDeg: 15,
      }),
    ]);
  });
});
