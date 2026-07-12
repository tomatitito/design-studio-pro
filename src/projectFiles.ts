import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Asset, Element, Project } from "./types";
import { normalizeProjectElementCoordinates } from "./projectCoordinates";
import { calendarMetadataOrDefault, projectTypeOrDefault } from "./projectTemplates";
import { normalizeProjectUnits } from "./spreads";

type BackendElement = Omit<Element, "elementType" | "children"> & {
  type: Element["elementType"];
  children?: BackendElement[];
};

type BackendPage = Omit<Project["pages"][number], "elements"> & {
  elements: BackendElement[];
};

type BackendSpread = Omit<NonNullable<Project["spreads"]>[number], "elements"> & {
  elements: BackendElement[];
};

type BackendProject = Omit<Project, "pages" | "spreads"> & {
  pages: BackendPage[];
  spreads?: BackendSpread[];
};

interface LoadProjectResult {
  project: BackendProject;
  assets: Asset[];
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
  const normalizedProject = normalizeProjectUnits(normalizeProjectElementCoordinates(project));
  const projectType = projectTypeOrDefault(normalizedProject);
  const backendProject = {
    ...normalizedProject,
    projectType,
    modifiedAt: new Date().toISOString(),
    pages: normalizedProject.pages.map((page) => ({
      ...page,
      elements: page.elements.map(toBackendElement),
    })),
    units: normalizedProject.units,
    spreads: (normalizedProject.spreads ?? []).map((spread) => ({
      ...spread,
      elements: spread.elements.map(toBackendElement),
    })),
  };

  if (projectType === "calendar") {
    return {
      ...backendProject,
      calendar: calendarMetadataOrDefault(normalizedProject),
    };
  }

  delete backendProject.calendar;
  return backendProject;
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
  const projectType = projectTypeOrDefault(project);
  const frontendProject = {
    ...project,
    projectType,
    pages: project.pages.map((page) => ({
      ...page,
      elements: page.elements.map(toFrontendElement),
    })),
    spreads: (project.spreads ?? []).map((spread) => ({
      ...spread,
      elements: spread.elements.map(toFrontendElement),
    })),
  };

  if (projectType === "calendar") {
    return normalizeProjectUnits(normalizeProjectElementCoordinates({
      ...frontendProject,
      calendar: calendarMetadataOrDefault(project),
    }));
  }

  delete frontendProject.calendar;
  return normalizeProjectUnits(normalizeProjectElementCoordinates(frontendProject));
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
