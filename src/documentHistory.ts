import { useHistoryStore, useProjectStore } from "./stores";
import type { Project } from "./types";

export interface DocumentSnapshot { project: Project }
let restoring = false;

// Observe the document, not Fabric redraw events. One store mutation is one edit.
useProjectStore.subscribe((next, previous) => {
  if (restoring || next.currentProject === previous.currentProject) return;
  const history = useHistoryStore.getState();
  if (!next.currentProject || next.currentProject.id !== previous.currentProject?.id) {
    history.clear();
    return;
  }
  if (history.present === null && previous.currentProject) {
    history.push({ project: previous.currentProject });
  }
  history.push({ project: next.currentProject });
});

export function restoreDocument(snapshot: DocumentSnapshot) {
  restoring = true;
  try {
    useProjectStore.getState().setCurrentProject(snapshot.project);
    useProjectStore.getState().setDirty(true);
  } finally {
    restoring = false;
  }
}
