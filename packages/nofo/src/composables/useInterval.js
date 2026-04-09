export function useInterval() {
  let intervalId = null;

  const set = (callback, delay) => {
    clear();
    if (delay <= 0) {
      return;
    }
    intervalId = setInterval(callback, delay);
  };

  const clear = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const isActive = () => intervalId !== null;

  return {
    set,
    clear,
    isActive,
  };
}
