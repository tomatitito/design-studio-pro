import type { Page, Project, ProjectUnit, Spread, PhysicalSide } from "./types";

export type SpreadInsertionResult =
  | { status: "inserted"; project: Project }
  | { status: "requires-blank"; choices: ["Insert editable blank page", "Cancel"] }
  | { status: "reserved-opening"; reason: string };

export type SingleDeletionResult =
  | { status: "deleted"; project: Project }
  | { status: "requires-blank-replacement"; choices: ["Insert blank replacement", "Cancel deletion"] }
  | { status: "not-single-page" };

export type UnitMoveResult =
  | { status: "moved"; project: Project }
  | { status: "invalid"; reason: string };

export interface PhysicalPageRef {
  page: Page;
  side: PhysicalSide;
  unit: ProjectUnit;
  spread?: Spread;
}

function sortedPages(project: Pick<Project, "pages">): Page[] {
  return [...project.pages].sort((a, b) => a.order - b.order);
}

function sideForPhysicalIndex(index: number): PhysicalSide {
  return index % 2 === 0 ? "right" : "left";
}

function reorderPages(pages: Page[]): Page[] {
  return pages.map((page, order) => ({ ...page, order }));
}

function pageById(project: Pick<Project, "pages">): Map<string, Page> {
  return new Map(project.pages.map((page) => [page.id, page]));
}

function spreadById(project: Pick<Project, "spreads">): Map<string, Spread> {
  return new Map((project.spreads ?? []).map((spread) => [spread.id, spread]));
}

function isReservedPhotoOpening(project: Project): boolean {
  const refs = getPhysicalPages(project);
  return (
    project.projectType === "photo-page" &&
    refs.length >= 3 &&
    refs[0]?.page.name === "Title page" &&
    refs[0]?.side === "right" &&
    refs[1]?.page.pageKind === "editable-blank" &&
    refs[1]?.side === "left" &&
    refs[2]?.side === "right"
  );
}

function isInsideReservedPhotoOpening(project: Project, afterUnitId: string): boolean {
  if (!isReservedPhotoOpening(project)) return false;
  const units = getOrderedUnits(project);
  const index = units.findIndex((unit) => unit.id === afterUnitId);
  return index >= 0 && index < 2;
}

export function createSinglePageUnit(pageId: string): ProjectUnit {
  return { id: `unit-${pageId}`, unitType: "single", pageId };
}

export function createSpreadUnit(spreadId: string): ProjectUnit {
  return { id: `unit-${spreadId}`, unitType: "spread", spreadId };
}

export function normalizeProjectUnits(project: Project): Project {
  if (project.units && project.units.length > 0) {
    return {
      ...project,
      spreads: project.spreads ?? [],
      pages: reorderPages(getPhysicalPages(project).map((ref) => ref.page)),
    };
  }

  const pages = sortedPages(project);
  if (pages.length === 0) return project;
  return {
    ...project,
    spreads: project.spreads ?? [],
    pages: reorderPages(pages),
    units: pages.map((page) => createSinglePageUnit(page.id)),
  };
}

export function getOrderedUnits(project: Project): ProjectUnit[] {
  return normalizeProjectUnits(project).units ?? [];
}

export function getPhysicalPages(project: Project): PhysicalPageRef[] {
  const normalized = project.units ? project : normalizeProjectUnits(project);
  const pages = pageById(normalized);
  const spreads = spreadById(normalized);
  const refs: Omit<PhysicalPageRef, "side">[] = [];

  for (const unit of normalized.units ?? []) {
    if (unit.unitType === "single") {
      const page = pages.get(unit.pageId);
      if (page) refs.push({ page, unit });
      continue;
    }

    const spread = spreads.get(unit.spreadId);
    if (!spread) continue;
    const leftPage = pages.get(spread.leftPageId);
    const rightPage = pages.get(spread.rightPageId);
    if (leftPage && rightPage) {
      refs.push({ page: leftPage, unit, spread }, { page: rightPage, unit, spread });
    }
  }

  return refs.map((ref, index) => ({ ...ref, side: sideForPhysicalIndex(index) }));
}

export function getSideAtInsertionPoint(project: Project, afterUnitId: string | null): PhysicalSide {
  const units = getOrderedUnits(project);
  const spreads = spreadById(normalizeProjectUnits(project));
  const endIndex = afterUnitId ? units.findIndex((unit) => unit.id === afterUnitId) : -1;
  const consumed = units.slice(0, endIndex + 1).reduce((count, unit) => {
    if (unit.unitType === "spread" && spreads.has(unit.spreadId)) return count + 2;
    return count + 1;
  }, 0);
  return sideForPhysicalIndex(consumed);
}

