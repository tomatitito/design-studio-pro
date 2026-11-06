import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, act } from "@testing-library/react";
import { ExtensionHost, validateManifest } from "../extensions/host";
import { editor } from "../extensions/editor";
import { useHistoryStore, useProjectStore, useUIStore } from "../stores";
import { restoreDocument, type DocumentSnapshot } from "../documentHistory";
import { createPhotoPageProject } from "../projectTemplates";
import { activate } from "../../extensions/selection-tools/src";
import type { ExtensionAPI } from "../extensions/sdk";
import type { TextElement } from "../types";

function reset() {
  const project = createPhotoPageProject();
  project.pages[0].elements = [{
    id: "text", elementType: "text", content: "Hello", color: "#000000",
    fontFamily: "Arial", fontSize: 16, position: { x: 1, y: 1 },
    size: { width: 50, height: 20 }, opacity: 1, rotation: 0, zIndex: 1,
    locked: false, visible: true,
  }];
  useProjectStore.getState().setCurrentProject(project);
  useProjectStore.getState().setDirty(false);
  useHistoryStore.getState().clear();
  useUIStore.getState().setSelectedElements(["text"]);
  return project;
}
beforeEach(reset);
describe("public Editor API", () => {
  it("returns detached data and observes page, document and selection changes", () => {
    const first = editor.getSnapshot();
    (first.selection as string[]).push("not-host");
    expect(editor.getSnapshot().selection).toEqual(["text"]);
    const listener = vi.fn();
    const dispose = editor.subscribe(listener);
    useUIStore.getState().setSelectedElements([]);
    expect(listener).toHaveBeenCalledOnce();
    dispose();
    useUIStore.getState().setSelectedElements(["text"]);
    expect(listener).toHaveBeenCalledOnce();
  });
  it("validates an entire batch before committing; rejects stale and locked edits", () => {
    const { project, activePage } = editor.getSnapshot();
    expect(() => editor.edit({ projectId: "stale", operations: [] })).toThrow();
    expect(() => editor.edit({ projectId: project!.id, operations: [
      { type: "page.background", pageId: activePage!.id, color: "#123456" },
      { type: "element.color", pageId: activePage!.id, elementId: "missing", color: "#111111" },
    ] })).toThrow("not found");
    expect(editor.getSnapshot().activePage!.backgroundColor).toBe("#ffffff");
    expect(useProjectStore.getState().isDirty).toBe(false);
    expect(useHistoryStore.getState().past).toHaveLength(0);
    expect(() => editor.edit({ projectId: project!.id, operations: [
      { type: "page.background", pageId: activePage!.id, color: "url(evil)" },
    ] })).toThrow("color");
    const locked = structuredClone(useProjectStore.getState().currentProject!);
    locked.pages[0].elements[0].locked = true;
    useProjectStore.getState().setCurrentProject(locked);
    expect(() => editor.edit({ projectId: project!.id, operations: [
      { type: "text.content", pageId: activePage!.id, elementId: "text", content: "No" },
    ] })).toThrow("locked");
  });
  it("creates one undo step including background, elements and dirty state; redo restores it", () => {
    const { project, activePage } = editor.getSnapshot();
    editor.edit({ projectId: project!.id, operations: [
      { type: "page.background", pageId: activePage!.id, color: "#123456" },
      { type: "text.content", pageId: activePage!.id, elementId: "text", content: "Changed" },
    ] });
    expect(useProjectStore.getState().isDirty).toBe(true);
    expect(useHistoryStore.getState().past).toHaveLength(1);
    useHistoryStore.getState().undo();
    restoreDocument(useHistoryStore.getState().present as DocumentSnapshot);
    expect(editor.getSnapshot().activePage!.backgroundColor).toBe("#ffffff");
    expect((editor.getSnapshot().activePage!.elements[0] as TextElement).content).toBe("Hello");
    useHistoryStore.getState().redo();
    restoreDocument(useHistoryStore.getState().present as DocumentSnapshot);
    expect(editor.getSnapshot().activePage!.backgroundColor).toBe("#123456");
    expect(useHistoryStore.getState().past).toHaveLength(1);
    // A core edit after redo shares the same history, rather than an extension-only stack.
    useProjectStore.getState().updatePage(activePage!.id, { name: "Core edit" });
    expect(useHistoryStore.getState().past).toHaveLength(2);
  });
  it("does not dirty or record no-op edits and clears history across projects", () => {
    const { project, activePage } = editor.getSnapshot();
    editor.edit({ projectId: project!.id, operations: [
      { type: "page.background", pageId: activePage!.id, color: "#ffffff" },
    ] });
    expect(useProjectStore.getState().isDirty).toBe(false);
    expect(useHistoryStore.getState().present).toBeNull();
    editor.edit({ projectId: project!.id, operations: [
      { type: "page.background", pageId: activePage!.id, color: "#123456" },
    ] });
    useProjectStore.getState().setCurrentProject({
      ...createPhotoPageProject(), id: "different-project",
    });
    expect(useHistoryStore.getState().present).toBeNull();
  });
});

