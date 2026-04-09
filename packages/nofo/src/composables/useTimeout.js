export function useTimeout() {
  let timeoutId = null;

  const set = (callback, delay) => {
    clear();
    if (delay <= 0) {
      callback();
      return;
    }
    timeoutId = setTimeout(callback, delay);
  };

  const clear = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const isActive = () => timeoutId !== null;

  return {
    set,
    clear,
    isActive,
  };
}
