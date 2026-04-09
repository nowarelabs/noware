import { Signal } from "signal-polyfill";

/**
 * Enhanced signal-based state for NofoElement
 * Inspired by Storm.js
 */

// Global watcher for signal effects
let needsEnqueue = true;
const watcher = new Signal.subtle.Watcher(() => {
  if (needsEnqueue) {
    needsEnqueue = false;
    queueMicrotask(processPending);
  }
});

function processPending() {
  needsEnqueue = true;
  for (const s of watcher.getPending()) {
    s.get();
  }
  watcher.watch();
}

/**
 * Creates a reactive effect
 * @param {Function} callback
 * @returns {Function} cleanup
 */
export function effect(callback) {
  let cleanup;
  const computed = new Signal.Computed(() => {
    if (typeof cleanup === "function") cleanup();
    const result = callback();
    if (typeof result === "function") cleanup = result;
  });

  watcher.watch(computed);
  computed.get();

  return () => {
    watcher.unwatch(computed);
    if (typeof cleanup === "function") cleanup();
  };
}

/**
 * Creates a signal-based store with Proxy access
 */
export function createStore(initial = {}) {
  const root = new Signal.State(initial);

  // Internal map for field-level signals to allow granular updates
  const signals = new Map();

  const getSignal = (key) => {
    if (!signals.has(key)) {
      // Create a computed signal for this key
      const s = new Signal.Computed(() => root.get()?.[key]);
      signals.set(key, s);
    }
    return signals.get(key);
  };

  const proxy = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === "__isSignalStore") return true;
        if (key === "__getSignal") return getSignal;
        return getSignal(key).get();
      },
      set: (_, key, value) => {
        const current = root.get();
        if (current[key] === value) return true;

        const next = Array.isArray(current) ? [...current] : { ...current };
        next[key] = value;
        root.set(next);
        return true;
      },
    },
  );

  return { proxy, root };
}
