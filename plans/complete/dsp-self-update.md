# DSP Self-Update — Complete

## Current Status

Implementation is complete in the repository:

- Standalone CLI release workflow exists at `.github/workflows/release-cli.yml`.
- Updater modules exist under `src-tauri/src/updater/`.
- CLI commands `dsp update check` and `dsp self-update` are wired in `src-tauri/src/bin/cli.rs`.
- README and CLI docs describe official install locations and self-update behavior.
- Verified locally with `cd src-tauri && cargo test --features cli` (200 tests passed: 195 lib + 5 CLI).

Remaining validation is release-environment validation only: confirm artifact upload, `dsp-updates.json`, and self-update behavior on an actual tagged GitHub release across target platforms.

## Context

`dsp` is a Rust CLI binary built from `src-tauri` behind the `cli` feature flag. The repo has automated version bumping and tagged GitHub releases, standalone CLI artifacts, machine-readable update metadata, and updater logic in the CLI.

`dsp` supports self-update for official installs only. On startup, it detects whether a newer version exists, informs the user, downloads the correct release artifact, verifies it, and installs it. Package manager installs are explicitly out of scope.

## Goals

- Publish official standalone `dsp` release artifacts on every tagged release.
- Publish machine-readable update metadata that `dsp` can consume without using the GitHub API.
- Add `dsp update check` and `dsp self-update`.
- Add automatic update checks on normal CLI startup.
- If a newer version exists, print a short notice and install the update automatically for official installs.
- Ensure update failures never block normal CLI commands.

## Non-Goals

- Supporting Homebrew, apt, winget, npm, or any other package manager.
- Updating arbitrary copies of `dsp` outside the official install location.
- Adding manifest signing beyond HTTPS plus checksum verification.
- Adding desktop app updater support in this workstream.

## Official Install Contract

Self-update is supported only when `dsp` is installed in the official user-scoped location:

- macOS: `~/.design-studio-pro/bin/dsp`
- Linux: `~/.design-studio-pro/bin/dsp`
- Windows: `%LOCALAPPDATA%\\DesignStudioPro\\bin\\dsp.exe`

Rules:

- `dsp` must verify that `std::env::current_exe()` is inside the official install root before attempting self-update.
- If the binary is outside the official install root, self-update is refused with a clear error.
- The updater only replaces the binary in the official install directory.

## Release Artifacts

Each tagged release should publish the following standalone CLI artifacts:

- `dsp-x86_64-apple-darwin.tar.gz`
- `dsp-aarch64-apple-darwin.tar.gz`
- `dsp-x86_64-unknown-linux-gnu.tar.gz`
- `dsp-x86_64-pc-windows-msvc.zip`
- `dsp-checksums.txt`
- `dsp-updates.json`

Each archive contains:

- `dsp` or `dsp.exe`
- optional release notes / install note text file

## Update Manifest

The update manifest is published as `dsp-updates.json` on every tagged release and fetched from:

`https://github.com/<owner>/<repo>/releases/latest/download/dsp-updates.json`

Proposed schema:

```json
{
  "version": "0.2.0",
  "published_at": "2026-04-01T12:00:00Z",
  "notes_url": "https://github.com/<owner>/<repo>/releases/tag/v0.2.0",
  "assets": {
    "x86_64-apple-darwin": {
      "url": "https://github.com/<owner>/<repo>/releases/download/v0.2.0/dsp-x86_64-apple-darwin.tar.gz",
      "sha256": "abc123",
      "archive": "tar.gz",
      "binary_path": "dsp"
    }
  }
}
```

## CLI Surface

Add subcommands:

- `dsp update check`
- `dsp self-update`

Startup behavior:

- Run a cooldown-aware update check before normal command dispatch.
- Skip automatic checks for `--help`, `--version`, `update check`, and `self-update`.
- Print update messages to stderr so stdout remains script-friendly.

Expected UX:

- Update available:
  `A new version of dsp is available: 0.2.0 (current: 0.1.0). Downloading and installing update...`
- Update success:
  `Updated dsp to 0.2.0.`
- Update failure:
  `A new version of dsp is available, but automatic update failed: <reason>. Run 'dsp self-update' or reinstall from the official release.`

## Architecture

Add a dedicated updater module under `src-tauri/src/updater/`:

- `mod.rs`: public entry points
- `types.rs`: manifest and result types
- `manifest.rs`: fetch + parse manifest, resolve target asset
- `state.rs`: local updater state and cooldown logic
- `install.rs`: download, verify, extract, replace

Keep `src-tauri/src/bin/cli.rs` responsible only for:

- command parsing
- invoking updater entry points
- printing user-facing messages

## Dependencies

Add CLI-only dependencies as needed in `src-tauri/Cargo.toml`:

- `reqwest`
- `semver`
- `flate2`
- `tar`
- `directories` or `dirs`

Reuse existing dependencies where possible:

- `sha2`
- `serde`
- `serde_json`
- `zip`
- `tempfile`

## Runtime Flow

### Automatic startup check

1. Read current CLI version.
2. Load updater state from the user config dir.
3. If cooldown has not expired, skip network check.
4. Fetch `dsp-updates.json`.
5. Parse manifest and compare semver.
6. If newer version exists:
   - print notice to stderr
   - if official install, download and install update
   - print success or failure to stderr
7. Continue normal command execution even if the check or install fails.

### Manual update

