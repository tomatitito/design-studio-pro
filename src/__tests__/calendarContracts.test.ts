import { describe, expect, it, vi } from "vitest";
import {
  applyCalendarPhotoLayoutPreset,
  applyCalendarThemeToProject,
  CALENDAR_PHOTO_LAYOUT_PRESETS,
  CALENDAR_THEME_PRESETS,
  createCalendarMonthPage,
  createCalendarMonthPageElements,
  createCalendarPhotoPlaceholderElement,
  createCalendarTitlePage,
  findPagePhotoPlaceholders,
  isCalendarElementRole,
  isCalendarPageRole,
  replacePagePhotoPlaceholder,
} from "../calendarContracts";
import { collectProjectExportData } from "../canvas/export";
import { mmToPx } from "../canvas/sheet";
import { CALENDAR_HANDWRITING_FONT_STACK } from "../textStyles";
import type { Element, Page, Project } from "../types";

describe("calendar contracts", () => {
  it("creates title and month pages with persisted calendar roles", () => {
    const titlePage = createCalendarTitlePage({ order: 0, year: 2031 });
    expect(titlePage).toMatchObject({
      id: "calendar-title-page",
      role: "title",
      order: 0,
    });
    expect(titlePage.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "calendar-title-theme", elementType: "shape", role: "theme" }),
        expect.objectContaining({
          id: "calendar-title-photo-placeholder",
          elementType: "image",
          role: "photo-placeholder",
        }),
        expect.objectContaining({
          id: "calendar-title-text",
          elementType: "text",
          role: "title-text",
          content: "Kalender 2031",
          fontFamily: CALENDAR_HANDWRITING_FONT_STACK,
        }),
        expect.objectContaining({
          id: "calendar-subtitle-text",
          elementType: "text",
          role: "subtitle-text",
        }),
      ]),
    );

    const januaryPage = createCalendarMonthPage(1, { order: 1, year: 2031 });
    expect(januaryPage).toMatchObject({
      id: "calendar-month-1",
      name: "Januar",
      role: "month",
      calendar: { month: 1 },
      order: 1,
    });
    expect(januaryPage.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "calendar-month-1-photo-1", role: "photo-placeholder" }),
        expect.objectContaining({ id: "calendar-month-1-photo-2", role: "photo-placeholder" }),
        expect.objectContaining({ id: "calendar-month-1-photo-3", role: "photo-placeholder" }),
        expect.objectContaining({ id: "calendar-month-1-photo-4", role: "photo-placeholder" }),
        expect.objectContaining({ id: "calendar-month-1-label", role: "month-label", content: "Januar 2031" }),
        expect.objectContaining({ id: "calendar-month-1-date-grid", role: "date-grid" }),
      ]),
    );
  });

  it("converts the DIN A4 title layout from millimetres to display pixels", () => {
    const titlePage = createCalendarTitlePage({ year: 2031 });
    const theme = titlePage.elements.find((element) => element.id === "calendar-title-theme");
    const placeholder = titlePage.elements.find(
      (element) => element.id === "calendar-title-photo-placeholder",
    );
    const title = titlePage.elements.find((element) => element.id === "calendar-title-text");
    const subtitle = titlePage.elements.find((element) => element.id === "calendar-subtitle-text");

    expect(titlePage).toMatchObject({ width: 210, height: 297 });
    expect(theme).toMatchObject({
      position: { x: 0, y: 0 },
      size: { width: mmToPx(210), height: mmToPx(122) },
    });
    expect(placeholder).toMatchObject({
      position: { x: mmToPx(18), y: mmToPx(22) },
      size: { width: mmToPx(174), height: mmToPx(92) },
    });
    expect(title).toMatchObject({
      position: { x: mmToPx(18), y: mmToPx(143) },
      size: { width: mmToPx(174), height: mmToPx(34) },
    });
    expect(subtitle).toMatchObject({
      position: { x: mmToPx(18), y: mmToPx(181) },
      size: { width: mmToPx(174), height: mmToPx(20) },
    });
  });

  it("creates January with four editable photo placeholders in a 2x2 layout", () => {
    const elements = createCalendarMonthPageElements(2024, 1);
    const placeholders = elements.filter((element) => element.role === "photo-placeholder");
    const dateGrid = elements.find((element) => element.role === "date-grid");

    expect(placeholders).toHaveLength(4);
    expect(placeholders).toEqual([
      expect.objectContaining({
        elementType: "image",
        src: "",
        locked: false,
        position: { x: mmToPx(18), y: mmToPx(20) },
        size: { width: mmToPx(83), height: mmToPx(63) },
      }),
      expect.objectContaining({
        elementType: "image",
        src: "",
        locked: false,
        position: { x: mmToPx(109), y: mmToPx(20) },
        size: { width: mmToPx(83), height: mmToPx(63) },
      }),
      expect.objectContaining({
        elementType: "image",
        src: "",
        locked: false,
        position: { x: mmToPx(18), y: mmToPx(91) },
        size: { width: mmToPx(83), height: mmToPx(63) },
      }),
      expect.objectContaining({
        elementType: "image",
        src: "",
        locked: false,
        position: { x: mmToPx(109), y: mmToPx(91) },
        size: { width: mmToPx(83), height: mmToPx(63) },
      }),
    ]);
    expect(dateGrid).toMatchObject({
      elementType: "text",
      content: "Mo Di Mi Do Fr Sa So\n 1  2  3  4  5  6  7\n 8  9 10 11 12 13 14\n15 16 17 18 19 20 21\n22 23 24 25 26 27 28\n29 30 31            ",
    });
  });

  it("exports title template elements at their intended DIN A4 millimetre positions", () => {
    const emptyTitlePage = createCalendarTitlePage({ year: 2031 });
    const titlePage = replacePagePhotoPlaceholder(emptyTitlePage, "calendar-title-photo-placeholder", {
      src: "/photos/title.jpg",
    });
    const project: Project = {
      id: "calendar-1",
      name: "Kalender 2031",
      projectType: "calendar",
      calendar: { year: 2031, locale: "de-DE" },
      pages: [titlePage],
      createdAt: "2026-06-11T00:00:00.000Z",
      modifiedAt: "2026-06-11T00:00:00.000Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
    };

    const data = collectProjectExportData({} as never, project);
    const [page] = data.pages ?? [];
    const title = page?.texts.find((text) => text.content === "Kalender 2031");
    const placeholder = page?.images.find((image) => image.imagePath === "/photos/title.jpg");

    expect(page?.page).toMatchObject({ widthMm: 210, heightMm: 297 });
    expect(title?.xMm).toBeCloseTo(18);
    expect(title?.yMm).toBeCloseTo(143);
    expect(title?.widthMm).toBeCloseTo(174);
    expect(title?.heightMm).toBeCloseTo(34);
    expect(placeholder?.xMm).toBeCloseTo(18);
    expect(placeholder?.yMm).toBeCloseTo(22);
    expect(placeholder?.widthMm).toBeCloseTo(174);
    expect(placeholder?.heightMm).toBeCloseTo(92);
  });

  it("skips empty calendar photo placeholders in PDF export data", () => {
    const titlePage = createCalendarTitlePage({ year: 2031 });
    const project: Project = {
      id: "calendar-1",
      name: "Kalender 2031",
      projectType: "calendar",
      calendar: { year: 2031, locale: "de-DE" },
      pages: [titlePage],
      createdAt: "2026-06-11T00:00:00.000Z",
      modifiedAt: "2026-06-11T00:00:00.000Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
    };

    const data = collectProjectExportData({} as never, project);
    const [page] = data.pages ?? [];

    expect(findPagePhotoPlaceholders(titlePage)).toHaveLength(1);
    expect(page?.texts.some((text) => text.content === "Kalender 2031")).toBe(true);
    expect(page?.images).toEqual([]);
  });

  it("defines known page and element roles", () => {
    expect(isCalendarPageRole("title")).toBe(true);
    expect(isCalendarPageRole("month")).toBe(true);
    expect(isCalendarPageRole("photo-page")).toBe(false);

    for (const role of [
      "photo-placeholder",
      "title-text",
      "subtitle-text",
      "month-label",
      "date-grid",
      "theme",
      "decorative",
    ]) {
      expect(isCalendarElementRole(role)).toBe(true);
    }
  });

  it("creates unique default photo placeholder ids within the same millisecond", () => {
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(1234567890);

    const first = createCalendarPhotoPlaceholderElement();
    const second = createCalendarPhotoPlaceholderElement();
    dateNow.mockRestore();

    expect(first.id).toMatch(/^photo-placeholder-1234567890-\d+$/);
    expect(second.id).toMatch(/^photo-placeholder-1234567890-\d+$/);
    expect(first.id).not.toBe(second.id);
  });

  it("finds and replaces photo placeholders by element role without changing layout", () => {
    const placeholder = createCalendarPhotoPlaceholderElement({
      id: "slot-1",
      position: { x: 10, y: 20 },
      size: { width: 80, height: 60 },
    });
    const page: Page = createCalendarMonthPage(2, { elements: [placeholder] });

    const replaced = replacePagePhotoPlaceholder(page, "slot-1", {
      src: "/photos/winter.jpg",
      assetId: "asset-1",
      alt: "Winter",
    });

    expect(findPagePhotoPlaceholders(replaced)).toHaveLength(1);
    expect(replaced.elements[0]).toMatchObject({
      id: "slot-1",
      elementType: "image",
      role: "photo-placeholder",
      src: "/photos/winter.jpg",
      assetId: "asset-1",
      alt: "Winter",
      position: { x: 10, y: 20 },
      size: { width: 80, height: 60 },
    });
  });

  it("ships calendar photo layout presets grouped from one to four photos", () => {
    expect(CALENDAR_PHOTO_LAYOUT_PRESETS.map((preset) => preset.photoCount)).toEqual(
      expect.arrayContaining([1, 2, 3, 4]),
    );
    expect(CALENDAR_PHOTO_LAYOUT_PRESETS.find((preset) => preset.id === "four-grid-2x2")?.slots).toHaveLength(4);
    expect(CALENDAR_PHOTO_LAYOUT_PRESETS.some((preset) => preset.id === "three-hero-left")).toBe(true);
    expect(CALENDAR_PHOTO_LAYOUT_PRESETS.some((preset) => preset.id === "four-hero-top")).toBe(true);
  });

  it("applies calendar themes across title and month pages while preserving contract elements and assigned images", () => {
    const titlePage = replacePagePhotoPlaceholder(createCalendarTitlePage({ year: 2031 }), "calendar-title-photo-placeholder", {
      src: "/photos/title.jpg",
      assetId: "title-asset",
    });
    const januaryPage = replacePagePhotoPlaceholder(createCalendarMonthPage(1, { year: 2031 }), "calendar-month-1-photo-1", {
      src: "/photos/january.jpg",
      assetId: "january-asset",
    });
    const project: Project = {
      id: "calendar-1",
      name: "Kalender 2031",
      projectType: "calendar",
      calendar: { year: 2031, locale: "de-DE" },
      pages: [titlePage, januaryPage],
      createdAt: "2026-06-11T00:00:00.000Z",
      modifiedAt: "2026-06-11T00:00:00.000Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
    };

    const themed = applyCalendarThemeToProject(project, "forest");
    const preset = CALENDAR_THEME_PRESETS.find((item) => item.id === "forest");
    const themedTitle = themed.pages[0];
    const themedMonth = themed.pages[1];

    expect(themed.calendar?.themeId).toBe("forest");
    expect(themedTitle.backgroundColor).toBe(preset?.tokens.pageBackground);
    expect(themedTitle.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "theme", fill: preset?.tokens.titleBackground }),
        expect.objectContaining({ role: "title-text", color: preset?.tokens.titleText }),
        expect.objectContaining({ role: "subtitle-text", color: preset?.tokens.subtitleText }),
        expect.objectContaining({ role: "photo-placeholder", src: "/photos/title.jpg", assetId: "title-asset" }),
      ]),
    );
    expect(themedMonth.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "month-label", content: "Januar 2031", color: preset?.tokens.monthLabel }),
        expect.objectContaining({ role: "date-grid", color: preset?.tokens.dateGrid }),
        expect.objectContaining({ role: "photo-placeholder", src: "/photos/january.jpg", assetId: "january-asset" }),
      ]),
    );
  });

  it("applies calendar photo layout presets by role while preserving dates and assigned images", () => {
    const page = replacePagePhotoPlaceholder(
      replacePagePhotoPlaceholder(createCalendarMonthPage(1, { year: 2031 }), "calendar-month-1-photo-1", {
        src: "/photos/one.jpg",
        assetId: "asset-one",
      }),
      "calendar-month-1-photo-2",
      { src: "/photos/two.jpg" },
    );

    const updated = applyCalendarPhotoLayoutPreset(page, "three-hero-left");
    const placeholders = findPagePhotoPlaceholders(updated);

    expect(placeholders).toHaveLength(3);
    expect(placeholders[0]).toMatchObject({
      id: "calendar-month-1-photo-1",
      src: "/photos/one.jpg",
      assetId: "asset-one",
      locked: false,
      position: { x: mmToPx(18), y: mmToPx(20) },
      size: { width: mmToPx(105), height: mmToPx(126) },
    });
    expect(placeholders[1]).toMatchObject({ id: "calendar-month-1-photo-2", src: "/photos/two.jpg" });
    expect(updated.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "month-label", content: "Januar 2031" }),
        expect.objectContaining({ role: "date-grid" }),
      ]),
    );
  });

  it("keeps applied layout placeholders above preserved theme layers", () => {
    const theme: Element = {
      id: "month-theme",
      elementType: "shape",
      role: "theme",
      shapeKind: "rectangle",
      fill: "#f3f4f6",
      stroke: "#f3f4f6",
      strokeWidth: 0,
      position: { x: 0, y: 0 },
      size: { width: mmToPx(210), height: mmToPx(160) },
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      locked: true,
      visible: true,
    };
    const page = createCalendarMonthPage(1, {
      year: 2031,
      elements: [theme, ...createCalendarMonthPageElements(2031, 1)],
    });

    const updated = applyCalendarPhotoLayoutPreset(page, "one-full");
    const updatedTheme = updated.elements.find((element) => element.id === "month-theme");
    const monthLabel = updated.elements.find((element) => element.role === "month-label");
    const dateGrid = updated.elements.find((element) => element.role === "date-grid");
    const [placeholder] = findPagePhotoPlaceholders(updated);

    expect(updatedTheme).toMatchObject({ role: "theme", zIndex: 0 });
    expect(placeholder?.zIndex).toBeGreaterThan(updatedTheme?.zIndex ?? Number.MAX_SAFE_INTEGER);
    expect(monthLabel?.zIndex).toBeGreaterThan(placeholder?.zIndex ?? Number.MAX_SAFE_INTEGER);
    expect(dateGrid?.zIndex).toBeGreaterThan(placeholder?.zIndex ?? Number.MAX_SAFE_INTEGER);
    expect(updated.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "month-label", content: "Januar 2031" }),
        expect.objectContaining({ role: "date-grid" }),
      ]),
    );
  });

  it("removes nested photo placeholders by role when applying a calendar layout preset", () => {
    const nested = createCalendarPhotoPlaceholderElement({ id: "nested-slot", src: "/photos/nested.jpg" });
    const group: Element = {
      id: "group-with-slot",
      elementType: "group",
      role: "decorative",
      children: [nested],
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      rotation: 0,
      opacity: 1,
      zIndex: 99,
      locked: false,
      visible: true,
    };
    const page = createCalendarMonthPage(2, { elements: [group] });

    const updated = applyCalendarPhotoLayoutPreset(page, "one-full");

    expect(findPagePhotoPlaceholders(updated)).toHaveLength(1);
    expect(findPagePhotoPlaceholders(updated)[0]).toMatchObject({ id: "nested-slot", src: "/photos/nested.jpg" });
    expect((updated.elements.find((element) => element.id === "group-with-slot") as Extract<Element, { elementType: "group" }>).children).toEqual([]);
  });

  it("finds and replaces placeholders nested in groups", () => {
    const placeholder = createCalendarPhotoPlaceholderElement({ id: "nested-slot" });
    const group: Element = {
      id: "group-1",
      elementType: "group",
      role: "decorative",
      children: [placeholder],
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      locked: false,
      visible: true,
    };
    const page = createCalendarTitlePage({ elements: [group] });

    const replaced = replacePagePhotoPlaceholder(page, "nested-slot", { src: "/photos/title.jpg" });

    expect(findPagePhotoPlaceholders(replaced)[0].src).toBe("/photos/title.jpg");
  });
});