export function validateProjectPagination(project: Project): string[] {
  const normalized = normalizeProjectUnits(project);
  const pages = pageById(normalized);
  const spreads = spreadById(normalized);
  const seenPages = new Set<string>();
  const seenUnits = new Set<string>();
  const errors: string[] = [];
  let physicalIndex = 0;

  for (const unit of normalized.units ?? []) {
    if (seenUnits.has(unit.id)) errors.push(`Duplicate unit ${unit.id}`);
    seenUnits.add(unit.id);

    if (unit.unitType === "single") {
      if (!pages.has(unit.pageId)) errors.push(`Missing page ${unit.pageId}`);
      if (seenPages.has(unit.pageId)) errors.push(`Duplicate page ${unit.pageId}`);
      seenPages.add(unit.pageId);
      physicalIndex += 1;
      continue;
    }

    const spread = spreads.get(unit.spreadId);
    if (!spread) {
      errors.push(`Missing spread ${unit.spreadId}`);
      continue;
    }
    const leftPage = pages.get(spread.leftPageId);
    const rightPage = pages.get(spread.rightPageId);
    if (!leftPage) errors.push(`Missing left page ${spread.leftPageId}`);
    if (!rightPage) errors.push(`Missing right page ${spread.rightPageId}`);
    if (sideForPhysicalIndex(physicalIndex) !== "left") {
      errors.push(`Spread ${spread.id} must start on left side`);
    }
    if (leftPage && rightPage && (leftPage.width !== rightPage.width || leftPage.height !== rightPage.height)) {
      errors.push(`Spread ${spread.id} pages must be equal size`);
    }
    for (const pageId of [spread.leftPageId, spread.rightPageId]) {
      if (seenPages.has(pageId)) errors.push(`Duplicate page ${pageId}`);
      seenPages.add(pageId);
    }
    physicalIndex += 2;
  }

  for (const page of normalized.pages) {
    if (!seenPages.has(page.id)) errors.push(`Unreferenced page ${page.id}`);
  }
  return errors;
}

export function insertSpreadAfter(project: Project, afterUnitId: string, spread: Spread, leftPage: Page, rightPage: Page): SpreadInsertionResult {
  const normalized = normalizeProjectUnits(project);
  if (isInsideReservedPhotoOpening(normalized, afterUnitId)) {
    return {
      status: "reserved-opening",
      reason: "Photo book opening must stay title right, editable blank left, first photo right",
    };
  }
  if (getSideAtInsertionPoint(normalized, afterUnitId) !== "left") {
    return { status: "requires-blank", choices: ["Insert editable blank page", "Cancel"] };
  }

  const insertIndex = (normalized.units ?? []).findIndex((unit) => unit.id === afterUnitId) + 1;
  const units = [...(normalized.units ?? [])];
  units.splice(insertIndex, 0, createSpreadUnit(spread.id));
  const candidate = {
    ...normalized,
    pages: [...getPhysicalPages(normalized).map((ref) => ref.page), leftPage, rightPage],
    spreads: [...(normalized.spreads ?? []), spread],
    units,
  };
  return {
    status: "inserted",
    project: { ...candidate, pages: reorderPages(getPhysicalPages(candidate).map((ref) => ref.page)) },
  };
}

export function deleteSpread(project: Project, spreadId: string): Project {
  const normalized = normalizeProjectUnits(project);
  const spread = (normalized.spreads ?? []).find((item) => item.id === spreadId);
  if (!spread) return normalized;
  const removedPageIds = new Set([spread.leftPageId, spread.rightPageId]);
  return {
    ...normalized,
    spreads: (normalized.spreads ?? []).filter((item) => item.id !== spreadId),
    units: (normalized.units ?? []).filter((unit) => unit.unitType !== "spread" || unit.spreadId !== spreadId),
    pages: reorderPages(getPhysicalPages(normalized).map((ref) => ref.page).filter((page) => !removedPageIds.has(page.id))),
  };
}

export function deleteSinglePage(project: Project, pageId: string, insertBlankReplacement = false): SingleDeletionResult {
  const normalized = normalizeProjectUnits(project);
  const unit = (normalized.units ?? []).find((item) => item.unitType === "single" && item.pageId === pageId);
  if (!unit) return { status: "not-single-page" };

  let pages = getPhysicalPages(normalized).map((ref) => ref.page);
  let units = [...(normalized.units ?? [])];
  const page = pages.find((item) => item.id === pageId);
  if (!page) return { status: "not-single-page" };

  if (insertBlankReplacement) {
    pages = pages.map((item) => (item.id === pageId ? { ...page, id: `${pageId}-blank-replacement`, name: "Blank replacement", elements: [], pageKind: "editable-blank" } : item));
    units = units.map((item) => (item.id === unit.id && item.unitType === "single" ? { ...item, pageId: `${pageId}-blank-replacement` } : item));
  } else {
    pages = pages.filter((item) => item.id !== pageId);
    units = units.filter((item) => item.id !== unit.id);
  }

  const candidate = { ...normalized, pages: reorderPages(pages), units };
  const invalidSpread = validateProjectPagination(candidate).some((error) => error.includes("must start on left side"));
  if (invalidSpread) {
    return { status: "requires-blank-replacement", choices: ["Insert blank replacement", "Cancel deletion"] };
  }
  return { status: "deleted", project: candidate };
}

export function moveUnit(project: Project, unitId: string, toIndex: number): UnitMoveResult {
  const normalized = normalizeProjectUnits(project);
  const units = [...(normalized.units ?? [])];
  const fromIndex = units.findIndex((unit) => unit.id === unitId);
  if (fromIndex === -1) return { status: "invalid", reason: "Missing unit" };
  const [unit] = units.splice(fromIndex, 1);
  units.splice(Math.max(0, Math.min(toIndex, units.length)), 0, unit);
  const candidate = { ...normalized, units, pages: reorderPages(getPhysicalPages({ ...normalized, units }).map((ref) => ref.page)) };
  const errors = validateProjectPagination(candidate);
  if (errors.length > 0) return { status: "invalid", reason: errors[0] };
  return { status: "moved", project: candidate };
}
