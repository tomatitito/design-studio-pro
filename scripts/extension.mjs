import { build } from "vite";
import { readFile, writeFile, mkdir, copyFile, rename } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [command, folderArg, destination] = process.argv.slice(2);
if (!["build", "validate", "install"].includes(command) || !folderArg) {
  throw new Error("Usage: pnpm extension:<build|validate|install> <package-folder> [extensions-directory]");
}
const folder = path.resolve(folderArg);
const manifestText = await readFile(path.join(folder, "manifest.json"), "utf8");
const manifest = JSON.parse(manifestText);
if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9.-]*$/.test(manifest.id) || manifest.id.startsWith("dsp.") ||
    typeof manifest.name !== "string" || !manifest.name.trim() ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version) || manifest.apiVersion !== 1 || manifest.entry !== "extension.js")
  throw new Error("Invalid manifest: see docs/extensions.md");
const dist = path.join(folder, "dist");
if (command === "build") {
  const check = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "-p", path.join(folder, "tsconfig.json")], { stdio: "inherit" });
  if (check.status !== 0) throw new Error("Extension typecheck failed; previous dist retained");
  // Build completely in memory before replacing the working bundle.
  const result = await build({
    configFile: false,
    esbuild: { jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment" },
    plugins: [{
      name: "host-react-only",
      resolveId(id) {
        if (/^(react|react-dom)(\/|$)/.test(id))
          throw new Error("Use api.React; do not import or bundle React");
      },
    }],
    build: {
      write: false, minify: false,
      lib: { entry: path.join(folder, "src/index.tsx"), formats: ["es"], fileName: () => "extension.js" },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
  if (outputs.length !== 1 || outputs[0].type !== "chunk" ||
    outputs[0].imports.length || outputs[0].dynamicImports.length ||
    !outputs[0].exports.includes("activate") || outputs[0].code.length > 5_000_000)
    throw new Error("Expected one self-contained module exporting activate; no external imports/assets");
  await mkdir(dist, { recursive: true });
  await writeFile(path.join(dist, "extension.js.tmp"), outputs[0].code);
  await rename(path.join(dist, "extension.js.tmp"), path.join(dist, "extension.js"));
  await writeFile(path.join(dist, "manifest.json"), manifestText);
}
const installedManifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));
if (JSON.stringify(installedManifest) !== JSON.stringify(manifest))
  throw new Error("Manifest changed; rebuild before validating/installing");
const source = await readFile(path.join(dist, "extension.js"), "utf8");
if (!source.trim() || source.length > 5_000_000) throw new Error("Invalid bundle size");
const syntax = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: source, encoding: "utf8" });
if (syntax.status !== 0) throw new Error(syntax.stderr);
if (command === "install") {
  if (!destination) throw new Error("Supply the Extensions directory displayed in Props");
  const target = path.resolve(destination, manifest.id);
  await mkdir(target, { recursive: true });
  await copyFile(path.join(dist, "extension.js"), path.join(target, "extension.js.tmp"));
  await rename(path.join(target, "extension.js.tmp"), path.join(target, "extension.js"));
  await copyFile(path.join(dist, "manifest.json"), path.join(target, "manifest.json"));
  console.log(`Installed ${target}; explicitly trust & load/reload in Props`);
}
console.log(`Validated ${manifest.id} ${manifest.version} (static checks; does not execute code)`);
