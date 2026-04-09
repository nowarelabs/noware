import { Signal } from "signal-polyfill";

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

export function createSignal(initial) {
  const state = new Signal.State(initial);
  const computed = new Signal.Computed(() => state.get());
  watcher.watch(computed);
  return {
    get: () => computed.get(),
    set: (val) => {
      if (typeof val === "function") {
        const current = state.get();
        state.set(val(current));
      } else {
        state.set(val);
      }
    },
  };
}

export function createEffect(callback) {
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
