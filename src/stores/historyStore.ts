import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export interface HistoryState<T = unknown> {
  past: T[];
  present: T | null;
  future: T[];
  push: (state: T) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useHistoryStore = create<HistoryState>()(
  immer((set, get) => ({
    past: [],
    present: null,
    future: [],

    push: (newState) =>
      set((state) => {
        if (state.present !== null) {
          state.past.push(state.present);
        }
        state.present = newState;
        state.future = [];
      }),

    undo: () =>
      set((state) => {
        if (state.past.length === 0) return;
        const previous = state.past.pop()!;
        if (state.present !== null) {
          state.future.unshift(state.present);
        }
        state.present = previous;
      }),

    redo: () =>
      set((state) => {
        if (state.future.length === 0) return;
        const next = state.future.shift()!;
        if (state.present !== null) {
          state.past.push(state.present);
        }
        state.present = next;
      }),

    clear: () =>
      set((state) => {
        state.past = [];
        state.present = null;
        state.future = [];
      }),

    canUndo: () => get().past.length > 0,

    canRedo: () => get().future.length > 0,
  })),
);
