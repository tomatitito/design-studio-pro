# Updates and Release Channels

Design Studio Pro has separate desktop and CLI update channels.

## Desktop app

`File > Check for Updates...` uses desktop-only metadata:

- Manifest: `dsp-desktop-updates.json`
- Build-time endpoint: `DSP_DESKTOP_UPDATE_BASE_URL` or `DSP_DESKTOP_UPDATE_MANIFEST_URL`
- Fallback endpoint: Cargo `package.repository` latest-release download URL
- Channel value: `desktop`
- Asset targets: `desktop-windows-x86_64`, `desktop-macos-x86_64`, `desktop-macos-aarch64`, `desktop-linux-x86_64`
- Artifact kind: `desktop-installer`

The desktop app never uses `dsp-updates.json` and never installs standalone CLI archives. Current desktop behavior is a safe update check: it validates desktop metadata enough to choose the right installer, reports latest version and installer name, and opens the release page on user confirmation. It does not download, verify, or install updates automatically.

Trust boundary: current desktop update metadata is sufficient only for check-only UX. Manifest signing and signature verification are required before any future desktop auto-download or auto-install flow is enabled.

Packaged desktop builds embed:

```sh
DSP_DESKTOP_UPDATE_BASE_URL=https://github.com/<owner>/<repo>/releases/latest/download
```

`release-desktop.yml` keeps matrix-built release assets in a draft release, generates and validates `dsp-desktop-updates.json` only after every platform job finishes, uploads the manifest to the draft, validates required assets, then publishes the release. Draft releases prevent partial platform assets or missing manifests from becoming `latest`.

## CLI

Standalone `dsp` uses CLI-only metadata:

- Manifest: `dsp-updates.json`
- Build-time endpoint: `DSP_UPDATE_BASE_URL` or `DSP_UPDATE_MANIFEST_URL`
- Assets: `dsp-*.tar.gz` / `dsp-*.zip`
- Installer behavior: official install-root self-replacement only

CLI self-update remains independent from desktop update checks.
