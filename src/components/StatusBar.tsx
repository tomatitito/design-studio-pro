import { useUIStore } from "../stores";

export function StatusBar() {
  const zoom = useUIStore((s) => s.zoom);
  const selectedElementIds = useUIStore((s) => s.selectedElementIds);
  const selectedTool = useUIStore((s) => s.selectedTool);

  const zoomPercent = Math.round(zoom * 100);
  const selectionCount = selectedElementIds.length;

  return (
    <div
      className="flex items-center justify-between border-t border-neutral-700 bg-neutral-800 px-3 py-1"
      data-testid="status-bar"
    >
      <div className="flex items-center gap-4">
        <span className="text-[11px] text-neutral-400">
          Tool: {selectedTool}
        </span>
        {selectionCount > 0 && (
          <span className="text-[11px] text-neutral-400">
            {selectionCount} selected
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[11px] text-neutral-400">
          Zoom: {zoomPercent}%
        </span>
      </div>
    </div>
  );
}
