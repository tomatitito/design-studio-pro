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
