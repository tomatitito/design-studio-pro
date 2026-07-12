import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Sidebar } from "../components/Sidebar";
import { CanvasProvider } from "../components/CanvasContext";
import { useProjectStore, useUIStore } from "../stores";
import {
  createCalendarMonthPage,
  createCalendarTitlePage,
  findPagePhotoPlaceholders,
} from "../calendarContracts";
import { createPhotoPageProject } from "../projectTemplates";
import { insertSpreadAfter, validateProjectPagination } from "../spreads";
import { CALENDAR_FONT_OPTIONS } from "../textStyles";
import type { CalendarElementRole, Element, Page, Project, Spread } from "../types";

function findElementByRole(elements: Element[] | undefined, role: CalendarElementRole): Element | undefined {
  for (const element of elements ?? []) {
    if (element.role === role) return element;
    if (element.elementType === "group") {
      const child = findElementByRole(element.children, role);
      if (child) return child;
    }
  }
  return undefined;
}

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

function page(id: string): Page {
  return {
    id,
    name: id,
    elements: [],
    width: 210,
    height: 297,
    backgroundColor: "#ffffff",
    order: 0,
  };
}

function spread(id: string): { spread: Spread; left: Page; right: Page } {
  return {
    spread: { id, name: "Spread", leftPageId: `${id}-left`, rightPageId: `${id}-right`, elements: [] },
    left: page(`${id}-left`),
    right: page(`${id}-right`),
  };
}

describe("Sidebar text properties", () => {
  beforeEach(() => {
    useProjectStore.setState({
      currentProject: {
        ...structuredClone(TEST_PROJECT),
        pages: [
          {
            ...structuredClone(TEST_PROJECT.pages[0]),
            elements: [
              {
                id: "title-text",
                elementType: "text",
                role: "title-text",
                content: "März Grüße 2027",
                fontFamily: CALENDAR_FONT_OPTIONS[0].family,
                fontSize: 24,
                color: "#111111",
                fontWeight: "400",
                textAlign: "left",
                letterSpacing: 0,
                position: { x: 0, y: 0 },
                size: { width: 160, height: 40 },
                rotation: 0,
                opacity: 1,
                zIndex: 0,
                locked: false,
                visible: true,
              },
            ],
          },
        ],
      },
      projects: [],
      activePageId: "page-1",
      isDirty: false,
    });
    useUIStore.setState({
      selectedTool: "select",
      selectedElementIds: ["title-text"],
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      sidebarOpen: true,
      activePanel: "properties",
    });
  });

  it("renders the properties panel as a vertical scroll container", () => {
    renderSidebar();

    expect(screen.getByTestId("properties-panel")).toHaveClass("h-full", "overflow-y-auto");
  });

  it("updates selected calendar text styling controls", () => {
    renderSidebar();

    fireEvent.change(screen.getByTestId("text-font-family-select"), {
      target: { value: CALENDAR_FONT_OPTIONS[2].family },
    });
    fireEvent.change(screen.getByTestId("text-font-size-input"), { target: { value: "32" } });
    fireEvent.change(screen.getByTestId("text-color-input"), { target: { value: "#336699" } });
    fireEvent.change(screen.getByTestId("text-font-weight-select"), { target: { value: "700" } });
    fireEvent.change(screen.getByTestId("text-align-select"), { target: { value: "center" } });
    fireEvent.change(screen.getByTestId("text-letter-spacing-input"), { target: { value: "1.5" } });

    const text = useProjectStore
      .getState()
      .currentProject?.pages[0].elements.find((element) => element.id === "title-text");

    expect(text).toMatchObject({
      elementType: "text",
      content: "März Grüße 2027",
      fontFamily: CALENDAR_FONT_OPTIONS[2].family,
      fontSize: 32,
      color: "#336699",
      fontWeight: "700",
      textAlign: "center",
      letterSpacing: 1.5,
    });
    expect(useProjectStore.getState().isDirty).toBe(true);
  });
});

describe("Sidebar calendar themes", () => {
  beforeEach(() => {
    useProjectStore.setState({
      currentProject: {
        ...structuredClone(TEST_PROJECT),
        projectType: "calendar",
        calendar: { year: 2031, locale: "de-DE", themeId: "classic" },
        pages: [
          createCalendarTitlePage({ id: "title", year: 2031 }),
          createCalendarMonthPage(1, { id: "month-1", year: 2031 }),
        ],
      },
      projects: [],
      activePageId: "title",
      isDirty: false,
    });
    useUIStore.setState({
      selectedTool: "select",
      selectedElementIds: [],
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      sidebarOpen: true,
      activePanel: "properties",
    });
  });

  it("applies a calendar theme to all calendar pages", () => {
    renderSidebar();

    fireEvent.click(screen.getByTestId("calendar-theme-ocean"));

    const project = useProjectStore.getState().currentProject;
    expect(project?.calendar?.themeId).toBe("ocean");
    expect(project?.pages[0].elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "title-text", color: "#1e3a8a" }),
        expect.objectContaining({ role: "photo-placeholder" }),
      ]),
    );
    expect(findElementByRole(project?.pages[1].elements, "month-label")).toMatchObject({
      role: "month-label",
      color: "#1e3a8a",
    });
    expect(findElementByRole(project?.pages[1].elements, "date-grid")).toMatchObject({
      role: "date-grid",
      color: "#2563eb",
    });
    expect(project?.pages[1].elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "photo-placeholder" }),
      ]),
    );
    expect(useProjectStore.getState().isDirty).toBe(true);
  });
});

