import { createContext, type ReactNode, use, useMemo } from "react";
import { createStore, useStore } from "zustand";
import type { Canvas as FabricCanvas } from "fabric";

export interface CanvasStore {
  canvas: FabricCanvas | null;
  setCanvas: (canvas: FabricCanvas | null) => void;
}

export type CanvasStoreApi = ReturnType<typeof createCanvasStore>;

function createCanvasStore() {
  return createStore<CanvasStore>((set) => ({
    canvas: null,
    setCanvas: (canvas) => set({ canvas }),
  }));
}

const CanvasStoreContext = createContext<CanvasStoreApi | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createCanvasStore(), []);
  return (
    <CanvasStoreContext.Provider value={store}>
      {children}
    </CanvasStoreContext.Provider>
  );
}

function useCanvasStoreContext(): CanvasStoreApi {
  const store = use(CanvasStoreContext);
  if (!store) {
    throw new Error("useCanvasStore must be used within a CanvasProvider");
  }
  return store;
}

export function useCanvasStore<T>(selector: (state: CanvasStore) => T): T {
  return useStore(useCanvasStoreContext(), selector);
}

/**
 * Get direct access to the canvas store API for imperative use
 * (e.g., reading canvas outside of React render cycle).
 */
export function useCanvasStoreApi(): CanvasStoreApi {
  return useCanvasStoreContext();
}
