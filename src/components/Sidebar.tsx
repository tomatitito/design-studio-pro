import { useUIStore, type Panel } from "../stores";
import { AssetLibrary } from "./AssetLibrary";

const PANELS: { id: Panel; label: string }[] = [
  { id: "layers", label: "Layers" },
  { id: "properties", label: "Props" },
  { id: "assets", label: "Assets" },
  { id: "pages", label: "Pages" },
];

export function Sidebar() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const activePanel = useUIStore((s) => s.activePanel);
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col border-l border-neutral-700 bg-neutral-800">
        <button
          onClick={toggleSidebar}
          className="px-2 py-3 text-xs text-neutral-400 hover:text-white"
          title="Open sidebar"
          data-testid="sidebar-expand"
        >
          &laquo;
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex w-64 flex-col border-l border-neutral-700 bg-neutral-800"
      data-testid="sidebar"
    >
      {/* Panel tabs */}
      <div className="flex items-center border-b border-neutral-700">
        {PANELS.map((panel) => (
          <button
            key={panel.id}
            onClick={() => setActivePanel(panel.id)}
            className={`flex-1 px-1 py-2 text-[11px] font-medium transition-colors ${
              activePanel === panel.id
                ? "border-b-2 border-blue-500 text-white"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
            data-testid={`panel-tab-${panel.id}`}
          >
            {panel.label}
          </button>
        ))}
        <button
          onClick={toggleSidebar}
          className="px-2 py-2 text-xs text-neutral-400 hover:text-white"
          title="Close sidebar"
          data-testid="sidebar-collapse"
        >
          &raquo;
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === "assets" && <AssetLibrary />}

        {activePanel === "layers" && (
          <div className="p-3 text-xs text-neutral-500">
            Layers panel
          </div>
        )}

        {activePanel === "properties" && (
          <div className="p-3 text-xs text-neutral-500">
            Properties panel
          </div>
        )}

        {activePanel === "pages" && (
          <div className="p-3 text-xs text-neutral-500">
            Pages panel
          </div>
        )}
      </div>
    </div>
  );
}
