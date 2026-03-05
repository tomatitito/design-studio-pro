## Rules
- When committing use the following git config:
  - user.email=jens.kouros@posteo.de
  - user.name=Jens Kouros
  - user.signingkey=/Users/dusty/.ssh/id_ed25519_personal.pub
  - gpg.format=ssh
  - commit.gpgsign=true

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

See [docs/cli.md](docs/cli.md) for the full CLI reference.
