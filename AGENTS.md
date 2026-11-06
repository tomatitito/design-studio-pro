# Design Studio Pro — Agent Guide

## Project Structure

- `src-tauri/` — Rust backend (Tauri app + CLI binary)
  - `src/core/` — Core logic (PDF export, project I/O, thumbnails)
  - `src/models/` — Domain models (Project, Page, Element, Asset)
  - `src/commands/` — Tauri IPC command handlers
  - `src/bin/cli.rs` — CLI binary entry point
- `src/` — React frontend
- `docs/` — Documentation

## Public Props extensions (API v1)

Add new Props functionality as an external TypeScript/React package, **not by
editing Sidebar, importing Zustand, or reaching into Fabric**. No agent or
terminal is embedded in DSP. The SDK contract is `src/extensions/sdk.ts`; the
complete lifecycle, limitations, and native smoke test are in
[docs/extensions.md](docs/extensions.md).

Working authoring workflow from this repository's root:

```sh
pnpm install --frozen-lockfile
pnpm extension:build extensions/selection-tools
pnpm extension:validate extensions/selection-tools
```

In the running desktop app open **Props → Extensions → Load package folder…**,
choose `extensions/selection-tools/dist`, inspect the identity/path and explicitly
approve trust. Select text or shapes on a single page and use **Apply to
selection**. Building/installing/loading alone must not edit the document.
For discovery, copy/install the build under the Extensions directory displayed
in that panel:

```sh
pnpm extension:install extensions/selection-tools "/absolute/Extensions-directory-shown-in-Props"
```

Then **Refresh packages → Trust & load/reload**. Rebuild and explicitly reload
after changes; no app rebuild or dev server is required. `extension:validate`
checks artifacts statically, not whether arbitrary executable code is safe.
The install command writes to the supplied destination; do not run it outside
an attached worktree without the user's authorization.

To author another package, copy `extensions/selection-tools` to
`extensions/<your-package>`, change the manifest `id`/`name`, and change section
IDs to match. Keep `apiVersion: 1`, `entry: "extension.js"`, `src/index.tsx`,
and the template `tsconfig.json`. Manifest versions are `x.y.z`. Export
`activate(api: ExtensionAPI)`, take React from `api.React`, and call
`api.props.registerSection({ id: "your.package/local-id", title, order, component })`.
Register during activation; return a cleanup function. Do not import/bundle
React or use automatic JSX runtime imports; the supported builder supplies
classic JSX with the host's `React`. Use inline styles for new extension styles.

Public Editor contract (`api.editor`, also passed to every section):

- `getSnapshot()` returns detached readonly project, active physical page, and
  selection IDs. Null project/page is normal. Do not mutate snapshots.
- `subscribe(listener)` observes document/page/selection changes and returns an
  unsubscribe function. Use React state + effect as in the executable example.
  Do not use `getSnapshot()` directly as a `useSyncExternalStore` snapshot:
  snapshots are detached fresh values, not referentially cached.
- `edit({ projectId, operations })` validates and atomically applies 1–1000
  operations: `page.background` (`pageId`, `color`), `text.content`
  (`pageId`, `elementId`, `content`), or `element.color` (`pageId`, `elementId`,
  `color`, for text/shape fill). Colors must be `#rrggbb`. Element edits support
  single pages only in v1, including nested groups; locked ancestors/elements
  are rejected. Spread background edits work per physical page. Unsupported or
  stale targets throw with no partial writes. Apply only on explicit user action.
- Host owns validation, document-level undo/redo, dirty tracking, and existing
  reactive canvas synchronization. One batch is one undo step; no-op batches
  add none. No raw store or live canvas is public. New edit capabilities require
  a reviewed SDK change, not internal imports by extensions.

**Security/recovery:** plugins execute trusted, unsandboxed same-webview JS with
the app's privileges. Explicit trust is required on every load/reload. External
plugins never auto-load on startup, so restarting recovers with them disabled;
there is also **Disable external extensions**. Failed import/activation/
registration keeps the last working registrations. Arbitrary module side
effects cannot be rolled back. See the detailed docs before extending the host.
The bundled Calendar Theme section retains the existing core theme adapter and
ordinary saved document colors; it does not require external packages.

## CLI

Build the CLI binary:

```bash
cd src-tauri
cargo build --features cli
```

Usage:

```bash
# Create a project
./target/debug/dsp new --name "My Design" --size a4 --add-image photo.jpg --position 10,20 --output project.dsproj

# Add images to existing project
./target/debug/dsp open project.dsproj --add-image logo.png --position 0,0

# Export project to PDF
./target/debug/dsp export-pdf project.dsproj -o output.pdf

# Ad-hoc PDF export (no project file)
./target/debug/dsp export-pdf --page-size a4 --image photo.jpg --position 10,20 -o output.pdf
```

## Observability

### Zustand State Logging

All Zustand stores (`uiStore`, `projectStore`, `historyStore`) use a custom `logMiddleware` (`src/stores/logMiddleware.ts`) that intercepts every state mutation, diffs the previous and next state, and sends a JSON log entry via Tauri IPC to the Rust backend.

The Rust command `log_zustand` (`src-tauri/src/commands/mod.rs`) logs each entry with `target: "zustand"`, which allows filtering via `RUST_LOG`.

Each log entry is a JSON line with this shape:

```json
{"store":"uiStore","timestamp":1709571234567,"changes":{"activeTool":{"from":"select","to":"rectangle"}}}
```

### Rust Backend Logging

The backend uses `log` + `env_logger`. Use `log::info!`, `log::debug!`, etc. in Rust code. The logger is initialized in `src-tauri/src/lib.rs`.

### RUST_LOG Filtering

```sh
RUST_LOG=info pnpm tauri dev              # all logs (Rust + Zustand)
RUST_LOG=zustand=info pnpm tauri dev      # only Zustand state changes
RUST_LOG=info,zustand=off pnpm tauri dev  # only Rust backend logs
```

### Test Environment

The log middleware skips Tauri IPC initialization when `import.meta.env.MODE === "test"`. Zustand logs are silenced by default in tests to keep Vitest output readable. Set `VITE_ZUSTAND_TEST_LOGS=true` to re-enable the console fallback while debugging tests.

See [docs/cli.md](docs/cli.md) for the full CLI reference.