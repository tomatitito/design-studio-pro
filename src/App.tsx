import {
  CanvasProvider,
  Canvas,
  Toolbar,
  Ruler,
  RulerCorner,
  Sidebar,
  StatusBar,
} from "./components";

function App() {
  return (
    <CanvasProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-900">
        {/* Top toolbar */}
        <Toolbar />

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Rulers + Canvas area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Horizontal ruler row */}
            <div className="flex">
              <RulerCorner />
              <div className="flex-1">
                <Ruler orientation="horizontal" />
              </div>
            </div>

            {/* Vertical ruler + Canvas */}
            <div className="flex flex-1 overflow-hidden">
              <Ruler orientation="vertical" />
              <div className="flex-1 overflow-hidden">
                <Canvas />
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <Sidebar />
        </div>

        {/* Bottom status bar */}
        <StatusBar />
      </div>
    </CanvasProvider>
  );
}

export default App;
