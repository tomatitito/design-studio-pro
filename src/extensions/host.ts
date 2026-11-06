import * as React from "react";
import { editor } from "./editor";
import type { EditorAPI, ExtensionManifest, ExtensionModule, Section } from "./sdk";

export function validateManifest(value: unknown): ExtensionManifest {
  const manifest = value as ExtensionManifest;
  if (!manifest || typeof manifest !== "object" ||
    !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9.-]*$/.test(manifest.id) ||
    manifest.id.startsWith("dsp.") ||
    typeof manifest.name !== "string" || !manifest.name.trim() ||
    typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+$/.test(manifest.version) ||
    manifest.apiVersion !== 1 || manifest.entry !== "extension.js")
    throw new Error("Invalid manifest: expected namespaced id, name, x.y.z version, apiVersion 1, entry extension.js");
  return manifest;
}

interface Loaded { sections: Section[]; dispose(): void }
export class ExtensionHost {
  private loaded = new Map<string, Loaded>();
  private listeners = new Set<() => void>();
  private pending = new Set<string>();
  private generation = 0;
  private snapshot: Section[] = [];
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.snapshot;
  async loadSource(id: string, source: string) {
    const generation = this.generation;
    const module = await importSource(source);
    if (generation !== this.generation) throw new Error("Load cancelled by disable");
    await this.activate(id, module);
  }
  private publish() {
    this.snapshot = [...this.loaded.values()].flatMap((item) => item.sections)
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id));
    this.listeners.forEach((listener) => listener());
  }
  async activate(id: string, module: ExtensionModule) {
    if (this.pending.has(id)) throw new Error("Reload already in progress");
    this.pending.add(id);
    const generation = this.generation;
    const publish = () => this.publish();
    let phase: "candidate" | "active" | "disposed" = "candidate";
    const sections: Section[] = [];
    const cleanup = new Set<() => void>();
    const requireActive = () => {
      if (phase !== "active") throw new Error("Editor edits are only allowed after activation, while enabled");
    };
    const scopedEditor: EditorAPI = {
      getSnapshot: editor.getSnapshot,
      edit(request) { requireActive(); editor.edit(request); },
      subscribe(listener) {
        if (phase === "disposed") throw new Error("Extension is disabled");
        const unsubscribe = editor.subscribe(() => { if (phase === "active") listener(); });
        cleanup.add(unsubscribe);
        return () => { cleanup.delete(unsubscribe); unsubscribe(); };
      },
    };
    let disposeModule: void | (() => void);
    let registrationError: Error | undefined;
    const dispose = () => {
      phase = "disposed";
      for (const fn of cleanup) { try { fn(); } catch (error) { console.error("Extension cleanup", id, error); } }
      cleanup.clear();
      try { disposeModule?.(); } catch (error) { console.error("Extension disposal", id, error); }
    };
    try {
      if (typeof module.activate !== "function") throw new Error("Module must export activate(api)");
      const activation = Promise.resolve(module.activate({
        version: 1, React, editor: scopedEditor,
        props: {
          registerSection(section) {
            if (phase !== "candidate") throw new Error("Register sections during activate only");
            if (!section || typeof section.id !== "string" || !section.id.startsWith(`${id}/`) ||
              !/^[a-z0-9./-]+$/.test(section.id) ||
              typeof section.title !== "string" || !section.title.trim() ||
              (section.order !== undefined && !Number.isFinite(section.order)) ||
              typeof section.component !== "function" ||
              sections.some((item) => item.id === section.id))
              {
                registrationError = new Error("Invalid or duplicate section; use package.id/local-id");
                throw registrationError;
              }
            const Component = section.component;
            sections.push({
              ...section,
              component: () => React.createElement(Component, { editor: scopedEditor }),
            });
            return () => {
              const index = sections.findIndex((item) => item.id === section.id);
              if (index >= 0) sections.splice(index, 1);
              if (phase === "active") publish();
            };
          },
        },
      }));
      // A hung async activation must not leave the manager permanently busy.
      // Synchronous infinite loops cannot be interrupted in a trusted same-webview host.
      void activation.then((disposer) => {
        if (phase === "disposed" && typeof disposer === "function") disposer();
      }).catch((error) => console.error("Extension activation", id, error));
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        disposeModule = await Promise.race([
          activation,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("Activation timed out after 10 seconds")), 10000);
          }),
        ]);
      } finally { clearTimeout(timer); }
      if (registrationError) throw registrationError;
      if (disposeModule !== undefined && typeof disposeModule !== "function")
        throw new Error("activate must return a disposer or undefined");
      if (generation !== this.generation) throw new Error("Load cancelled by disable");
      const previous = this.loaded.get(id);
      phase = "active";
      this.loaded.set(id, { sections, dispose });
      previous?.dispose();
      this.publish();
    } catch (error) {
      dispose();
      throw error;
    } finally { this.pending.delete(id); }
  }
  disable(id: string) {
    this.generation++;
    this.loaded.get(id)?.dispose();
    this.loaded.delete(id);
    this.publish();
  }
  disableExternal() {
    this.generation++;
    for (const id of this.loaded.keys()) if (!id.startsWith("dsp.")) this.disable(id);
  }
}
export const extensionHost = new ExtensionHost();

/** Same mechanism in Vite and packaged Tauri: no dev-server URL or HMR. */
export async function importSource(source: string): Promise<ExtensionModule> {
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      import(/* @vite-ignore */ url) as Promise<ExtensionModule>,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Import timed out after 10 seconds")), 10000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    URL.revokeObjectURL(url);
  }
}
