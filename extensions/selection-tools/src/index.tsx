import type { ExtensionAPI, EditorAPI, Edit, ReadonlyDeep, Element } from "../../../src/extensions/sdk";

export function activate(api: ExtensionAPI) {
  const React = api.React;
  function Section({ editor }: { editor: EditorAPI }) {
    const [snapshot, setSnapshot] = React.useState(() => editor.getSnapshot());
    const [error, setError] = React.useState("");
    const [color, setColor] = React.useState("#2457a7");
    React.useEffect(() => editor.subscribe(() => setSnapshot(editor.getSnapshot())), [editor]);
    const page = snapshot.activePage;
    const project = snapshot.project;
    function apply() {
      if (!page || !project) return;
      const operations: Edit[] = [];
      function visit(elements: readonly ReadonlyDeep<Element>[]) {
        for (const element of elements) {
          if (element.elementType === "group") visit(element.children);
          else if (snapshot.selection.includes(element.id) &&
            (element.elementType === "text" || element.elementType === "shape")) {
            operations.push({ type: "element.color", pageId: page!.id, elementId: element.id, color });
          }
        }
      }
      visit(page.elements);
      try {
        if (!operations.length) throw new Error("Select text or shapes on a single page first.");
        editor.edit({ projectId: project.id, operations });
        setError("");
      } catch (error) { setError(String(error)); }
    }
    return (
      <div style={{ border: "1px solid #777", padding: 8 }}>
        <strong>Selection tools</strong>
        <p>{page?.name ?? "No page"} · {snapshot.selection.length} selected</p>
        <label>Selected text/shape color <input type="color" value={color}
          onChange={(event) => setColor(event.target.value)} /></label>
        <button onClick={apply} disabled={!project}>Apply to selection</button>
        <p role="status">{error}</p>
      </div>
    );
  }
  return api.props.registerSection({
    id: "example.selection-tools/colors", title: "Selection tools", order: 30, component: Section,
  });
}
