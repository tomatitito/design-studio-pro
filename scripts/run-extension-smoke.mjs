import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

// Keep all test mutations inside the attached worktree, including the package.
const folder = await mkdtemp(path.resolve("node_modules/.extension-smoke-"));
try {
  await writeFile(path.join(folder, "manifest.json"), JSON.stringify({
    id: "test.smoke", name: "Native smoke probe", version: "1.0.0", apiVersion: 1, entry: "extension.js",
  }));
  await writeFile(path.join(folder, "extension.js"), `
    export function activate(api) {
      const React = api.React;
      function Section({editor}) {
        const [snapshot, setSnapshot] = React.useState(() => editor.getSnapshot());
        React.useEffect(() => editor.subscribe(() => setSnapshot(editor.getSnapshot())), []);
        return React.createElement("div", null,
          React.createElement("p", null, "Observed " + snapshot.activePage?.backgroundColor),
          React.createElement("button", {onClick() {
            const {project, activePage} = editor.getSnapshot();
            editor.edit({projectId: project.id, operations: [
              {type: "page.background", pageId: activePage.id, color: "#123456"}
            ]});
          }}, "Smoke apply"));
      }
      return api.props.registerSection({id:"test.smoke/probe", title:"Smoke probe", component:Section});
    }
  `);
  const binary = process.argv[2];
  if (!binary) throw new Error("Supply the built Tauri executable (extension-smoke feature)");
  let passed = false;
  const code = await new Promise((resolve, reject) => {
    const child = spawn(path.resolve(binary), [], {
      stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, DSP_SMOKE_PACKAGE: folder },
    });
    let output = "";
    child.stdout.on("data", (data) => {
      process.stdout.write(data);
      output += data;
      passed = output.includes("PASS: native IPC");
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Native smoke timed out after 45 seconds"));
    }, 45000);
    child.on("error", reject);
    child.on("exit", (code) => { clearTimeout(timer); resolve(code); });
  });
  if (code !== 0 || !passed) throw new Error(`Native smoke failed (exit ${code}, explicit PASS=${passed})`);
} finally {
  await rm(folder, { recursive: true, force: true });
}
