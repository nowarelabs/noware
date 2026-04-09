import { createSignal } from "./signals.js";

export function useAsync(asyncFn, options = {}) {
  const { immediate = true, onSuccess, onError } = options;

  const state = createSignal({
    data: null,
    error: null,
    loading: false,
  });

  const execute = async (...args) => {
    state.set((s) => ({ ...s, loading: true, error: null }));

    try {
      const result = await asyncFn(...args);
      state.set({ data: result, error: null, loading: false });
      onSuccess?.(result);
      return result;
    } catch (error) {
      const errorState = { data: null, error, loading: false };
      state.set(errorState);
      onError?.(error);
      throw error;
    }
  };

  const reset = () => {
    state.set({ data: null, error: null, loading: false });
  };

  if (immediate) {
    execute();
  }

  return {
    state: {
      get data() {
        return state.get().data;
      },
      get error() {
        return state.get().error;
      },
      get loading() {
        return state.get().loading;
      },
      get isReady() {
        return !state.get().loading && !state.get().error;
      },
      get isLoading() {
        return state.get().loading;
      },
      get hasError() {
        return !!state.get().error;
      },
    },
    execute,
    reset,
  };
}
