import { createSignal } from "./signals.js";

export function useMounted() {
  const mounted = createSignal(false);

  const setMounted = (value) => mounted.set(value);

  return {
    mounted: {
      get value() {
        return mounted.get();
      },
    },
    isMounted: () => mounted.get(),
    setMounted,
  };
}
