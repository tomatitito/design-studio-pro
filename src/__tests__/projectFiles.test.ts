import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openProjectFromDialog } from "../projectFiles";

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
            elements: [
              {
                id: "text-1",
                type: "text",
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
    expect(project?.pages[0].elements[0]).toMatchObject({
      id: "text-1",
      elementType: "text",
      content: "Hello",
    });
  });

  it("returns null when the open dialog is cancelled", async () => {
    vi.mocked(open).mockResolvedValue(null);

    await expect(openProjectFromDialog()).resolves.toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });
});
