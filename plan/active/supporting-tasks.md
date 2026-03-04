# Supporting Tasks

## Build & Package Scripts

Defined in `package.json`:
```json
{
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "test": "vitest run",
    "test:unit": "vitest run src/**/*.test.ts",
    "test:integration": "vitest run tests/integration/**/*.test.ts",
    "test:e2e": "pnpm exec playwright test",
    "test:coverage": "vitest run --coverage",
    "benchmark": "vitest bench",
    "typecheck": "pnpm exec tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,html}\""
  }
}
```

## API Implementation (Throughout)

### Project Management APIs

- [ ] `project_create`
- [ ] `project_open`
- [ ] `project_save`
- [ ] `project_close`
- [ ] `project_export`
- [ ] `project_list_recent`

### Canvas Operations APIs

- [ ] `canvas_add_element`
- [ ] `canvas_update_element`
- [ ] `canvas_delete_element`
- [ ] `canvas_move_element`
- [ ] `canvas_resize_element`
- [ ] `canvas_rotate_element`

### Image Processing APIs

- [ ] `image_import`
- [ ] `image_process`
- [ ] `image_adjust`
- [ ] `image_crop`
- [ ] `image_resize`
- [ ] `image_apply_filter`

### Export APIs

- [ ] `export_to_pdf`
- [ ] `export_to_images`
- [ ] `export_preflight_check`

## Infrastructure

- [ ] GitHub repository
- [ ] CI/CD pipeline with PNPM
- [ ] Configure build pipelines for macOS, Windows, Linux
- [ ] Code signing setup
- [ ] Analytics platform
- [ ] Crash reporting

## CI/CD Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v3

  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rust-lang/setup-rust-toolchain@v1
      - run: cargo test
      - run: cargo tarpaulin --xml
      - uses: codecov/codecov-action@v3

  test-e2e:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:e2e
```
