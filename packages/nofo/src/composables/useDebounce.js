import { createSignal } from "./signals.js";

export function useDebounce(initialValue, delay = 300) {
  const value = createSignal(initialValue);
  const debouncedValue = createSignal(initialValue);
  let timeoutId = null;

  const set = (newValue) => {
    value.set(newValue);
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      debouncedValue.set(newValue);
    }, delay);
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      debouncedValue.set(value.get());
    }
  };

  return {
    value: {
      get value() {
        return value.get();
      },
    },
    debounced: {
      get value() {
        return debouncedValue.get();
      },
    },
    set,
    cancel,
    flush,
  };
}
