import { useHistoryStore } from "../stores";
import { restoreDocument, type DocumentSnapshot } from "../documentHistory";
export function restoreSnapshot(snapshot: DocumentSnapshot) { restoreDocument(snapshot); }
export function attachUndoRedoShortcuts(): () => void {
  const handler = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
    if (event.target instanceof HTMLElement &&
      (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return;
    event.preventDefault();
    const history = useHistoryStore.getState();
    if (event.shiftKey ? !history.canRedo() : !history.canUndo()) return;
    if (event.shiftKey) history.redo(); else history.undo();
    const snapshot = useHistoryStore.getState().present as DocumentSnapshot | null;
    if (snapshot) restoreSnapshot(snapshot);
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}
