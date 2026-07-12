import { describe, expect, it } from "vitest";
import {
  deleteSinglePage,
  deleteSpread,
  getPhysicalPages,
  insertSpreadAfter,
  moveUnit,
  normalizeProjectUnits,
  validateProjectPagination,
} from "../spreads";
import { createPhotoPageProject } from "../projectTemplates";
import type { Page, Project, Spread } from "../types";

function page(id: string, order: number): Page {
  return {
    id,
    name: id,
    elements: [],
    width: 210,
    height: 297,
    backgroundColor: "#fff",
    order,
  };
}

function legacyProject(): Project {
  return {
    id: "project-1",
    name: "Legacy",
    pages: [page("p1", 0), page("p2", 1)],
    createdAt: "2026-01-01T00:00:00Z",
    modifiedAt: "2026-01-01T00:00:00Z",
    settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
  };
}

function spread(id = "spread-1"): { spread: Spread; left: Page; right: Page } {
  return {
    spread: { id, name: "Spread", leftPageId: `${id}-left`, rightPageId: `${id}-right`, elements: [] },
    left: page(`${id}-left`, 0),
    right: page(`${id}-right`, 0),
  };
}

describe("spread pagination domain", () => {
  it("creates title/right, blank/left, first-photo/right sequence", () => {
    const project = createPhotoPageProject("2026-01-01T00:00:00Z");
    const physicalPages = getPhysicalPages(project);

    expect(physicalPages.map((ref) => [ref.page.id, ref.side])).toEqual([
      ["page-1", "right"],
      ["page-2", "left"],
      ["page-3", "right"],
    ]);
    expect(physicalPages[1].page.pageKind).toBe("editable-blank");
    expect(validateProjectPagination(project)).toEqual([]);
  });

  it("migrates legacy pages into explicit single units", () => {
    const migrated = normalizeProjectUnits(legacyProject());

    expect(migrated.units).toEqual([
      { id: "unit-p1", unitType: "single", pageId: "p1" },
      { id: "unit-p2", unitType: "single", pageId: "p2" },
    ]);
    expect(migrated.spreads).toEqual([]);
    expect(getPhysicalPages(migrated).map((ref) => ref.side)).toEqual(["right", "left"]);
  });

  it("inserts spread only after reserved title/blank/first-photo opening", () => {
    const project = createPhotoPageProject("2026-01-01T00:00:00Z");
    const data = spread();

    const afterTitle = insertSpreadAfter(project, "unit-page-1", data.spread, data.left, data.right);
    expect(afterTitle).toEqual({
      status: "reserved-opening",
      reason: "Photo book opening must stay title right, editable blank left, first photo right",
    });

    const afterBlank = insertSpreadAfter(project, "unit-page-2", data.spread, data.left, data.right);
    expect(afterBlank).toEqual({
      status: "reserved-opening",
      reason: "Photo book opening must stay title right, editable blank left, first photo right",
    });

    const afterFirstPhoto = insertSpreadAfter(project, "unit-page-3", data.spread, data.left, data.right);
    expect(afterFirstPhoto.status).toBe("inserted");
    if (afterFirstPhoto.status === "inserted") {
      expect(validateProjectPagination(afterFirstPhoto.project)).toEqual([]);
      expect(getPhysicalPages(afterFirstPhoto.project).map((ref) => [ref.page.id, ref.side])).toEqual([
        ["page-1", "right"],
        ["page-2", "left"],
        ["page-3", "right"],
        ["spread-1-left", "left"],
        ["spread-1-right", "right"],
      ]);
    }
  });

  it("moves and deletes spread atomically", () => {
    const base = createPhotoPageProject("2026-01-01T00:00:00Z");
    const data = spread();
    const inserted = insertSpreadAfter(base, "unit-page-3", data.spread, data.left, data.right);
    if (inserted.status !== "inserted") throw new Error("expected inserted");

    expect(moveUnit(inserted.project, "unit-spread-1", 0)).toMatchObject({
      status: "invalid",
      reason: "Spread spread-1 must start on left side",
    });

    const deleted = deleteSpread(inserted.project, "spread-1");
    expect(deleted.spreads).toEqual([]);
    expect(deleted.units?.some((unit) => unit.unitType === "spread")).toBe(false);
    expect(deleted.pages.some((item) => item.id === "spread-1-left" || item.id === "spread-1-right")).toBe(false);
  });

  it("guards single deletion that would invalidate later spread", () => {
    const base = createPhotoPageProject("2026-01-01T00:00:00Z");
    const data = spread();
    const inserted = insertSpreadAfter(base, "unit-page-3", data.spread, data.left, data.right);
    if (inserted.status !== "inserted") throw new Error("expected inserted");

    expect(deleteSinglePage(inserted.project, "page-1")).toEqual({
      status: "requires-blank-replacement",
      choices: ["Insert blank replacement", "Cancel deletion"],
    });

    const replacement = deleteSinglePage(inserted.project, "page-1", true);
    expect(replacement.status).toBe("deleted");
    if (replacement.status === "deleted") {
      expect(replacement.project.pages[0]).toMatchObject({ pageKind: "editable-blank", elements: [] });
      expect(validateProjectPagination(replacement.project)).toEqual([]);
    }
  });
});
