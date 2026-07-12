import { afterEach, describe, expect, it } from "vitest";
import type { Canvas as FabricCanvas } from "fabric";
import type { GroupElement, ImageElement, Project, ShapeElement, TextElement } from "../types";
import {
  collectExportData,
  collectProjectExportData,
  resolvePdfImageBorder,
} from "../canvas/export";
import { createCalendarMonthPage } from "../calendarContracts";
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

function group(overrides: Partial<GroupElement>): GroupElement {
  return {
    id: "group-1",
    elementType: "group",
    children: [],
    position: { x: 0, y: 0 },
    size: { width: 200, height: 160 },
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

  it("exports group children at group-relative absolute positions in paint order", () => {
    const project: Project = {
      id: "project-1",
      name: "Grouped layout",
      projectType: "photo-page",
      pages: [
        {
          id: "page-1",
          name: "Page 1",
          elements: [
            shape({ id: "background", zIndex: 0, position: { x: 0, y: 0 } }),
            group({
              zIndex: 1,
              position: { x: 72, y: 144 },
              rotation: 10,
              opacity: 0.5,
              children: [
                image({
                  id: "group-image",
                  zIndex: 2,
                  position: { x: 36, y: 18 },
                  rotation: 5,
                }),
                text({ id: "group-text", zIndex: 1, position: { x: 12, y: 24 } }),
                shape({
                  id: "hidden-child",
                  zIndex: 0,
                  visible: false,
                  position: { x: 1, y: 1 },
                }),
                shape({
                  id: "group-shape",
                  zIndex: 3,
                  position: { x: 24, y: 48 },
                  opacity: 0.8,
                }),
              ],
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
    const page = data.pages?.[0];

    expect(page?.elements.map((element) => element.elementType)).toEqual([
      "shape",
      "text",
      "image",
      "shape",
    ]);
    expect(page?.texts).toEqual([
      expect.objectContaining({
        content: "Kalender 2027",
        xMm: expect.closeTo(29.633333333333333),
        yMm: expect.closeTo(59.266666666666666),
        rotationDeg: 10,
      }),
    ]);
    expect(page?.images).toEqual([
      expect.objectContaining({
        imagePath: "/tmp/photo.png",
        xMm: expect.closeTo(38.1),
        yMm: expect.closeTo(57.15),
        rotationDeg: 15,
      }),
    ]);
    expect(page?.shapes).toEqual([
      expect.objectContaining({ xMm: 0, opacity: 1 }),
      expect.objectContaining({
        xMm: expect.closeTo(33.86666666666667),
        yMm: expect.closeTo(67.73333333333333),
        opacity: 0.4,
        rotationDeg: 10,
      }),
    ]);
  });

  it("exports grouped German calendar data children for PDF backend rendering", () => {
    const monthPage = createCalendarMonthPage(1, { order: 0, year: 2031 });
    const project: Project = {
      id: "calendar-1",
      name: "Calendar",
      projectType: "calendar",
      calendar: { year: 2031, locale: "de-DE" },
      pages: [
        {
          ...monthPage,
          elements: monthPage.elements.map((element) =>
            element.role === "calendar-data"
              ? {
                  ...element,
                  position: { x: 36, y: 72 },
                  rotation: 3,
                  children: element.elementType === "group" ? element.children : [],
                }
              : element,
          ),
        },
      ],
      createdAt: "2026-06-11T00:00:00Z",
      modifiedAt: "2026-06-11T00:00:00Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
    };

    const data = collectProjectExportData({} as FabricCanvas, project);
    const page = data.pages?.[0];

    expect(page?.elements.map((element) => element.elementType)).toEqual([
      "text",
      "text",
    ]);
    expect(page?.texts).toEqual([
      expect.objectContaining({
        content: "Januar 2031",
        xMm: expect.closeTo(12.7),
        yMm: expect.closeTo(25.4),
        widthMm: expect.closeTo(174),
        heightMm: expect.closeTo(14),
        rotationDeg: 3,
      }),
      expect.objectContaining({
        content: expect.stringContaining("Mo Di Mi Do Fr Sa So"),
        xMm: expect.closeTo(12.7),
        yMm: expect.closeTo(45.4),
        widthMm: expect.closeTo(174),
        heightMm: expect.closeTo(44),
        rotationDeg: 3,
        textAlign: "center",
      }),
    ]);
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
