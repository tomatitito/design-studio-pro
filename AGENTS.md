# Design Studio Pro — Agent Guide

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

The log middleware skips Tauri IPC initialization when `import.meta.env.MODE === "test"` and falls back to `console.log`.
