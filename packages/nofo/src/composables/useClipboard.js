import { createSignal } from "./signals.js";

export function useClipboard(options = {}) {
  const { copiedDuration = 2000 } = options;

  const copied = createSignal(false);
  const error = createSignal(null);
  let timeoutId = null;

  const copy = async (text) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      error.set("Clipboard API not supported");
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      copied.set(true);

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        copied.set(false);
      }, copiedDuration);

      error.set(null);
      return true;
    } catch (e) {
      error.set(e.message);
      copied.set(false);
      return false;
    }
  };

  const read = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      error.set("Clipboard API not supported");
      return "";
    }

    try {
      const text = await navigator.clipboard.readText();
      error.set(null);
      return text;
    } catch (e) {
      error.set(e.message);
      return "";
    }
  };

  const clear = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    copied.set(false);
  };

  return {
    copied: {
      get value() {
        return copied.get();
      },
    },
    error: {
      get value() {
        return error.get();
      },
    },
    copy,
    read,
    clear,
  };
}
