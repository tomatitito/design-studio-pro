import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Project, Page, Spread } from "../types";
import { logMiddleware } from "./logMiddleware";
import { normalizeProjectElementCoordinates } from "../projectCoordinates";
import {
  deleteSinglePage,
  deleteSpread,
  insertSpreadAfter,
  moveUnit,
  normalizeProjectUnits,
  type SingleDeletionResult,
  type SpreadInsertionResult,
  type UnitMoveResult,
} from "../spreads";

export interface ActiveEditingUnit {
  unitType: "single" | "spread";
  id: string;
  page: Page | null;
  spread: Spread | null;
  width: number;
  height: number;
  backgroundColor: string;
  rightBackgroundColor?: string;
}

export interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  activePageId: string | null;
  isDirty: boolean;
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setActivePage: (pageId: string | null) => void;
  setDirty: (dirty: boolean) => void;
  addPage: (page: Page) => void;
  removePage: (pageId: string) => void;
  updatePage: (pageId: string, updates: Partial<Page>) => void;
  updateSpread: (spreadId: string, updates: Partial<Spread>) => void;
  updateActiveElements: (elements: Page["elements"]) => void;
  insertSpreadAfter: (afterUnitId: string, spread: NonNullable<Project["spreads"]>[number], leftPage: Page, rightPage: Page) => SpreadInsertionResult;
  deleteSpread: (spreadId: string) => void;
  deleteSinglePage: (pageId: string, insertBlankReplacement?: boolean) => SingleDeletionResult;
  moveUnit: (unitId: string, toIndex: number) => UnitMoveResult;
}

function getFallbackPage(project: Project | null): Page | null {
  if (!project || project.pages.length === 0) return null;
  return [...project.pages].sort((a, b) => a.order - b.order)[0] ?? null;
}

export function getProjectPageById(project: Project | null, pageId: string | null): Page | null {
  if (!project || !pageId) return null;
  return project.pages.find((page) => page.id === pageId) ?? null;
}

export function getActiveProjectPage(
  project: Project | null,
  activePageId: string | null,
): Page | null {
  return getProjectPageById(project, activePageId) ?? getFallbackPage(project);
}

export function getActiveProjectSpread(project: Project | null, activePageId: string | null): Spread | null {
  if (!project || !activePageId) return null;
  return (project.spreads ?? []).find(
    (spread) => spread.leftPageId === activePageId || spread.rightPageId === activePageId,
  ) ?? null;
}

export function getActiveEditingUnit(
  project: Project | null,
  activePageId: string | null,
): ActiveEditingUnit | null {
  if (!project) return null;
  const spread = getActiveProjectSpread(project, activePageId);
  if (spread) {
    const leftPage = getProjectPageById(project, spread.leftPageId);
    const rightPage = getProjectPageById(project, spread.rightPageId);
    const pageWidth = leftPage?.width ?? rightPage?.width ?? project.settings.width;
    const pageHeight = leftPage?.height ?? rightPage?.height ?? project.settings.height;
    return {
      unitType: "spread",
      id: spread.id,
      page: leftPage ?? rightPage,
      spread,
      width: pageWidth * 2,
      height: pageHeight,
      backgroundColor: leftPage?.backgroundColor ?? "#ffffff",
      rightBackgroundColor: rightPage?.backgroundColor ?? leftPage?.backgroundColor ?? "#ffffff",
    };
  }

  const page = getActiveProjectPage(project, activePageId);
  if (!page) return null;
  return {
    unitType: "single",
    id: page.id,
    page,
    spread: null,
    width: page.width,
    height: page.height,
    backgroundColor: page.backgroundColor,
  };
}

export function selectActivePage(state: ProjectState): Page | null {
  return getActiveProjectPage(state.currentProject, state.activePageId);
}

