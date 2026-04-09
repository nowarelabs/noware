export function useClickOutside(options = {}) {
  const { eventName = "click", excludeSelectors = [] } = options;

  const isClickedOutside = (target, element) => {
    if (!element) return true;

    for (const selector of excludeSelectors) {
      if (target.closest(selector)) {
        return false;
      }
    }

    return !element.contains(target) && element !== target;
  };

  const handler = (element, callback) => (event) => {
    if (isClickedOutside(event.target, element)) {
      callback(event);
    }
  };

  const bind = (element, callback) => {
    const fn = handler(element, callback);
    document.addEventListener(eventName, fn);
    return () => document.removeEventListener(eventName, fn);
  };

  return { bind, isClickedOutside, handler };
}