1. Verify official install location.
2. Fetch update manifest.
3. Compare versions.
4. If already current, print `dsp is up to date.`
5. Download the correct archive for current OS/arch.
6. Verify SHA-256.
7. Extract binary.
8. Replace installed binary safely.
9. Persist updater state.
10. Print success and exit zero.

## Replacement Strategy

### macOS / Linux

- Download to temp dir.
- Verify checksum.
- Extract binary.
- Set executable bit if needed.
- Rename current binary to backup.
- Rename new binary into place.
- Remove backup on success.

### Windows

The running `.exe` cannot replace itself directly.

Implementation approach:

- Download to temp dir.
- Verify checksum.
- Extract `dsp.exe`.
- Spawn a staged updater helper flow.
- Current process exits.
- Helper waits for process termination and swaps in the new binary.

For the first implementation, a temporary PowerShell replacement helper is acceptable. If reliability becomes an issue, replace it with a small Rust helper binary later.

## Updater State

Persist updater state in the user config dir, for example:

- macOS/Linux: `~/.config/design-studio-pro/dsp-updater.json`
- Windows: `%APPDATA%\\DesignStudioPro\\dsp-updater.json`

State fields:

```json
{
  "last_checked_at": "2026-04-01T12:00:00Z",
  "last_seen_version": "0.2.0",
  "auto_update": true
}
```

Default behavior:

- update checks enabled
- auto-update enabled
- automatic checks throttled to once every 24 hours
- manual `dsp update check` ignores cooldown

## Error Handling

Updater failures must not block core commands such as `new`, `open`, or `export-pdf`.

Rules:

- Automatic checks: warn and continue.
- Automatic install failures: warn and continue.
- Manual self-update failures: print error and exit non-zero.
- Checksum mismatch: abort install.
- Unsupported install path: abort self-update with an explicit official-install-only message.
- Unsupported platform asset: abort with a clear message.

## File-Level Changes

### New files

- `plans/complete/dsp-self-update.md`
- `src-tauri/src/updater/mod.rs`
- `src-tauri/src/updater/types.rs`
- `src-tauri/src/updater/manifest.rs`
- `src-tauri/src/updater/state.rs`
- `src-tauri/src/updater/install.rs`
- `.github/workflows/release-cli.yml`

### Modified files

- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/src/bin/cli.rs`
- `README.md`
- `docs/cli.md`

## Implementation Phases

### Phase 1: Release Infrastructure

- [x] Add standalone CLI release workflow.
- [x] Build `dsp` archives for macOS Intel, macOS ARM, Linux x86_64, Windows x86_64.
- [x] Generate `dsp-checksums.txt`.
- [x] Generate `dsp-updates.json`.
- [x] Upload CLI artifacts and metadata to tagged GitHub releases.

### Phase 2: Updater Core

- [x] Add updater module skeleton under `src-tauri/src/updater/`.
- [x] Add CLI-only updater dependencies to `src-tauri/Cargo.toml`.
- [x] Implement manifest types and parsing.
- [x] Implement platform target resolution from `OS` + `ARCH`.
- [x] Implement semver comparison and update availability result types.

### Phase 3: Read-Only Update Check

- [x] Implement manifest fetch from the latest-release download URL.
- [x] Implement `dsp update check`.
- [x] Add updater state file and cooldown tracking.
- [x] Print clear stderr messages for update availability.

### Phase 4: Official Install Detection

- [x] Implement official install root resolution per platform.
- [x] Implement current binary path validation.
- [x] Refuse self-update for non-official install locations.
- [x] Document official install requirement in CLI docs.

### Phase 5: Download and Verification

- [x] Download update archive to a temp directory.
- [x] Verify SHA-256 against manifest.
- [x] Extract archive contents.
- [x] Validate the expected binary exists.
- [x] Ensure executable permissions are correct on Unix.

### Phase 6: Install Update

- [x] Implement safe binary replacement on macOS/Linux.
- [x] Implement staged replacement on Windows.
- [x] Persist updater state after successful install.
- [x] Implement `dsp self-update`.

### Phase 7: Startup Auto-Update

- [x] Hook updater check into CLI startup.
- [x] Skip automatic checks for help/version/update commands.
- [x] Print notice and auto-install when a newer version exists.
- [x] Ensure updater failures never block normal command execution.

### Phase 8: Tests

- [x] Add unit tests for manifest parsing.
- [x] Add unit tests for semver comparison.
- [x] Add unit tests for platform asset selection.
- [x] Add unit tests for official install detection.
- [x] Add unit tests for updater state cooldown logic.
- [x] Add tests for checksum verification.
- [x] Add integration tests using a mock manifest and temp install root.

### Phase 9: Documentation

- [x] Update `README.md` with official CLI install and self-update behavior.
- [x] Update `docs/cli.md` with `dsp update check` and `dsp self-update`.
- [x] Document that package managers are unsupported for self-update.

## Acceptance Criteria

- Tagged releases include standalone `dsp` archives plus `dsp-updates.json`.
- `dsp update check` reports whether a newer version exists.
- `dsp` performs an automatic startup check with cooldown behavior.
- When a newer version exists, `dsp` notifies the user and installs the update for official installs.
- Updated binary version matches the latest release after installation.
- Automatic update failures do not block normal CLI commands.
- Manual `dsp self-update` exits non-zero on failure.
- Non-official installs are detected and refused with a clear message.

## Verification

- Build and run `dsp` locally with the `cli` feature enabled.
- Validate release workflow outputs on a tagged test release.
- Test update check against a mock manifest.
- Test Unix replacement in a temp official install root.
- Test Windows staged replacement in CI or platform-specific validation.
