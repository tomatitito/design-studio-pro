import { describe, it, expect, beforeEach } from "vitest";
import { selectActivePage, useProjectStore } from "../stores/projectStore";
import type { Project, Page } from "../types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Test Project",
    pages: [],
    createdAt: "2026-01-01T00:00:00Z",
    modifiedAt: "2026-01-01T00:00:00Z",
    settings: {
      width: 210,
      height: 297,
      orientation: "portrait",
      unit: "mm",
    },
    ...overrides,
  };
}

function makePage(overrides: Partial<Page> = {}): Page {
  return {
    id: "page-1",
    name: "Page 1",
    elements: [],
    width: 1920,
    height: 1080,
    backgroundColor: "#ffffff",
    order: 0,
    ...overrides,
  };
}

describe("projectStore", () => {
  beforeEach(() => {
    useProjectStore.setState({
      currentProject: null,
      projects: [],
      activePageId: null,
      isDirty: false,
    });
  });

  describe("setCurrentProject", () => {
    it("sets the current project", () => {
      const project = makeProject();
      useProjectStore.getState().setCurrentProject(project);
      expect(useProjectStore.getState().currentProject).toEqual(project);
    });

    it("selects the first ordered page when setting a project", () => {
      const pageTwo = makePage({ id: "pg-2", order: 2 });
      const pageOne = makePage({ id: "pg-1", order: 1 });
      useProjectStore.getState().setCurrentProject(makeProject({ pages: [pageTwo, pageOne] }));
      expect(useProjectStore.getState().activePageId).toBe("pg-1");
      expect(selectActivePage(useProjectStore.getState())?.id).toBe("pg-1");
    });

    it("preserves an existing valid active page when replacing the current project", () => {
      const pageOne = makePage({ id: "pg-1", order: 1 });
      const pageTwo = makePage({ id: "pg-2", order: 2 });
      useProjectStore.getState().setCurrentProject(makeProject({ pages: [pageOne, pageTwo] }));
      useProjectStore.getState().setActivePage("pg-2");
      useProjectStore
        .getState()
        .setCurrentProject(makeProject({ name: "Updated", pages: [pageOne, pageTwo] }));
      expect(useProjectStore.getState().activePageId).toBe("pg-2");
    });

    it("sets current project to null", () => {
      useProjectStore.getState().setCurrentProject(makeProject());
      useProjectStore.getState().setCurrentProject(null);
      expect(useProjectStore.getState().currentProject).toBeNull();
      expect(useProjectStore.getState().activePageId).toBeNull();
    });
  });

  describe("addProject", () => {
    it("adds a project to the list", () => {
      const project = makeProject();
      useProjectStore.getState().addProject(project);
      expect(useProjectStore.getState().projects).toHaveLength(1);
      expect(useProjectStore.getState().projects[0]).toEqual(project);
    });

    it("adds multiple projects", () => {
      useProjectStore.getState().addProject(makeProject({ id: "p1" }));
      useProjectStore.getState().addProject(makeProject({ id: "p2" }));
      expect(useProjectStore.getState().projects).toHaveLength(2);
    });
  });

  describe("updateProject", () => {
    it("updates a project by id", () => {
      useProjectStore.getState().addProject(makeProject({ id: "p1", name: "Old Name" }));
      useProjectStore.getState().updateProject("p1", { name: "New Name" });
      const updated = useProjectStore.getState().projects.find((p) => p.id === "p1");
      expect(updated?.name).toBe("New Name");
    });

    it("does not affect other projects", () => {
      useProjectStore.getState().addProject(makeProject({ id: "p1", name: "First" }));
      useProjectStore.getState().addProject(makeProject({ id: "p2", name: "Second" }));
      useProjectStore.getState().updateProject("p1", { name: "Updated" });
      const second = useProjectStore.getState().projects.find((p) => p.id === "p2");
      expect(second?.name).toBe("Second");
    });
  });

  describe("removeProject", () => {
    it("removes a project by id", () => {
      useProjectStore.getState().addProject(makeProject({ id: "p1" }));
      useProjectStore.getState().addProject(makeProject({ id: "p2" }));
      useProjectStore.getState().removeProject("p1");
      expect(useProjectStore.getState().projects).toHaveLength(1);
      expect(useProjectStore.getState().projects[0].id).toBe("p2");
    });
  });

  describe("setDirty", () => {
    it("sets dirty flag to true", () => {
      useProjectStore.getState().setDirty(true);
      expect(useProjectStore.getState().isDirty).toBe(true);
    });

    it("sets dirty flag to false", () => {
      useProjectStore.getState().setDirty(true);
      useProjectStore.getState().setDirty(false);
      expect(useProjectStore.getState().isDirty).toBe(false);
    });
  });

  describe("setActivePage", () => {
    it("sets the active page to an existing page", () => {
      const pageOne = makePage({ id: "pg-1" });
      const pageTwo = makePage({ id: "pg-2" });
      useProjectStore.getState().setCurrentProject(makeProject({ pages: [pageOne, pageTwo] }));
      useProjectStore.getState().setActivePage("pg-2");
      expect(useProjectStore.getState().activePageId).toBe("pg-2");
      expect(selectActivePage(useProjectStore.getState())?.id).toBe("pg-2");
    });

    it("falls back to a valid active page for an unknown page id", () => {
      useProjectStore
        .getState()
        .setCurrentProject(makeProject({ pages: [makePage({ id: "pg-1" })] }));
      useProjectStore.getState().setActivePage("missing");
      expect(useProjectStore.getState().activePageId).toBe("pg-1");
      expect(selectActivePage(useProjectStore.getState())?.id).toBe("pg-1");
    });
  });

  describe("addPage", () => {
    it("adds a page to the current project", () => {
      useProjectStore.getState().setCurrentProject(makeProject());
      useProjectStore.getState().addPage(makePage());
      expect(useProjectStore.getState().currentProject?.pages).toHaveLength(1);
      expect(useProjectStore.getState().activePageId).toBe("page-1");
    });

    it("does nothing if no current project", () => {
      useProjectStore.getState().addPage(makePage());
      expect(useProjectStore.getState().currentProject).toBeNull();
    });
  });

  describe("removePage", () => {
    it("removes a page from the current project", () => {
      const page = makePage({ id: "pg-1" });
      useProjectStore.getState().setCurrentProject(makeProject({ pages: [page] }));
      useProjectStore.getState().removePage("pg-1");
      expect(useProjectStore.getState().currentProject?.pages).toHaveLength(0);
      expect(useProjectStore.getState().activePageId).toBeNull();
    });

    it("selects another valid page when removing the active page", () => {
      const pageOne = makePage({ id: "pg-1", order: 1 });
      const pageTwo = makePage({ id: "pg-2", order: 2 });
      useProjectStore.getState().setCurrentProject(makeProject({ pages: [pageOne, pageTwo] }));
      useProjectStore.getState().removePage("pg-1");
      expect(useProjectStore.getState().activePageId).toBe("pg-2");
      expect(selectActivePage(useProjectStore.getState())?.id).toBe("pg-2");
    });

    it("keeps active page when removing a different page", () => {
      const pageOne = makePage({ id: "pg-1", order: 1 });
      const pageTwo = makePage({ id: "pg-2", order: 2 });
      useProjectStore.getState().setCurrentProject(makeProject({ pages: [pageOne, pageTwo] }));
      useProjectStore.getState().setActivePage("pg-2");
      useProjectStore.getState().removePage("pg-1");
      expect(useProjectStore.getState().activePageId).toBe("pg-2");
    });

    it("does nothing if no current project", () => {
      useProjectStore.getState().removePage("pg-1");
      expect(useProjectStore.getState().currentProject).toBeNull();
    });
  });

  describe("updatePage", () => {
    it("updates a page in the current project", () => {
      const page = makePage({ id: "pg-1", name: "Old" });
      useProjectStore.getState().setCurrentProject(makeProject({ pages: [page] }));
      useProjectStore.getState().updatePage("pg-1", { name: "New" });
      const updated = useProjectStore.getState().currentProject?.pages.find((p) => p.id === "pg-1");
      expect(updated?.name).toBe("New");
    });

    it("does nothing if no current project", () => {
      useProjectStore.getState().updatePage("pg-1", { name: "New" });
      expect(useProjectStore.getState().currentProject).toBeNull();
    });
  });
});
