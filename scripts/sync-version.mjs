import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageJsonPath = path.join(root, "package.json");
const tauriConfigPath = path.join(root, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(root, "src-tauri", "Cargo.toml");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function syncTauriVersion(version) {
  const tauriConfig = readJson(tauriConfigPath);
  if (tauriConfig.version === version) {
    return false;
  }
  tauriConfig.version = version;
  writeJson(tauriConfigPath, tauriConfig);
  return true;
}

function syncCargoVersion(version) {
  const source = fs.readFileSync(cargoTomlPath, "utf8");
  const lines = source.split("\n");

  let inPackageSection = false;
  let updated = false;

  const nextLines = lines.map((line) => {
    const sectionMatch = line.match(/^\s*\[(.+)\]\s*$/);
    if (sectionMatch) {
      inPackageSection = sectionMatch[1] === "package";
      return line;
    }

    if (!inPackageSection || updated) {
      return line;
    }

    if (/^\s*version\s*=\s*"[^"]+"\s*$/.test(line)) {
      updated = true;
      return `version = "${version}"`;
    }

    return line;
  });

  if (!updated) {
    throw new Error("Could not find [package] version in src-tauri/Cargo.toml");
  }

  const next = nextLines.join("\n");
  if (next === source) {
    return false;
  }

  fs.writeFileSync(cargoTomlPath, next, "utf8");
  return true;
}

function main() {
  const pkg = readJson(packageJsonPath);
  const version = pkg.version;

  if (typeof version !== "string" || !version.trim()) {
    throw new Error("package.json version is missing or invalid");
  }

  const tauriChanged = syncTauriVersion(version);
  const cargoChanged = syncCargoVersion(version);

  const changedFiles = [];
  if (tauriChanged) changedFiles.push("src-tauri/tauri.conf.json");
  if (cargoChanged) changedFiles.push("src-tauri/Cargo.toml");

  if (changedFiles.length === 0) {
    console.log(`Version ${version} already in sync.`);
    return;
  }

  console.log(`Synchronized version ${version} to:`);
  for (const file of changedFiles) {
    console.log(`- ${file}`);
  }
}

main();
