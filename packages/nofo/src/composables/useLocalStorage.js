import { createSignal } from "./signals.js";

export function useLocalStorage(key, initialValue, options = {}) {
  const { serialize = JSON.stringify, deserialize = JSON.parse } = options;

  const getStoredValue = () => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : initialValue;
    } catch {
      return initialValue;
    }
  };

  const value = createSignal(getStoredValue());

  const set = (newValue) => {
    const valueToStore = typeof newValue === "function" ? newValue(value.get()) : newValue;
    value.set(valueToStore);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, serialize(valueToStore));
      } catch (e) {
        console.warn(`Failed to save to localStorage: ${e}`);
      }
    }
  };

  const remove = () => {
    value.set(initialValue);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
  };

  return {
    value: {
      get value() {
        return value.get();
      },
    },
    set,
    remove,
  };
}