describe("Sidebar calendar photo layouts", () => {
  beforeEach(() => {
    useProjectStore.setState({
      currentProject: {
        ...structuredClone(TEST_PROJECT),
        projectType: "calendar",
        calendar: { year: 2031, locale: "de-DE" },
        pages: [createCalendarMonthPage(1, { id: "month-1", year: 2031 })],
      },
      projects: [],
      activePageId: "month-1",
      isDirty: false,
    });
    useUIStore.setState({
      selectedTool: "select",
      selectedElementIds: [],
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      sidebarOpen: true,
      activePanel: "properties",
    });
  });

  it("renders grouped layout presets and applies one without removing the date grid", () => {
    renderSidebar();

    expect(screen.getByText("1 photo")).toBeInTheDocument();
    expect(screen.getByText("2 photos")).toBeInTheDocument();
    expect(screen.getByText("3 photos")).toBeInTheDocument();
    expect(screen.getByText("4 photos")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("calendar-photo-layout-two-columns"));

    const page = useProjectStore.getState().currentProject?.pages[0];
    expect(findElementByRole(page?.elements, "date-grid")).toBeTruthy();
    expect(page ? findPagePhotoPlaceholders(page) : []).toHaveLength(2);
    expect(useProjectStore.getState().isDirty).toBe(true);
  });

  it("explains that photo layout presets are hidden on title pages", () => {
    useProjectStore.setState({
      currentProject: {
        ...structuredClone(TEST_PROJECT),
        projectType: "calendar",
        calendar: { year: 2031, locale: "de-DE" },
        pages: [createCalendarTitlePage({ id: "title-page", year: 2031 })],
      },
      projects: [],
      activePageId: "title-page",
      isDirty: false,
    });

    renderSidebar();

    expect(screen.getByTestId("calendar-title-layout-help")).toHaveTextContent("Select January");
    expect(screen.queryByText("Calendar Photo Layout")).not.toBeInTheDocument();
  });
});

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

  it("renders the pages list as a shrinkable scroll container", () => {
    renderSidebar();

    expect(screen.getByTestId("pages-list")).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
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

  it("adds and deletes a grouped double page after selected unit", () => {
    useProjectStore.setState({
      currentProject: createPhotoPageProject("2026-01-01T00:00:00Z"),
      projects: [],
      activePageId: "page-3",
      isDirty: false,
    });
    renderSidebar();

    fireEvent.click(screen.getByTestId("add-spread-button"));

    const project = useProjectStore.getState().currentProject;
    const createdSpread = project?.spreads?.[0];
    expect(createdSpread).toBeTruthy();
    expect(screen.getByTestId(`spread-item-${createdSpread?.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`spread-left-${createdSpread?.id}`)).toHaveTextContent("Left");
    expect(screen.getByTestId(`spread-right-${createdSpread?.id}`)).toHaveTextContent("Right");
    expect(useProjectStore.getState().activePageId).toBe(createdSpread?.leftPageId);
    expect(validateProjectPagination(project!)).toEqual([]);

    fireEvent.click(screen.getByTestId(`delete-spread-${createdSpread?.id}`));
    expect(useProjectStore.getState().currentProject?.spreads).toEqual([]);
    expect(useProjectStore.getState().currentProject?.pages.map((item) => item.id)).not.toContain(
      createdSpread?.leftPageId,
    );
  });

  it("shows exact alignment choices before inserting an editable blank plus double page", () => {
    useProjectStore.setState({
      currentProject: { ...structuredClone(TEST_PROJECT), pages: [page("page-1"), page("page-2")] },
      projects: [],
      activePageId: "page-2",
      isDirty: false,
    });
    renderSidebar();

    fireEvent.click(screen.getByTestId("add-spread-button"));

    expect(screen.getByTestId("insert-editable-blank-choice")).toHaveTextContent(
      "Insert editable blank page",
    );
    expect(screen.getByTestId("cancel-spread-insert-choice")).toHaveTextContent("Cancel");

    fireEvent.click(screen.getByTestId("insert-editable-blank-choice"));

    const project = useProjectStore.getState().currentProject;
    expect(project?.spreads).toHaveLength(1);
    expect(project?.pages.some((item) => item.pageKind === "editable-blank" && item.name === "Editable blank page")).toBe(true);
    expect(validateProjectPagination(project!)).toEqual([]);
  });

  it("shows exact deletion guard choices and inserts blank replacement", () => {
    const base = createPhotoPageProject("2026-01-01T00:00:00Z");
    const data = spread("spread-guard");
    const inserted = insertSpreadAfter(base, "unit-page-3", data.spread, data.left, data.right);
    if (inserted.status !== "inserted") throw new Error("expected inserted");
    useProjectStore.setState({
      currentProject: inserted.project,
      projects: [],
      activePageId: "page-1",
      isDirty: false,
    });
    renderSidebar();

    fireEvent.click(screen.getByTestId("delete-page-page-1"));

    expect(screen.getByTestId("insert-blank-replacement-choice")).toHaveTextContent(
      "Insert blank replacement",
    );
    expect(screen.getByTestId("cancel-deletion-choice")).toHaveTextContent("Cancel deletion");

    fireEvent.click(screen.getByTestId("insert-blank-replacement-choice"));

    const project = useProjectStore.getState().currentProject;
    expect(project?.pages[0]).toMatchObject({ pageKind: "editable-blank", elements: [] });
    expect(validateProjectPagination(project!)).toEqual([]);
  });
});