export const useProjectStore = create<ProjectState>()(
  logMiddleware("projectStore")(
    immer((set) => ({
      currentProject: null,
      projects: [],
      activePageId: null,
      isDirty: false,

      setCurrentProject: (project) =>
        set((state) => {
          const normalizedProject = project
            ? normalizeProjectUnits(normalizeProjectElementCoordinates(project))
            : null;
          state.currentProject = normalizedProject;
          state.activePageId =
            getProjectPageById(normalizedProject, state.activePageId)?.id ??
            getFallbackPage(normalizedProject)?.id ??
            null;
        }),

      addProject: (project) =>
        set((state) => {
          state.projects.push(project);
        }),

      updateProject: (id, updates) =>
        set((state) => {
          const index = state.projects.findIndex((p) => p.id === id);
          if (index !== -1) {
            Object.assign(state.projects[index], updates);
          }
        }),

      removeProject: (id) =>
        set((state) => {
          state.projects = state.projects.filter((p) => p.id !== id);
          if (state.currentProject?.id === id) {
            state.currentProject = null;
            state.activePageId = null;
          }
        }),

      setActivePage: (pageId) =>
        set((state) => {
          state.activePageId =
            getProjectPageById(state.currentProject, pageId)?.id ??
            getFallbackPage(state.currentProject)?.id ??
            null;
        }),

      setDirty: (dirty) =>
        set((state) => {
          state.isDirty = dirty;
        }),

      addPage: (page) =>
        set((state) => {
          if (state.currentProject) {
            state.currentProject = normalizeProjectUnits(state.currentProject);
            state.currentProject.pages.push({ ...page, order: state.currentProject.pages.length });
            state.currentProject.units = [
              ...(state.currentProject.units ?? []),
              { id: `unit-${page.id}`, unitType: "single", pageId: page.id },
            ];
            if (!getProjectPageById(state.currentProject, state.activePageId)) {
              state.activePageId = page.id;
            }
          }
        }),

      removePage: (pageId) =>
        set((state) => {
          if (state.currentProject) {
            state.currentProject = normalizeProjectUnits(state.currentProject);
            state.currentProject.pages = state.currentProject.pages.filter((p) => p.id !== pageId);
            state.currentProject.units = (state.currentProject.units ?? []).filter(
              (unit) => unit.unitType !== "single" || unit.pageId !== pageId,
            );
            if (state.activePageId === pageId) {
              state.activePageId = getFallbackPage(state.currentProject)?.id ?? null;
            }
          }
        }),

      updatePage: (pageId, updates) =>
        set((state) => {
          if (state.currentProject) {
            const index = state.currentProject.pages.findIndex((p) => p.id === pageId);
            if (index !== -1) {
              Object.assign(state.currentProject.pages[index], updates);
            }
          }
        }),

      updateSpread: (spreadId, updates) =>
        set((state) => {
          if (!state.currentProject) return;
          const index = (state.currentProject.spreads ?? []).findIndex((spread) => spread.id === spreadId);
          if (index !== -1) {
            Object.assign(state.currentProject.spreads![index], updates);
          }
        }),

      updateActiveElements: (elements) =>
        set((state) => {
          const active = getActiveEditingUnit(state.currentProject, state.activePageId);
          if (!state.currentProject || !active) return;
          if (active.unitType === "spread") {
            const index = (state.currentProject.spreads ?? []).findIndex((spread) => spread.id === active.id);
            if (index !== -1) state.currentProject.spreads![index].elements = elements;
            return;
          }
          const index = state.currentProject.pages.findIndex((page) => page.id === active.id);
          if (index !== -1) state.currentProject.pages[index].elements = elements;
        }),

      insertSpreadAfter: (afterUnitId, spread, leftPage, rightPage) => {
        let result: SpreadInsertionResult = { status: "requires-blank", choices: ["Insert editable blank page", "Cancel"] };
        set((state) => {
          if (!state.currentProject) return;
          result = insertSpreadAfter(state.currentProject, afterUnitId, spread, leftPage, rightPage);
          if (result.status === "inserted") state.currentProject = result.project;
        });
        return result;
      },

      deleteSpread: (spreadId) =>
        set((state) => {
          if (state.currentProject) state.currentProject = deleteSpread(state.currentProject, spreadId);
          if (!getProjectPageById(state.currentProject, state.activePageId)) {
            state.activePageId = getFallbackPage(state.currentProject)?.id ?? null;
          }
        }),

      deleteSinglePage: (pageId, insertBlankReplacement = false) => {
        let result: SingleDeletionResult = { status: "not-single-page" };
        set((state) => {
          if (!state.currentProject) return;
          result = deleteSinglePage(state.currentProject, pageId, insertBlankReplacement);
          if (result.status === "deleted") state.currentProject = result.project;
          if (!getProjectPageById(state.currentProject, state.activePageId)) {
            state.activePageId = getFallbackPage(state.currentProject)?.id ?? null;
          }
        });
        return result;
      },

      moveUnit: (unitId, toIndex) => {
        let result: UnitMoveResult = { status: "invalid", reason: "No current project" };
        set((state) => {
          if (!state.currentProject) return;
          result = moveUnit(state.currentProject, unitId, toIndex);
          if (result.status === "moved") state.currentProject = result.project;
        });
        return result;
      },
    })),
  ),
);
