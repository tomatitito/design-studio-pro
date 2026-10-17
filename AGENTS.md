# Design Studio Pro — Agent Guide

## Project Structure

- `src-tauri/` — Rust backend (Tauri app + CLI binary)
  - `src/core/` — Core logic (PDF export, project I/O, thumbnails)
  - `src/models/` — Domain models (Project, Page, Element, Asset)
  - `src/commands/` — Tauri IPC command handlers
  - `src/bin/cli.rs` — CLI binary entry point
- `src/` — React frontend
- `docs/` — Documentation

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