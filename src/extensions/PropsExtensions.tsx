import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { editor } from "./editor";
import { extensionHost, validateManifest } from "./host";
import "./bundled";
import type { ExtensionManifest, Section } from "./sdk";

class SectionBoundary extends Component<{ children: ReactNode; id: string; revision: Section["component"] }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) { return { error: String(error) }; }
  componentDidUpdate(previous: Readonly<{ revision: Section["component"] }>) {
    if (previous.revision !== this.props.revision && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return <div role="alert">{this.props.id}: {this.state.error}</div>;
    return this.props.children;
  }
}
interface Candidate { folder: string; manifest?: ExtensionManifest; error?: string }
export function PropsExtensions() {
  const sections = useSyncExternalStore(extensionHost.subscribe, extensionHost.getSnapshot);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState("");
  const [root, setRoot] = useState("");
  const [busy, setBusy] = useState(false);
  async function discover() {
    try {
      const path = await invoke<string>("extensions_directory");
      setRoot(path);
      const folders = await invoke<string[]>("list_directory", { path });
      setCandidates(await Promise.all(folders.map(async (folder) => {
        try {
          const text = await invoke<string>("read_text_file", { path: `${folder}/manifest.json` });
          return { folder, manifest: validateManifest(JSON.parse(text)) };
        } catch (error) { return { folder, error: String(error) }; }
      })));
    } catch (error) { setMessage(String(error)); }
  }
  useEffect(() => { if ("__TAURI_INTERNALS__" in window) void discover(); }, []);
  async function load(folder: string) {
    setBusy(true);
    try {
      const manifest = validateManifest(JSON.parse(await invoke<string>("read_text_file", { path: `${folder}/manifest.json` })));
      // Read exact bytes before confirmation, so a disk change during the dialog
      // cannot substitute a different module for the one being approved.
      const source = await invoke<string>("read_text_file", { path: `${folder}/${manifest.entry}` });
      if (source.length > 5_000_000) throw new Error("Extension exceeds 5 MB");
      if (!await ask(`Trust and execute ${manifest.name} (${manifest.id} ${manifest.version}) from ${folder}?\n\nNOT SANDBOXED: this code has the application's privileges. Load only code you trust. Reload replaces its sections; arbitrary side effects cannot be rolled back.`, { title: "Trust executable extension?", kind: "warning" })) {
        setMessage("Trust declined; package not loaded");
        return;
      }
      await extensionHost.loadSource(manifest.id, source);
      setMessage(`Loaded ${manifest.id} ${manifest.version}`);
      await discover();
    } catch (error) { setMessage(`Load failed; previous registrations retained: ${String(error)}`); }
    finally { setBusy(false); }
  }
  return (
    <>
      {sections.map((section) => (
        <SectionBoundary key={section.id} id={section.id} revision={section.component}>
          <section aria-label={section.title}>
            <section.component editor={editor} />
          </section>
        </SectionBoundary>
      ))}
      <details className="rounded border border-neutral-700 p-2">
        <summary>Extensions</summary>
        <p className="my-2">Trusted executable plugins only. External code is never auto-loaded.</p>
        <p className="break-all">{root}</p>
        <button disabled={busy} onClick={() => void discover()}>Refresh packages</button>{" · "}
        <button disabled={busy} onClick={() => void (async () => {
          const folder = await open({ directory: true, multiple: false });
          if (typeof folder === "string") await load(folder);
        })().catch((error) => setMessage(String(error)))}>Load package folder…</button>{" · "}
        <button onClick={() => { extensionHost.disableExternal(); setMessage("External extensions disabled"); }}>
          Disable external extensions
        </button>
        {candidates.map((candidate) => (
          <div key={candidate.folder} className="my-2 break-all">
            {candidate.manifest?.name ?? candidate.folder}
            {candidate.error ? <p role="alert">{candidate.error}</p> : <>
              {" "}<button disabled={busy} onClick={() => void load(candidate.folder)}>Trust & load/reload</button>
              {" "}<button onClick={() => extensionHost.disable(candidate.manifest!.id)}>Disable</button>
            </>}
          </div>
        ))}
        <p role="status">{message}</p>
      </details>
    </>
  );
}
