# Supporting Tasks

## Build & Package Scripts

Current scripts defined in `package.json`:

```json
{
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "version:sync": "node scripts/sync-version.mjs",
    "version:bump:patch": "npm version patch --no-git-tag-version",
    "version:bump:minor": "npm version minor --no-git-tag-version",
    "version:bump:major": "npm version major --no-git-tag-version",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,html}\""
  }
}
```

Planned but not currently defined: `test:unit`, `test:integration`, `test:e2e`, and `benchmark`.

## API Implementation (Throughout)

Current Tauri command names are documented in `docs/architecture-current.md`. This checklist tracks current command coverage plus planned gaps.

### Project Management APIs

- [x] `create_project`
- [x] `get_project_info`
- [x] `save_project`
- [x] `load_project`
- [ ] close project command
- [ ] recent projects command

### Canvas Operations APIs

- [x] `add_element`
- [x] `update_element`
- [x] `remove_element`
- [x] `get_elements`
- [ ] dedicated move/resize/rotate commands (currently handled via element updates/frontend state)

### Asset / Image APIs

- [x] `import_asset`
- [x] `list_assets`
- [x] `delete_asset`
- [x] `generate_thumbnail`
- [ ] image processing command (`image_process` / adjustments / crop / resize / filters)

### Filesystem APIs

- [x] `read_text_file`
- [x] `write_text_file`
- [x] `create_directory`
- [x] `list_directory`

### Export APIs

- [x] `export_pdf`
- [ ] export to images
- [ ] export preflight check

## Infrastructure

- [x] GitHub release automation for version bump tagging (`.github/workflows/version-bump-release.yml`)
- [x] Desktop release workflow for macOS, Windows, Linux (`.github/workflows/release-desktop.yml`)
- [x] Standalone CLI release workflow (`.github/workflows/release-cli.yml`)
- [ ] General PR/push quality-gate CI with PNPM + Rust tests
- [ ] Code signing setup
- [ ] Analytics platform
- [ ] Crash reporting

## CI/CD Configuration

Current workflows:

- `.github/workflows/version-bump-release.yml`
- `.github/workflows/release-desktop.yml`
- `.github/workflows/release-cli.yml`

Still needed: a non-release quality-gate workflow for pushes/PRs. It should run at least:

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.28.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm typecheck
      - run: pnpm lint
      - run: cargo test --manifest-path src-tauri/Cargo.toml --features cli
```
