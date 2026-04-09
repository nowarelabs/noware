import { createSignal } from "./signals.js";

export function useToggle(initial = false) {
  const state = createSignal(initial);

  const toggle = () => state.set((s) => !s);
  const setTrue = () => state.set(true);
  const setFalse = () => state.set(false);
  const set = (value) => state.set(value);

  return {
    state: {
      get value() {
        return state.get();
      },
    },
    toggle,
    setTrue,
    setFalse,
    set,
    isTrue: () => state.get() === true,
    isFalse: () => state.get() === false,
  };
}
