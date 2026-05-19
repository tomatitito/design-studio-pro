import type { StateCreator, StoreMutatorIdentifier } from "zustand";

type LogFn = (entry: {
  store: string;
  timestamp: number;
  changes: Record<string, { from: unknown; to: unknown }>;
}) => void;

function diffState(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(next)) {
    if (typeof next[key] === "function") continue;
    if (!Object.is(prev[key], next[key])) {
      changes[key] = { from: prev[key], to: next[key] };
    }
  }
  return changes;
}

function isTestMode(): boolean {
  return typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";
}

function shouldLogInTestMode(): boolean {
  return import.meta.env?.VITE_ZUSTAND_TEST_LOGS === "true";
}

let logFn: LogFn = (entry) => {
  console.log("[zustand]", JSON.stringify(entry));
};

async function initTauriLog() {
  if (isTestMode()) {
    return;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    logFn = (entry) => {
      invoke("log_zustand", { entry: JSON.stringify(entry) }).catch(() => {});
    };
  } catch {
    // Not running in Tauri — keep console fallback
  }
}

const tauriLogReady = initTauriLog();

type LogMiddleware = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
) => StateCreator<T, Mps, Mcs>;

export function logMiddleware(name: string): LogMiddleware {
  return (f) => (set, get, api) =>
    f(
      ((...args: unknown[]) => {
        const prev = get();
        (set as (...a: unknown[]) => void)(...args);
        const next = get();
        const changes = diffState(
          prev as Record<string, unknown>,
          next as Record<string, unknown>,
        );
        if (Object.keys(changes).length > 0) {
          if (isTestMode() && !shouldLogInTestMode()) return;
          const entry = { store: name, timestamp: Date.now(), changes };
          tauriLogReady.then(() => logFn(entry));
        }
      }) as typeof set,
      get,
      api,
    );
}
