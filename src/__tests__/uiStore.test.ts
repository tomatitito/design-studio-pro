import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../stores/uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      selectedTool: "select",
      selectedElementIds: [],
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      sidebarOpen: true,
      activePanel: "layers",
    });
  });

  describe("setSelectedTool", () => {
    it("sets the selected tool", () => {
      useUIStore.getState().setSelectedTool("text");
      expect(useUIStore.getState().selectedTool).toBe("text");
    });

    it("changes between tools", () => {
      useUIStore.getState().setSelectedTool("shape");
      useUIStore.getState().setSelectedTool("pan");
      expect(useUIStore.getState().selectedTool).toBe("pan");
    });
  });

  describe("selection management", () => {
    it("setSelectedElements sets the selected element ids", () => {
      useUIStore.getState().setSelectedElements(["el-1", "el-2"]);
      expect(useUIStore.getState().selectedElementIds).toEqual(["el-1", "el-2"]);
    });

    it("addSelectedElement adds an element id", () => {
      useUIStore.getState().setSelectedElements(["el-1"]);
      useUIStore.getState().addSelectedElement("el-2");
      expect(useUIStore.getState().selectedElementIds).toEqual(["el-1", "el-2"]);
    });

    it("removeSelectedElement removes an element id", () => {
      useUIStore.getState().setSelectedElements(["el-1", "el-2", "el-3"]);
      useUIStore.getState().removeSelectedElement("el-2");
      expect(useUIStore.getState().selectedElementIds).toEqual(["el-1", "el-3"]);
    });

    it("clearSelection empties the selection", () => {
      useUIStore.getState().setSelectedElements(["el-1", "el-2"]);
      useUIStore.getState().clearSelection();
      expect(useUIStore.getState().selectedElementIds).toEqual([]);
    });
  });

  describe("zoom and pan", () => {
    it("setZoom sets the zoom level", () => {
      useUIStore.getState().setZoom(1.5);
      expect(useUIStore.getState().zoom).toBe(1.5);
    });

    it("setPanOffset sets the pan offset", () => {
      useUIStore.getState().setPanOffset({ x: 100, y: -50 });
      expect(useUIStore.getState().panOffset).toEqual({ x: 100, y: -50 });
    });
  });

  describe("sidebar and panels", () => {
    it("toggleSidebar toggles the sidebar state", () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(false);
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarOpen).toBe(true);
    });

    it("setActivePanel sets the active panel", () => {
      useUIStore.getState().setActivePanel("assets");
      expect(useUIStore.getState().activePanel).toBe("assets");
    });
  });
});
