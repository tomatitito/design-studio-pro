import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Position } from "../types";
import { logMiddleware } from "./logMiddleware";

export type Tool = "select" | "text" | "shape" | "image" | "pan" | "zoom";
export type Panel = "layers" | "properties" | "assets" | "pages";

export interface UIState {
  selectedTool: Tool;
  selectedElementIds: string[];
  zoom: number;
  panOffset: Position;
  sidebarOpen: boolean;
  activePanel: Panel;
  setSelectedTool: (tool: Tool) => void;
  setSelectedElements: (ids: string[]) => void;
  addSelectedElement: (id: string) => void;
  removeSelectedElement: (id: string) => void;
  clearSelection: () => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: Position) => void;
  toggleSidebar: () => void;
  setActivePanel: (panel: Panel) => void;
}

export const useUIStore = create<UIState>()(
  logMiddleware("uiStore")(immer((set) => ({
    selectedTool: "select",
    selectedElementIds: [],
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    sidebarOpen: true,
    activePanel: "layers",

    setSelectedTool: (tool) =>
      set((state) => {
        state.selectedTool = tool;
      }),

    setSelectedElements: (ids) =>
      set((state) => {
        state.selectedElementIds = ids;
      }),

    addSelectedElement: (id) =>
      set((state) => {
        state.selectedElementIds.push(id);
      }),

    removeSelectedElement: (id) =>
      set((state) => {
        state.selectedElementIds = state.selectedElementIds.filter(
          (elId) => elId !== id,
        );
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedElementIds = [];
      }),

    setZoom: (zoom) =>
      set((state) => {
        state.zoom = zoom;
      }),

    setPanOffset: (offset) =>
      set((state) => {
        state.panOffset = offset;
      }),

    toggleSidebar: () =>
      set((state) => {
        state.sidebarOpen = !state.sidebarOpen;
      }),

    setActivePanel: (panel) =>
      set((state) => {
        state.activePanel = panel;
      }),
  }))),
);
