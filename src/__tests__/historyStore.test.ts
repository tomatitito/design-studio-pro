import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore } from "../stores/historyStore";

describe("historyStore", () => {
  beforeEach(() => {
    useHistoryStore.setState({
      past: [],
      present: null,
      future: [],
    });
  });

  describe("push", () => {
    it("sets the present state on first push", () => {
      useHistoryStore.getState().push("state-1");
      expect(useHistoryStore.getState().present).toBe("state-1");
    });

    it("moves the previous present to past on subsequent pushes", () => {
      useHistoryStore.getState().push("state-1");
      useHistoryStore.getState().push("state-2");
      expect(useHistoryStore.getState().present).toBe("state-2");
      expect(useHistoryStore.getState().past).toEqual(["state-1"]);
    });

    it("clears the future on push", () => {
      useHistoryStore.getState().push("state-1");
      useHistoryStore.getState().push("state-2");
      useHistoryStore.getState().undo();
      useHistoryStore.getState().push("state-3");
      expect(useHistoryStore.getState().future).toEqual([]);
    });
  });

  describe("undo", () => {
    it("moves present to future and restores from past", () => {
      useHistoryStore.getState().push("state-1");
      useHistoryStore.getState().push("state-2");
      useHistoryStore.getState().push("state-3");
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().present).toBe("state-2");
      expect(useHistoryStore.getState().future).toEqual(["state-3"]);
      expect(useHistoryStore.getState().past).toEqual(["state-1"]);
    });

    it("does nothing when past is empty", () => {
      useHistoryStore.getState().push("state-1");
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().present).toBe("state-1");
    });
  });

  describe("redo", () => {
    it("moves present to past and restores from future", () => {
      useHistoryStore.getState().push("state-1");
      useHistoryStore.getState().push("state-2");
      useHistoryStore.getState().undo();
      useHistoryStore.getState().redo();
      expect(useHistoryStore.getState().present).toBe("state-2");
      expect(useHistoryStore.getState().past).toEqual(["state-1"]);
      expect(useHistoryStore.getState().future).toEqual([]);
    });

    it("does nothing when future is empty", () => {
      useHistoryStore.getState().push("state-1");
      useHistoryStore.getState().redo();
      expect(useHistoryStore.getState().present).toBe("state-1");
    });
  });

  describe("clear", () => {
    it("resets all state", () => {
      useHistoryStore.getState().push("state-1");
      useHistoryStore.getState().push("state-2");
      useHistoryStore.getState().push("state-3");
      useHistoryStore.getState().undo();
      useHistoryStore.getState().clear();
      expect(useHistoryStore.getState().past).toEqual([]);
      expect(useHistoryStore.getState().present).toBeNull();
      expect(useHistoryStore.getState().future).toEqual([]);
    });
  });

  describe("canUndo", () => {
    it("returns false when past is empty", () => {
      expect(useHistoryStore.getState().canUndo()).toBe(false);
    });

    it("returns true when past has entries", () => {
      useHistoryStore.getState().push("state-1");
      useHistoryStore.getState().push("state-2");
      expect(useHistoryStore.getState().canUndo()).toBe(true);
    });
  });

  describe("canRedo", () => {
    it("returns false when future is empty", () => {
      expect(useHistoryStore.getState().canRedo()).toBe(false);
    });

    it("returns true when future has entries", () => {
      useHistoryStore.getState().push("state-1");
      useHistoryStore.getState().push("state-2");
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().canRedo()).toBe(true);
    });
  });

  describe("multiple undo/redo", () => {
    it("supports multiple undo and redo operations", () => {
      useHistoryStore.getState().push("A");
      useHistoryStore.getState().push("B");
      useHistoryStore.getState().push("C");
      useHistoryStore.getState().push("D");

      useHistoryStore.getState().undo(); // D -> future, present = C
      useHistoryStore.getState().undo(); // C -> future, present = B
      expect(useHistoryStore.getState().present).toBe("B");
      expect(useHistoryStore.getState().past).toEqual(["A"]);
      expect(useHistoryStore.getState().future).toEqual(["C", "D"]);

      useHistoryStore.getState().redo(); // C <- future, present = C
      expect(useHistoryStore.getState().present).toBe("C");
      expect(useHistoryStore.getState().past).toEqual(["A", "B"]);
      expect(useHistoryStore.getState().future).toEqual(["D"]);
    });
  });
});
