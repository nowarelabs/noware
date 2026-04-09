import { createSignal } from "./signals.js";

export function useThrottle(initialValue, delay = 300) {
  const value = createSignal(initialValue);
  const throttledValue = createSignal(initialValue);
  let lastRun = 0;

  const set = (newValue) => {
    value.set(newValue);
    const now = Date.now();
    if (now - lastRun >= delay) {
      lastRun = now;
      throttledValue.set(newValue);
    } else {
      setTimeout(
        () => {
          lastRun = Date.now();
          throttledValue.set(value.get());
        },
        delay - (now - lastRun),
      );
    }
  };

  const cancel = () => {
    lastRun = 0;
  };

  return {
    value: {
      get value() {
        return value.get();
      },
    },
    throttled: {
      get value() {
        return throttledValue.get();
      },
    },
    set,
    cancel,
  };
}
