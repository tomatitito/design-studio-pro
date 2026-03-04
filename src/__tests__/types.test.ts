import { describe, it, expect } from "vitest";
import type {
  Element,
  ImageElement,
  TextElement,
  ShapeElement,
  GroupElement,
  Page,
  Project,
  ProjectSettings,
  Asset,
  IpcSuccess,
  IpcError,
  IpcResult,
  Position,
  Size,
} from "../types";

describe("Type interfaces", () => {
  describe("Position and Size", () => {
    it("creates a valid Position", () => {
      const pos: Position = { x: 10, y: 20 };
      expect(pos.x).toBe(10);
      expect(pos.y).toBe(20);
    });

    it("creates a valid Size", () => {
      const size: Size = { width: 100, height: 200 };
      expect(size.width).toBe(100);
      expect(size.height).toBe(200);
    });
  });

  describe("Element discriminated union", () => {
    it("creates an ImageElement", () => {
      const img: ImageElement = {
        id: "img-1",
        elementType: "image",
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        rotation: 0,
        opacity: 1,
        zIndex: 0,
        locked: false,
        visible: true,
        src: "/path/to/image.png",
        alt: "Test image",
      };
      expect(img.elementType).toBe("image");
      expect(img.src).toBe("/path/to/image.png");
    });

    it("creates a TextElement", () => {
      const text: TextElement = {
        id: "text-1",
        elementType: "text",
        position: { x: 10, y: 10 },
        size: { width: 200, height: 50 },
        rotation: 0,
        opacity: 1,
        zIndex: 1,
        locked: false,
        visible: true,
        content: "Hello World",
        fontFamily: "Arial",
        fontSize: 16,
        color: "#000000",
      };
      expect(text.elementType).toBe("text");
      expect(text.content).toBe("Hello World");
    });

    it("creates a ShapeElement", () => {
      const shape: ShapeElement = {
        id: "shape-1",
        elementType: "shape",
        position: { x: 50, y: 50 },
        size: { width: 100, height: 100 },
        rotation: 45,
        opacity: 0.8,
        zIndex: 2,
        locked: true,
        visible: true,
        shapeKind: "rectangle",
        fill: "#ff0000",
        stroke: "#000000",
        strokeWidth: 2,
      };
      expect(shape.elementType).toBe("shape");
      expect(shape.shapeKind).toBe("rectangle");
    });

    it("creates a GroupElement with children", () => {
      const child: TextElement = {
        id: "child-1",
        elementType: "text",
        position: { x: 0, y: 0 },
        size: { width: 50, height: 20 },
        rotation: 0,
        opacity: 1,
        zIndex: 0,
        locked: false,
        visible: true,
        content: "Child",
        fontFamily: "Arial",
        fontSize: 12,
        color: "#000",
      };

      const group: GroupElement = {
        id: "group-1",
        elementType: "group",
        position: { x: 0, y: 0 },
        size: { width: 200, height: 200 },
        rotation: 0,
        opacity: 1,
        zIndex: 3,
        locked: false,
        visible: true,
        children: [child],
      };
      expect(group.elementType).toBe("group");
      expect(group.children).toHaveLength(1);
    });

    it("narrows Element type using discriminated union", () => {
      function getElementContent(el: Element): string | null {
        switch (el.elementType) {
          case "text":
            return el.content;
          case "image":
            return el.src;
          case "shape":
            return el.fill;
          case "group":
            return String(el.children.length);
        }
      }

      const textEl: Element = {
        id: "el-1",
        elementType: "text",
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
        rotation: 0,
        opacity: 1,
        zIndex: 0,
        locked: false,
        visible: true,
        content: "Narrowed",
        fontFamily: "Arial",
        fontSize: 14,
        color: "#333",
      };

      expect(getElementContent(textEl)).toBe("Narrowed");
    });
  });

  describe("Page", () => {
    it("creates a valid Page", () => {
      const page: Page = {
        id: "page-1",
        name: "Page 1",
        elements: [],
        width: 1920,
        height: 1080,
        backgroundColor: "#ffffff",
        order: 0,
      };
      expect(page.id).toBe("page-1");
      expect(page.elements).toEqual([]);
    });
  });

  describe("Project and ProjectSettings", () => {
    it("creates valid ProjectSettings", () => {
      const settings: ProjectSettings = {
        width: 210,
        height: 297,
        orientation: "portrait",
        unit: "mm",
      };
      expect(settings.orientation).toBe("portrait");
      expect(settings.unit).toBe("mm");
    });

    it("creates a valid Project", () => {
      const project: Project = {
        id: "proj-1",
        name: "My Project",
        pages: [],
        createdAt: "2026-01-01T00:00:00Z",
        modifiedAt: "2026-01-01T00:00:00Z",
        settings: {
          width: 210,
          height: 297,
          orientation: "portrait",
          unit: "mm",
        },
      };
      expect(project.name).toBe("My Project");
      expect(project.pages).toEqual([]);
    });
  });

  describe("Asset", () => {
    it("creates a valid Asset with dimensions", () => {
      const asset: Asset = {
        id: "asset-1",
        name: "photo.jpg",
        filePath: "/assets/photo.jpg",
        thumbnailPath: "/thumbnails/photo.jpg",
        fileSize: 1024000,
        mimeType: "image/jpeg",
        dimensions: { width: 1920, height: 1080 },
        createdAt: "2026-01-01T00:00:00Z",
      };
      expect(asset.dimensions).toEqual({ width: 1920, height: 1080 });
    });

    it("creates a valid Asset without dimensions", () => {
      const asset: Asset = {
        id: "asset-2",
        name: "document.pdf",
        filePath: "/assets/document.pdf",
        thumbnailPath: null,
        fileSize: 512000,
        mimeType: "application/pdf",
        dimensions: null,
        createdAt: "2026-01-01T00:00:00Z",
      };
      expect(asset.dimensions).toBeNull();
      expect(asset.thumbnailPath).toBeNull();
    });
  });

  describe("IPC types", () => {
    it("creates an IpcSuccess", () => {
      const success: IpcSuccess<string> = { data: "hello" };
      expect(success.data).toBe("hello");
    });

    it("creates an IpcError", () => {
      const error: IpcError = { message: "Something went wrong", code: "E001" };
      expect(error.message).toBe("Something went wrong");
      expect(error.code).toBe("E001");
    });

    it("creates an IpcError without code", () => {
      const error: IpcError = { message: "Failure" };
      expect(error.code).toBeUndefined();
    });

    it("uses IpcResult as a union", () => {
      const result: IpcResult<number> = { data: 42 };
      if ("data" in result) {
        expect(result.data).toBe(42);
      }

      const errResult: IpcResult<number> = {
        message: "Not found",
        code: "404",
      };
      if ("message" in errResult) {
        expect(errResult.message).toBe("Not found");
      }
    });
  });
});
