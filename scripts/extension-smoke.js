// Injected ONLY by the opt-in Rust extension-smoke feature, never a normal build.
// Native file IPC, module loading, React rendering, Editor edits and undo are real.
// The test supplies answers to native picker/trust dialogs to run unattended.
(async () => {
  const original = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
  const delay = () => new Promise((resolve) => setTimeout(resolve, 30));
  async function wait(predicate, name) {
    for (let i = 0; i < 300; i++) {
      const value = predicate();
      if (value) return value;
      await delay();
    }
    throw new Error(`Timeout: ${name}; ${document.body.textContent}`);
  }
  const button = (text) => [...document.querySelectorAll("button")].find((node) => node.textContent.includes(text));
  const background = () => document.querySelector('[data-testid="background-color-input"]')?.value;
  const status = (text) => [...document.querySelectorAll('[role="status"]')].some((node) => node.textContent.includes(text));
  try {
    (await wait(() => document.querySelector('[data-testid="panel-tab-properties"]'), "Props tab")).click();
    (await wait(() => document.querySelector("details summary"), "Extensions disclosure")).click();
    await wait(() => button("Load package folder"), "package UI");
    if (button("Smoke apply")) throw new Error("External code auto-loaded");
    const initial = background();
    button("Load package folder").click();
    await wait(() => status("Trust declined") && !button("Load package folder").disabled, "trust rejection");
    if (button("Smoke apply")) throw new Error("Rejected plugin executed");
    await original("extension_smoke_set_trust", { trust: true });
    button("Load package folder").click();
    await wait(() => button("Smoke apply"), "Blob module + shared React");
    if (background() !== initial) throw new Error("Loading recolored document");
    button("Smoke apply").click();
    await wait(() => background() === "#123456", "Editor edit reflected in Props");
    await wait(() => document.body.innerText.includes("Observed #123456"), "Editor observation");
    document.querySelector('[data-testid="undo"]').click();
    await wait(() => background() === initial, "undo");
    document.querySelector('[data-testid="redo"]').click();
    await wait(() => background() === "#123456", "redo");
    // Corrupt the temporary package, not the checked-in example.
    await original("write_text_file", {
      path: `${window.__DSP_SMOKE_PACKAGE__}/extension.js`,
      content: "throw new Error('smoke import failure'); export function activate() {}",
    });
    button("Load package folder").click();
    await wait(() => status("previous registrations retained"), "failed import diagnostics");
    if (!button("Smoke apply")) throw new Error("Failed import discarded working section");
    await original("write_text_file", {
      path: `${window.__DSP_SMOKE_PACKAGE__}/extension.js`,
      content: "export function activate(api) { api.props.registerSection({id:'bad',title:'bad',component:()=>null}); }",
    });
    button("Load package folder").click();
    await wait(() => status("Invalid or duplicate section"), "failed registration diagnostics");
    if (!button("Smoke apply")) throw new Error("Failed registration discarded working section");
    button("Disable external extensions").click();
    await wait(() => !button("Smoke apply"), "disable");
    if (background() !== "#123456") throw new Error("Disable lost document colors");
    await original("extension_smoke_result", { result: "PASS: native IPC, rejected trust, Blob ESM, host React hooks, no implicit edits, observation, edit/undo/redo, failed import/registration retention, disable" });
  } catch (error) {
    await original("extension_smoke_result", { result: `FAIL: ${String(error)}\n${error.stack ?? ""}` });
  }
})();
