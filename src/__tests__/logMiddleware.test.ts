import { create } from "zustand";
import { describe, expect, it, vi } from "vitest";
import { logMiddleware } from "../stores/logMiddleware";

interface TestState {
  count: number;
  increment: () => void;
}

describe("logMiddleware", () => {
  it("does not write Zustand logs to the console in test mode by default", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const useStore = create<TestState>()(
      logMiddleware("testStore")((set) => ({
        count: 0,
        increment: () => set((state) => ({ count: state.count + 1 })),
      })),
    );

    useStore.getState().increment();
    await Promise.resolve();

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
