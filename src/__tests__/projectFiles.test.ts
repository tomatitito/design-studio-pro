import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openProjectFromDialog, saveProjectAs } from "../projectFiles";
import type { Project } from "../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

describe("projectFiles", () => {
  beforeEach(() => {
    vi.mocked(open).mockReset();
    vi.mocked(save).mockReset();
    vi.mocked(invoke).mockReset();
  });

  it("opens a saved project and converts backend element types for the frontend", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/album.dsproj");
    vi.mocked(invoke).mockResolvedValue({
      project: {
        id: "project-1",
        name: "Album",
        createdAt: "2026-01-01T00:00:00Z",
        modifiedAt: "2026-01-01T00:00:00Z",
        settings: {
          width: 210,
          height: 297,
          orientation: "portrait",
          unit: "mm",
        },
        pages: [
          {
            id: "page-1",
            name: "Page 1",
            width: 210,
            height: 297,
            backgroundColor: "#ffffff",
            order: 0,
            role: "title",
            elements: [
              {
                id: "text-1",
                type: "text",
                role: "title-text",
                content: "Hello",
                fontFamily: "Inter",
                fontSize: 16,
                color: "#111111",
                position: { x: 12, y: 24 },
                size: { width: 80, height: 20 },
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
      assets: [],
      extractDir: "/tmp/design-studio-pro/opened-projects/album",
    });

    const project = await openProjectFromDialog();

    expect(open).toHaveBeenCalledWith({
      title: "Open Project",
      multiple: false,
      filters: [{ name: "Design Studio Project", extensions: ["dsproj"] }],
    });
    expect(invoke).toHaveBeenCalledWith("load_project", {
      archivePath: "/tmp/album.dsproj",
    });
    expect(project?.pages[0]).toMatchObject({ role: "title" });
    expect(project?.pages[0].elements[0]).toMatchObject({
      id: "text-1",
      elementType: "text",
      role: "title-text",
      content: "Hello",
    });
  });

  it("preserves image assetId and extracted src from load_project contract", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/album.dsproj");
    vi.mocked(invoke).mockResolvedValue({
      project: {
        id: "project-1",
        name: "Album",
        createdAt: "2026-01-01T00:00:00Z",
        modifiedAt: "2026-01-01T00:00:00Z",
        settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
        pages: [
          {
            id: "page-1",
            name: "Page 1",
            width: 210,
            height: 297,
            backgroundColor: "#ffffff",
            order: 0,
            elements: [
              {
                id: "element-1",
                type: "image",
                assetId: "asset-1",
                src: "/tmp/extracted/assets/photo.png",
                alt: "photo.png",
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 },
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
      assets: [
        {
          id: "asset-1",
          name: "photo.png",
          filePath: "/tmp/extracted/assets/photo.png",
          thumbnailPath: null,
          fileSize: 10,
          mimeType: "image/png",
          dimensions: { width: 100, height: 50 },
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      extractDir: "/tmp/extracted",
    });

    const project = await openProjectFromDialog();

    expect(project?.pages[0].elements[0]).toMatchObject({
      elementType: "image",
      assetId: "asset-1",
      src: "/tmp/extracted/assets/photo.png",
    });
  });

  it("defaults legacy projects without projectType to photo page", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/legacy.dsproj");
    vi.mocked(invoke).mockResolvedValue({
      project: {
        id: "legacy-project",
        name: "Legacy",
        createdAt: "2026-01-01T00:00:00Z",
        modifiedAt: "2026-01-01T00:00:00Z",
        settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
        pages: [],
      },
      assets: [],
      extractDir: "/tmp/legacy",
    });

    const project = await openProjectFromDialog();

    expect(project?.projectType).toBe("photo-page");
  });

  it("saves grouped German calendar metadata and contract roles for calendar projects", async () => {
    vi.mocked(save).mockResolvedValue("/tmp/calendar.dsproj");
    vi.mocked(invoke).mockResolvedValue(undefined);

    await saveProjectAs({
      id: "calendar-project",
      name: "Calendar",
      projectType: "calendar",
      calendar: { year: 2031, locale: "de-DE" },
      createdAt: "2026-01-01T00:00:00Z",
      modifiedAt: "2026-01-01T00:00:00Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
      pages: [
        {
          id: "calendar-title-page",
          name: "Title Page",
          role: "title",
          width: 210,
          height: 297,
          backgroundColor: "#ffffff",
          order: 0,
          elements: [
            {
              id: "slot-1",
              elementType: "image",
              role: "photo-placeholder",
              src: "",
              alt: "Photo placeholder",
              position: { x: 0, y: 0 },
              size: { width: 100, height: 100 },
              rotation: 0,
              opacity: 1,
              zIndex: 0,
              locked: false,
              visible: true,
            },
          ],
        },
      ],
    });

    expect(invoke).toHaveBeenCalledWith(
      "save_project_data",
      expect.objectContaining({
        project: expect.objectContaining({
          projectType: "calendar",
          calendar: { year: 2031, locale: "de-DE", themeId: "classic" },
          pages: [
            expect.objectContaining({
              role: "title",
              elements: [expect.objectContaining({ type: "image", role: "photo-placeholder" })],
            }),
          ],
        }),
        outputPath: "/tmp/calendar.dsproj",
      }),
    );
  });

  it("saves explicit units and shared spread scene", async () => {
    vi.mocked(save).mockResolvedValue("/tmp/spread.dsproj");
    vi.mocked(invoke).mockResolvedValue(undefined);

    await saveProjectAs({
      id: "spread-project",
      name: "Spread",
      projectType: "photo-page",
      createdAt: "2026-01-01T00:00:00Z",
      modifiedAt: "2026-01-01T00:00:00Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
      pages: [
        { id: "p1", name: "Title", elements: [], width: 210, height: 297, backgroundColor: "#fff", order: 0 },
        { id: "sl", name: "Left", elements: [], width: 210, height: 297, backgroundColor: "#fff", order: 1 },
        { id: "sr", name: "Right", elements: [], width: 210, height: 297, backgroundColor: "#fff", order: 2 },
      ],
      units: [
        { id: "u1", unitType: "single", pageId: "p1" },
        { id: "us", unitType: "spread", spreadId: "s1" },
      ],
      spreads: [
        {
          id: "s1",
          name: "Spread 1",
          leftPageId: "sl",
          rightPageId: "sr",
          elements: [
            {
              id: "text-1",
              elementType: "text",
              content: "Across",
              fontFamily: "Inter",
              fontSize: 16,
              color: "#111111",
              position: { x: 200, y: 24 },
              size: { width: 80, height: 20 },
              rotation: 0,
              opacity: 1,
              zIndex: 0,
              locked: false,
              visible: true,
            },
          ],
        },
      ],
    });

    expect(invoke).toHaveBeenCalledWith(
      "save_project_data",
      expect.objectContaining({
        project: expect.objectContaining({
          units: [
            { id: "u1", unitType: "single", pageId: "p1" },
            { id: "us", unitType: "spread", spreadId: "s1" },
          ],
          spreads: [expect.objectContaining({ elements: [expect.objectContaining({ type: "text" })] })],
        }),
      }),
    );
  });

  it("does not add calendar metadata when saving non-calendar projects", async () => {
    vi.mocked(save).mockResolvedValue("/tmp/photo.dsproj");
    vi.mocked(invoke).mockResolvedValue(undefined);

    await saveProjectAs({
      id: "photo-project",
      name: "Photo",
      projectType: "photo-page",
      createdAt: "2026-01-01T00:00:00Z",
      modifiedAt: "2026-01-01T00:00:00Z",
      settings: { width: 210, height: 297, orientation: "portrait", unit: "mm" },
      pages: [],
    });

    const savedArgs = vi.mocked(invoke).mock.calls[0]?.[1] as { project: Project } | undefined;
    expect(savedArgs?.project.projectType).toBe("photo-page");
    expect(savedArgs?.project).not.toHaveProperty("calendar");
  });

  it("returns null when the open dialog is cancelled", async () => {
    vi.mocked(open).mockResolvedValue(null);

    await expect(openProjectFromDialog()).resolves.toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});
