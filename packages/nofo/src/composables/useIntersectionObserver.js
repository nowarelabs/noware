export function useIntersectionObserver(options = {}) {
  const { root = null, rootMargin = "0px", threshold = 0, freezeOnceVisible = false } = options;

  const state = {
    isIntersecting: false,
    entry: null,
  };

  let observer = null;
  let frozen = false;

  const callback = (entries) => {
    const [entry] = entries;
    state.isIntersecting = entry.isIntersecting;
    state.entry = entry;

    if (freezeOnceVisible && entry.isIntersecting) {
      frozen = true;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }

    options.onChange?.(entry);
  };

  const bind = (element) => {
    if (!element || typeof IntersectionObserver === "undefined") return;
    if (frozen && freezeOnceVisible) return;

    observer = new IntersectionObserver(callback, {
      root,
      rootMargin,
      threshold,
    });

    observer.observe(element);
  };

  const unbind = () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  };

  const reset = () => {
    frozen = false;
    state.isIntersecting = false;
    state.entry = null;
  };

  return {
    state,
    bind,
    unbind,
    reset,
    isIntersecting: () => state.isIntersecting,
    getEntry: () => state.entry,
  };
}
