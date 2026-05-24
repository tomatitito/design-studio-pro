import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Element, Project } from "./types";
import { normalizeProjectElementCoordinates } from "./projectCoordinates";

type BackendElement = Omit<Element, "elementType" | "children"> & {
  type: Element["elementType"];
  children?: BackendElement[];
};

type BackendPage = Omit<Project["pages"][number], "elements"> & {
  elements: BackendElement[];
};

type BackendProject = Omit<Project, "pages"> & {
  pages: BackendPage[];
};

interface LoadProjectResult {
  project: BackendProject;
  extractDir: string;
}

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

function toFrontendElement(element: BackendElement): Element {
  const { type, children, ...rest } = element;
  const frontend = { ...rest, elementType: type } as Element;
  if (type === "group") {
    return {
      ...frontend,
      elementType: "group",
      children: (children ?? []).map(toFrontendElement),
    };
  }
  return frontend;
}

function toFrontendProject(project: BackendProject): Project {
  return normalizeProjectElementCoordinates({
    ...project,
    pages: project.pages.map((page) => ({
      ...page,
      elements: page.elements.map(toFrontendElement),
    })),
  });
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

export async function openProjectFromDialog(): Promise<Project | null> {
  const inputPath = await open({
    title: "Open Project",
    multiple: false,
    filters: [{ name: "Design Studio Project", extensions: ["dsproj"] }],
  });

  if (!inputPath) return null;
  const archivePath = Array.isArray(inputPath) ? inputPath[0] : inputPath;
  if (!archivePath) return null;

  const result = await invoke<LoadProjectResult>("load_project", {
    archivePath,
  });

  console.info("[project] opened from", archivePath, "assets extracted to", result.extractDir);

  return toFrontendProject(result.project);
}
