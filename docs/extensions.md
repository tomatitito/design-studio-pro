# Props extensions and Editor API v1

## Package and authoring

DSP loads trusted browser ES modules into the existing React webview. There is
no Node/Bun runtime in the app, server plugin, embedded terminal, or embedded
coding agent. An external coding agent builds a package using the repository's
Node-based authoring tools; end users only need the desktop app and the built
package.

Start with `extensions/selection-tools`. Copy it to another folder under
`extensions/`, rename its manifest identity and every section ID, and implement
`src/index.tsx`. The template uses type-only SDK imports; all runtime access
comes through `activate(api)`.

```json
{
  "id": "your.tools",
  "name": "Your tools",
  "version": "1.0.0",
  "apiVersion": 1,
  "entry": "extension.js"
}
```

IDs are lower-case dotted package namespaces, optionally containing hyphens.
`dsp.*` is reserved for bundled sections. API compatibility uses an exact major
`apiVersion` match, independent of the app and package version. Package versions
are numeric `x.y.z` in v1 (no ranges or prereleases). Unknown incompatible
manifests are rejected before executable code is imported.

From repository root:

```sh
pnpm install --frozen-lockfile
pnpm extension:build extensions/selection-tools
pnpm extension:validate extensions/selection-tools
```

Build runs the package's TypeScript check, then bundles in memory with Vite
before replacing `dist/extension.js`. The output must be one browser ESM chunk
exporting `activate`, without unresolved imports, code-split chunks, or assets.
Do not import React, ReactDOM, or `react/jsx-runtime`: the builder rejects those
imports to avoid duplicate React/hook instances. Take `const React = api.React`
inside `activate` and define components there. Inline styles are supported;
extension-only Tailwind class names are not scanned into an already-built host.
Bundle browser-compatible dependencies, not native/server libraries. No module
side effects, network imports, relative runtime imports, CSS files or workers
are supported entrypoint patterns in v1.

`extension:validate` checks manifest/build agreement, bundle size (5 MB maximum),
and module syntax without executing code. It is not a safety audit or proof of
correct activation. Failed typecheck/build does not replace the previous
working bundle. There is no claim of multi-file atomic installation against
concurrent builds; finish building/installing before clicking reload.

## Install, load and reload

1. Open the desktop app, **Props → Extensions**.
2. **Load package folder…** can load any built package directory (choose `dist`,
   not its source parent). This also works in a packaged app with no dev server.
3. For discoverable installation, use the directory printed in that panel:
   `pnpm extension:install extensions/selection-tools "/absolute/path/from-panel"`.
   This copies the two built files into `<directory>/example.selection-tools/`.
   It does not execute or trust them. The authoring command requires Node/pnpm;
   users can alternatively copy the two files into a child folder themselves.
4. **Refresh packages** inspects immediate child folders and displays malformed
   package diagnostics. **Trust & load/reload** rereads the manifest and module.
5. Read the identity, version and path in the native trust dialog. Choose Yes
   only for reviewed code you trust. Every reload asks again.
6. Rebuild, then reload the same package ID to replace its working sections.
   A new Blob URL avoids stale browser module-cache reuse.

Discovery uses Tauri's per-application data directory plus `extensions`; ask the
UI for the actual platform-specific path. Nothing outside that directory is
scanned automatically. Discovery reads manifests only. External code never
auto-loads, and no trust decision is persisted.

The host reads exact module bytes **before** asking for trust and imports those
bytes after approval. It does not reread executable code after confirmation.
Trust is approval of the identified package, not a cryptographic signature.
Concurrent disk changes after the read are picked up only on a later reload.

## Registration contract

The public TypeScript source of truth is `src/extensions/sdk.ts`:

```ts
export function activate(api: ExtensionAPI) {
  const React = api.React;
  function Tools({ editor }: { editor: EditorAPI }) {
    const [snapshot, setSnapshot] = React.useState(() => editor.getSnapshot());
    React.useEffect(
      () => editor.subscribe(() => setSnapshot(editor.getSnapshot())),
      [editor],
    );
    return <div>{snapshot.activePage?.name ?? "No page"}</div>;
  }
  return api.props.registerSection({
    id: "your.tools/info",
    title: "Tools",
    order: 30,
    component: Tools,
  });
}
```

Import the types as in the template. The host supplies API version 1, its React
runtime, a scoped Editor API, and `props.registerSection`. Register during
activation only. Section IDs must start with `<manifest.id>/` and be unique
within that package. Titles must be nonempty; order must be finite if provided.
Sections sort by order (default 100), then full ID. The component owns its
visible UI/heading so it may return null when inapplicable; title labels the
host section for accessibility. Use function components in v1.

`registerSection` returns an unregister function. Activation may return a
disposer (or a Promise of a disposer); combine your unregister functions,
timers and other resources there. The host also tracks Editor subscriptions and
unsubscribes them on failure, disable and successful replacement. React effect
cleanups still matter when switching panels/unmounting.

Candidate registrations are private until activation completes successfully.
Invalid/duplicate registrations poison the candidate even if the plugin catches
the registration error. Import, activation and registration failures leave the
previous working section set in place. Import and asynchronous activation each
have a 10-second deadline. Disable cancels pending candidates. The previous
module is disposed only after successful candidate activation. Disposal errors
are logged without discarding the replacement.

