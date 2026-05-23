import { describe, expect, it } from "vitest";
import { mmToPx } from "../canvas/sheet";
import { normalizeProjectElementCoordinates } from "../projectCoordinates";
import type { Project } from "../types";

function makeProject(position = { x: 148.5, y: 300 }): Project {
  return {
    id: "project-1",
    name: "Project",
    pages: [
      {
        id: "page-1",
        name: "Page 1",
        elements: [
          {
            id: "image-1",
            elementType: "image",
            src: "/tmp/photo.jpg",
            alt: "Photo",
            position,
            size: { width: 298, height: 200 },
            rotation: 0,
            opacity: 1,
            zIndex: 0,
            locked: false,
            visible: true,
          },
        ],
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
}

describe("page-relative image coordinates", () => {
  it("normalizes safely detectable legacy absolute coordinates that sit outside the page", () => {
    const pageWidth = mmToPx(210);
    const project = makeProject({ x: pageWidth + 50, y: 120 });
    project.pages[0].elements.push({
      ...project.pages[0].elements[0],
      id: "image-2",
      position: { x: pageWidth + 80, y: 150 },
      size: { width: 10, height: 10 },
      zIndex: 1,
    });

    const normalized = normalizeProjectElementCoordinates(project);

    expect(normalized.pages[0].elements[0].position).toEqual({ x: 0, y: 0 });
    expect(normalized.pages[0].elements[1].position).toEqual({ x: 30, y: 30 });
  });

  it("normalizes legacy default centered imports even when the absolute position still fits the page", () => {
    const pageWidth = mmToPx(210);
    const pageHeight = mmToPx(297);
    const centeredX = (pageWidth - 298) / 2;
    const centeredY = (pageHeight - 200) / 2;
    const project = makeProject({ x: centeredX + 131.5, y: centeredY + 59 });

    const normalized = normalizeProjectElementCoordinates(project);

    expect(normalized.pages[0].elements[0].position.x).toBeCloseTo(centeredX);
    expect(normalized.pages[0].elements[0].position.y).toBeCloseTo(centeredY);
  });

  it("leaves already page-relative in-page coordinates unchanged", () => {
    const project = makeProject({ x: 280, y: 100 });

    const normalized = normalizeProjectElementCoordinates(project);

    expect(normalized.pages[0].elements[0].position).toEqual({ x: 280, y: 100 });
  });
});
