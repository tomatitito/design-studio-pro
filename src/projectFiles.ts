import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { Element, Project } from "./types";
import { normalizeProjectElementCoordinates } from "./projectCoordinates";

type BackendElement = Omit<Element, "elementType" | "children"> & {
  type: Element["elementType"];
  children?: BackendElement[];
};

function toBackendElement(element: Element): BackendElement {
  const { elementType, ...rest } = element;
  const backend = { ...rest, type: elementType } as BackendElement;
  if (element.elementType === "group") {
    backend.children = element.children.map(toBackendElement);
  }
  return backend;
}

function toBackendProject(project: Project) {
  const normalizedProject = normalizeProjectElementCoordinates(project);
  return {
    ...normalizedProject,
    modifiedAt: new Date().toISOString(),
    pages: normalizedProject.pages.map((page) => ({
      ...page,
      elements: page.elements.map(toBackendElement),
    })),
  };
}

export async function saveProjectAs(project: Project): Promise<string | null> {
  const outputPath = await save({
    title: "Save Project",
    filters: [{ name: "Design Studio Project", extensions: ["dsproj"] }],
    defaultPath: `${project.name || "project"}.dsproj`,
  });

  if (!outputPath) return null;

  await invoke<void>("save_project_data", {
    project: toBackendProject(project),
    outputPath,
  });

  return outputPath;
}