describe("extension lifecycle", () => {
  it("validates manifests before execution", () => {
    const manifest = { id: "example.tools", name: "Tools", version: "1.0.0", apiVersion: 1, entry: "extension.js" };
    expect(validateManifest(manifest)).toEqual(manifest);
    for (const patch of [{ apiVersion: 2 }, { id: "dsp.reserved" }, { entry: "../evil.js" }])
      expect(() => validateManifest({ ...manifest, ...patch })).toThrow();
  });
  it("retains old registrations on errors, disposes candidates and revokes old editor handles", async () => {
    const host = new ExtensionHost();
    const cleanup = vi.fn();
    let oldAPI!: ExtensionAPI;
    await host.activate("example.tools", { activate(api) {
      oldAPI = api;
      api.props.registerSection({ id: "example.tools/a", title: "A", component: () => null });
      return cleanup;
    } });
    const working = host.getSnapshot();
    await expect(host.activate("example.tools", { activate(api) {
      api.props.registerSection({ id: "wrong/a", title: "Bad", component: () => null });
    } })).rejects.toThrow();
    expect(host.getSnapshot()).toBe(working);
    expect(cleanup).not.toHaveBeenCalled();
    await expect(host.activate("example.tools", { activate(api) {
      api.editor.edit({ projectId: editor.getSnapshot().project!.id, operations: [] });
    } })).rejects.toThrow("after activation");
    await host.activate("example.tools", { activate(api) {
      api.props.registerSection({ id: "example.tools/b", title: "B", component: () => null });
    } });
    expect(cleanup).toHaveBeenCalledOnce();
    expect(() => oldAPI.editor.edit({ projectId: "", operations: [] })).toThrow("enabled");
    host.disableExternal();
    expect(host.getSnapshot()).toEqual([]);
  });
  it("cancels pending registrations on disable", async () => {
    const host = new ExtensionHost();
    let finish!: () => void;
    const ready = new Promise<void>((resolve) => { finish = resolve; });
    const load = host.activate("example.tools", { async activate(api) {
      api.props.registerSection({ id: "example.tools/a", title: "A", component: () => null });
      await ready;
    } });
    host.disableExternal();
    finish();
    await expect(load).rejects.toThrow("cancelled");
    expect(host.getSnapshot()).toEqual([]);
  });
  it("rejects caught validation failures and cleans up candidate subscriptions", async () => {
    const host = new ExtensionHost();
    const listener = vi.fn();
    await expect(host.activate("example.tools", { activate(api) {
      api.editor.subscribe(listener);
      try {
        api.props.registerSection({ id: "bad/id", title: "Bad", component: () => null });
      } catch { /* A caught registration error still invalidates the candidate. */ }
    } })).rejects.toThrow("Invalid");
    useUIStore.getState().setSelectedElements([]);
    expect(listener).not.toHaveBeenCalled();
    expect(host.getSnapshot()).toEqual([]);
  });
  it("runs the executable example with host React and validated edits", async () => {
    const host = new ExtensionHost();
    const before = editor.getSnapshot();
    await host.activate("example.selection-tools", { activate });
    expect(editor.getSnapshot()).toEqual(before);
    const Section = host.getSnapshot()[0].component;
    const view = render(<Section editor={editor} />);
    fireEvent.click(screen.getByText("Apply to selection"));
    expect((editor.getSnapshot().activePage!.elements[0] as TextElement).color).toBe("#2457a7");
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    act(() => useUIStore.getState().setSelectedElements([]));
    expect(screen.getByText(/0 selected/)).toBeInTheDocument();
    view.unmount();
    host.disableExternal();
  });
});
