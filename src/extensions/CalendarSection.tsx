import { useEffect, useState } from "react";
import {
  applyCalendarThemeToProject, CALENDAR_THEME_PRESETS, DEFAULT_CALENDAR_THEME_ID,
} from "../calendarContracts";
import { useProjectStore } from "../stores";
import { commitDocument } from "./editor";
import type { EditorAPI } from "./sdk";

export function CalendarSection({ editor }: { editor: EditorAPI }) {
  const [snapshot, setSnapshot] = useState(() => editor.getSnapshot());
  useEffect(() => editor.subscribe(() => setSnapshot(editor.getSnapshot())), [editor]);
  if (snapshot.project?.projectType !== "calendar") return null;
  const activeId = snapshot.project.calendar?.themeId ?? DEFAULT_CALENDAR_THEME_ID;
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
        Calendar Theme
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-md border border-neutral-700 bg-neutral-900/60 p-3">
        {CALENDAR_THEME_PRESETS.map((preset) => (
          <button key={preset.id} type="button"
            onClick={() => {
              // Bundled adapter retains existing calendar metadata and theme semantics.
              const project = useProjectStore.getState().currentProject;
              if (project?.projectType === "calendar") commitDocument(applyCalendarThemeToProject(project, preset.id));
            }}
            className={`rounded border p-2 text-left transition ${activeId === preset.id
              ? "border-blue-400 bg-blue-500/15"
              : "border-neutral-700 bg-neutral-800 hover:border-blue-400"}`}
            data-testid={`calendar-theme-${preset.id}`}>
            <div className="mb-2 flex overflow-hidden rounded border border-white/10">
              {preset.swatches.map((color) => (
                <span key={color} className="h-5 flex-1" style={{ backgroundColor: color }} />
              ))}
            </div>
            <span className="block text-[11px] font-medium text-white">{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