Editor edits are unavailable during activation and after disposal. Do not
apply edits in module scope, activation, render or mount effects: apply on
explicit user action. Component render errors are contained by per-section
error boundaries; reload a corrected module or disable it to recover. Runtime
render/event/effect errors are **not** transactional registration rollback.
Observer errors and disposal errors go to the webview console with an extension
prefix; loader/manifest/registration diagnostics appear in Props. The host does
not catch arbitrary plugin event-handler errors for the plugin.

## Editor contract

`getSnapshot()` returns detached readonly JSON-like values:

- `project`: active project or null, including its pages and spread scene data;
- `activePage`: active physical page or null (not a synthetic spread canvas);
- `selection`: selected element IDs, which may reference a spread scene.

Snapshots are fresh clones, not live objects, and not cached for React's
`useSyncExternalStore`. Subscribe with React state/effect as shown above.
`subscribe(listener)` observes document, active-page and selection changes.
It returns an unsubscribe function. Notifications are synchronous; fetch the
latest snapshot in your callback and never mutate the document from a callback.

`edit({ projectId, operations })` is synchronous and throws on invalid input.
The host resolves operations against the latest active document, validates the
whole batch on a detached copy, then commits once. `projectId` prevents an old
UI from editing a newly opened different project. It is not an optimistic
revision check: valid operations target the latest state of the named project.

| Operation | Fields | Effect |
| --- | --- | --- |
| `page.background` | `pageId`, `color` | Physical page's solid background |
| `text.content` | `pageId`, `elementId`, `content` | Text content, at most 100,000 UTF-16 code units |
| `element.color` | `pageId`, `elementId`, `color` | Text color or shape fill |

Colors must be six-digit `#rrggbb`. Batches contain 1–1000 operations. IDs must
resolve; unknown operation types and unsuitable element kinds are rejected.
Element edits support nested elements on single pages, rejecting locked
elements or locked ancestors. Spread-scene element editing, structural changes,
assets, arbitrary project patches and command registration are not public in
v1. Background edits work on either physical page of a spread. These limits
keep validation meaningful; do not import internals to bypass them.

One non-no-op batch is one document-level undo step. The host sets dirty state,
updates modification time and reuses the existing store-to-canvas renderer.
Undo/redo restores the complete document (including colors, metadata and spread
scenes), rather than snapshots of Fabric redraw events. Native text-field undo
is not intercepted by canvas keyboard shortcuts. Core edits and extension
edits share this history. Switching documents clears it. As elsewhere in DSP,
undo marks dirty conservatively, even if the result matches the last save.

There are no plugin-owned document fields or schema changes. Applied colors
and text are ordinary saved/exported fields, useful after disabling/removing
the extension.

## Bundled Calendar Theme

Calendar Theme is registered as `dsp.calendar/theme` through the same Props
registry, retaining its existing chooser, test IDs, presets and explicit
application behavior. The component observes the public Editor snapshot. Its
host-owned adapter calls the existing `applyCalendarThemeToProject` to preserve
calendar metadata and existing theme semantics, then uses the shared document
commit/history path. This privileged bundled adapter is **not** a public
calendar-specific SDK method or an example of allowed internal imports for
external plugins. The external selection-tools package demonstrates public
Editor writes without privileged adapters.

Background controls remain the existing controls; the extension system does
not introduce a second background or calendar chooser.

## Trust and recovery

This is **not a sandbox**. Same-webview JS can access the DOM, Tauri IPC and app
privileges, including filesystem commands already present in DSP. A malicious
plugin can bypass SDK conventions. The narrow API is a supported engineering
contract, not a security boundary.

Candidate rollback covers host registrations and tracked subscriptions, **not**
arbitrary module side effects, mutations outside the SDK, network calls or
untracked timers. Deadlines cannot interrupt synchronous infinite loops or undo
late module side effects. Only load trusted code. A true isolated capability
model would need a different architecture.

Use **Disable external extensions** to remove external registrations and
dispose scoped handles. Restart the app if arbitrary side effects or a hung
webview prevent recovery: every startup has external plugins disabled. Core
controls and the bundled calendar chooser remain available.

## Validation and packaged-webview smoke

```sh
pnpm typecheck
pnpm test
pnpm lint
cd src-tauri
cargo test --lib
```

On macOS with a GUI session, the following builds production frontend assets
into a Tauri `.app` (debug Rust binary, **not** Vite HMR) and exercises native
file IPC, explicit rejection/approval, Blob-module loading, host React hooks,
observation, edits, undo/redo, failure retention and disable:

```sh
pnpm tauri build --debug --features cli,extension-smoke --bundles app
node scripts/run-extension-smoke.mjs "src-tauri/target/debug/bundle/macos/Design Studio Pro.app/Contents/MacOS/design-studio-pro"
```

The `extension-smoke` feature is test-only: it supplies native picker/trust
responses, injects the UI driver and enables result reporting. It is not part
of a normal build and must never be used for distribution. The driver requires
an explicit PASS record, not merely a zero process exit. Its mutated temporary
package lives under `node_modules`, not in installed user packages. The normal
production build uses the real native dialogs:

```sh
pnpm tauri build --features cli --bundles app
```

`cli` is needed because this repository's bundler also includes the `dsp`
binary. The automated smoke does not visually inspect native dialogs, pixel-test
Fabric or test Windows/Linux webviews. For manual verification in a normal
packaged app, load the example, select text, apply a color, undo/redo, save and
reopen/export, then disable/restart and confirm document colors persist.
