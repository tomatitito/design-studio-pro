import { getActiveProjectPage, useProjectStore, useUIStore } from "../stores";
import { updateElementById } from "../elementTree";
import "../documentHistory";
import type { Element, Project } from "../types";
import type { EditorAPI } from "./sdk";

export function commitDocument(project: Project) {
  useProjectStore.getState().setCurrentProject(project);
  useProjectStore.getState().setDirty(true);
}
export const editor: EditorAPI = {
  getSnapshot() {
    const { currentProject, activePageId } = useProjectStore.getState();
    return structuredClone({
      project: currentProject,
      activePage: getActiveProjectPage(currentProject, activePageId),
      selection: useUIStore.getState().selectedElementIds,
    });
  },
  subscribe(listener) {
    const notify = () => { try { listener(); } catch (error) { console.error("Extension observer", error); } };
    const project = useProjectStore.subscribe((next, prev) => {
      if (next.currentProject !== prev.currentProject || next.activePageId !== prev.activePageId) notify();
    });
    const ui = useUIStore.subscribe((next, prev) => {
      if (next.selectedElementIds !== prev.selectedElementIds) notify();
    });
    return () => { project(); ui(); };
  },
  edit(request) {
    const current = useProjectStore.getState().currentProject;
    if (!current || request.projectId !== current.id) throw new Error("Project changed or absent");
    if (!Array.isArray(request.operations) || !request.operations.length || request.operations.length > 1000)
      throw new Error("Expected 1–1000 operations");
    const project = structuredClone(current);
    for (const operation of request.operations) {
      if (!operation || typeof operation !== "object") throw new Error("Invalid operation");
      const page = project.pages.find((page) => page.id === operation.pageId);
      if (!page) throw new Error("Page not found");
      if (operation.type === "page.background") {
        validateColor(operation.color);
        page.backgroundColor = operation.color;
      } else if (operation.type === "text.content" || operation.type === "element.color") {
        if (project.spreads?.some((spread) => spread.leftPageId === page.id || spread.rightPageId === page.id))
          throw new Error("API v1 element edits support single pages only");
        if (hasLockedAncestor(page.elements, operation.elementId))
          throw new Error("Element or ancestor is locked");
        if (operation.type === "element.color") validateColor(operation.color);
        if (operation.type === "text.content" &&
            (typeof operation.content !== "string" || operation.content.length > 100000))
          throw new Error("Invalid text content");
        const result = updateElementById(page.elements, operation.elementId, (element) => {
          if (element.locked) throw new Error("Element is locked");
          if (operation.type === "text.content") {
            if (element.elementType !== "text") throw new Error("Expected text element");
            return { ...element, content: operation.content };
          }
          if (element.elementType === "text") return { ...element, color: operation.color };
          if (element.elementType === "shape") return { ...element, fill: operation.color };
          throw new Error("Color requires a text or shape element");
        });
        if (!result.updated) throw new Error("Element not found");
        page.elements = result.elements;
      } else throw new Error("Unsupported edit operation");
    }
    if (JSON.stringify(project) === JSON.stringify(current)) return;
    project.modifiedAt = new Date().toISOString();
    commitDocument(project);
  },
};
function validateColor(color: string) {
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))
    throw new Error("Expected #rrggbb color");
}

function hasLockedAncestor(elements: Element[], id: string, locked = false): boolean {
  return elements.some((element) => {
    const isLocked = locked || element.locked;
    return element.id === id ? isLocked : element.elementType === "group"
      && hasLockedAncestor(element.children, id, isLocked);
  });
}
