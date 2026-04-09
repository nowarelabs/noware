import { createSignal } from "./signals.js";

export function useMediaQuery(query) {
  const matches = createSignal(false);
  let mql = null;
  let listener = null;

  const update = (event) => {
    matches.set(event.matches);
  };

  const bind = () => {
    if (typeof window === "undefined") return;
    mql = window.matchMedia(query);
    matches.set(mql.matches);
    listener = update;
    mql.addEventListener("change", listener);
  };

  const unbind = () => {
    if (mql && listener) {
      mql.removeEventListener("change", listener);
    }
  };

  return {
    matches: {
      get value() {
        return matches.get();
      },
    },
    bind,
    unbind,
    query: () => query,
  };
}

export const BREAKPOINTS = {
  xs: "(min-width: 0px)",
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
  belowXs: "(max-width: 639px)",
  belowSm: "(max-width: 767px)",
  belowMd: "(max-width: 1023px)",
  belowLg: "(max-width: 1279px)",
  belowXl: "(max-width: 1535px)",
};
