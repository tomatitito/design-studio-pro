import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Sidebar } from "../components/Sidebar";
import { CanvasProvider } from "../components/CanvasContext";
import { useProjectStore, useUIStore } from "../stores";
import type { Project } from "../types";

const TEST_PROJECT: Project = {
  id: "project-1",
  name: "Project",
  pages: [
    {
      id: "page-1",
      name: "Page 1",
      elements: [],
      width: 210,
      height: 297,
      backgroundColor: "#ffffff",
      order: 0,
    },
  ],
  createdAt: "2026-01-01T00:00:00Z",
  modifiedAt: "2026-01-01T00:00:00Z",
  settings: {
    width: 210,
    height: 297,
    orientation: "portrait",
    unit: "mm",
  },
};

function renderSidebar() {
  render(
    <CanvasProvider>
      <Sidebar />
    </CanvasProvider>,
  );
}

describe("Sidebar pages panel", () => {
  beforeEach(() => {
    useProjectStore.setState({
      currentProject: structuredClone(TEST_PROJECT),
      projects: [],
      activePageId: "page-1",
      isDirty: false,
    });
    useUIStore.setState({
      selectedTool: "select",
      selectedElementIds: [],
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      sidebarOpen: true,
      activePanel: "pages",
    });
  });

  it("adds pages, switches active page, and deletes a non-final page", () => {
    renderSidebar();

    expect(screen.getByTestId("page-item-page-1")).toBeInTheDocument();
    expect(screen.getByTestId("select-page-page-1")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("delete-page-page-1")).toBeDisabled();

    fireEvent.click(screen.getByTestId("add-page-button"));
    fireEvent.click(screen.getByTestId("add-page-button"));

    const pagesAfterAdd = useProjectStore.getState().currentProject?.pages ?? [];
    expect(pagesAfterAdd).toHaveLength(3);
    expect(useProjectStore.getState().isDirty).toBe(true);

    const secondPage = pagesAfterAdd[1];
    const thirdPage = pagesAfterAdd[2];
    expect(secondPage.width).toBe(TEST_PROJECT.settings.width);
    expect(secondPage.height).toBe(TEST_PROJECT.settings.height);
    expect(secondPage.backgroundColor).toBe("#ffffff");
    expect(useProjectStore.getState().activePageId).toBe(thirdPage.id);

    fireEvent.click(screen.getByTestId(`select-page-${secondPage.id}`));
    expect(useProjectStore.getState().activePageId).toBe(secondPage.id);
    expect(screen.getByTestId(`select-page-${secondPage.id}`)).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByTestId(`delete-page-${thirdPage.id}`));
    const pagesAfterDelete = useProjectStore.getState().currentProject?.pages ?? [];
    expect(pagesAfterDelete.map((page) => page.id)).not.toContain(thirdPage.id);
    expect(pagesAfterDelete).toHaveLength(2);
  });
});
