# Design Studio Pro

Design Studio Pro is a Tauri desktop app for building print layouts (currently centered on photo-sheet workflows) with a React + Fabric.js frontend and a Rust backend.  
The repository also includes a CLI (`dsp`) for creating/updating `.dsproj` files and exporting PDFs.

## Current Status

This project is in active development (`0.1.0`).  
Core paths that work today:

- Canvas-based editor shell (toolbar, rulers, canvas, sidebar, status bar)
- Project model + in-memory stores on frontend
- Project save/load in `.dsproj` format (ZIP with `manifest.json` + assets)
- PDF export pipeline in Rust (`printpdf`)
- CLI support for `new`, `open`, and `export-pdf`
- Image border presets and export support (UI + CLI + PDF rendering)

## Prerequisites

- Node.js (current LTS recommended)
- `pnpm` (repo is pinned to `pnpm@10.28.0`)
- Rust toolchain (`cargo`, `rustc`)
- Tauri system dependencies for your OS (WebView/build tooling)

## Quickstart (Run The App)

```bash
pnpm install
pnpm dev
```

`pnpm dev` launches Tauri dev mode and starts the Vite dev server (`http://localhost:1420`) via `src-tauri/tauri.conf.json`.

## Common Commands

```bash
# TypeScript tests
pnpm test

# Typecheck
pnpm typecheck

# Lint
pnpm lint

# Production app build
pnpm build
```

## Cross-Platform Release Pipeline (GitHub)

This repo uses `package.json` as the single source of truth for app versioning.

Workflows:
- `.github/workflows/version-bump-release.yml`: watches version bumps in `package.json` on `main` / `master`, synchronizes `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`, creates tag `v<version>`.
- `.github/workflows/release-desktop.yml`: runs on tag pushes (`v*`) and builds/uploads Windows, macOS, and Linux release assets.
- `.github/workflows/release-cli.yml`: runs on tag pushes (`v*`) and publishes standalone `dsp` archives plus `dsp-checksums.txt` and `dsp-updates.json`.

Release flow (automatic tag + release):

```bash
# 1) Bump version in one place only (package.json)
pnpm version:bump:patch   # or :minor / :major

# 2) Commit and push to main/master
git add .
git commit -m "chore: bump version to 0.2.0"
git push
```

What CI does:
1. Syncs version into `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`.
2. Commits sync changes if needed.
3. Creates and pushes tag `v0.2.0` (if missing).
4. Builds and publishes release assets for Windows, macOS, Linux on the GitHub Release for that tag.
5. Builds and publishes standalone CLI archives and update metadata for `dsp` on the same tagged release.

You can also run local sync manually:

```bash
pnpm version:sync
```

## CLI Usage

Build the CLI binary:

```bash
cd src-tauri
cargo build --features cli
```

Run it from `src-tauri`:

```bash
./target/debug/dsp --help
./target/debug/dsp new --help
./target/debug/dsp open --help
./target/debug/dsp export-pdf --help
```

Full CLI reference and examples: [docs/cli.md](docs/cli.md)

### CLI Self-Update

Official `dsp` self-update support is limited to the user-scoped install locations used by the release workflow:

- macOS/Linux: `~/.design-studio-pro/bin/dsp`
- Windows: `%LOCALAPPDATA%\DesignStudioPro\bin\dsp.exe`

Package-manager installs are intentionally unsupported for self-update. On startup, `dsp` checks for updates for official installs, and the manual commands are `dsp update check` and `dsp self-update`.

## Logging and Observability

Zustand store mutations are logged through Rust (`target: "zustand"`).  
Useful filters:

```bash
RUST_LOG=info pnpm tauri dev
RUST_LOG=zustand=info pnpm tauri dev
RUST_LOG=info,zustand=off pnpm tauri dev
```

Details: [AGENTS.md](AGENTS.md)

## Repository Map

- `src/` frontend (React, Fabric.js canvas integration, Zustand stores)
- `src-tauri/` backend (Tauri commands, project I/O, PDF export, CLI)
- `docs/` practical project docs
- `specs/` product/architecture specification documents

## Architecture Docs

- Current implementation overview: [docs/architecture-current.md](docs/architecture-current.md)
- Product and planning specs: [specs/README.md](specs/README.md)

## First Tasks For New Contributors

1. Run `pnpm dev` and verify the desktop app starts.
2. Run `pnpm test` and `pnpm typecheck`.
3. Read [docs/architecture-current.md](docs/architecture-current.md) to understand module boundaries and data flow.
4. If working on CLI/export, read [docs/cli.md](docs/cli.md) and `src-tauri/src/bin/cli.rs`.
