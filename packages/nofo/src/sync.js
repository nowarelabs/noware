/**
 * Wire utilities for NofoElement
 */

export function syncAttrToCSS(element, attrName, cssVar, transform = null) {
  const update = () => {
    const val = element.getAttribute(attrName);
    if (val !== null) element.style.setProperty(cssVar, transform ? transform(val) : val);
    else element.style.removeProperty(cssVar);
  };
  update();
  const obs = new MutationObserver((recs) => {
    for (const r of recs) {
      if (r.type === "attributes" && r.attributeName === attrName) update();
    }
  });
  obs.observe(element, { attributes: true, attributeFilter: [attrName] });
  return () => obs.disconnect();
}

export function syncToDataAttr(element, val, dataAttrName, transform = null) {
  if (val) {
    const final = transform ? transform(val) : String(val);
    if (final) element.setAttribute(dataAttrName, final);
    else element.removeAttribute(dataAttrName);
  } else {
    element.removeAttribute(dataAttrName);
  }
}

export function syncToCSSVar(element, val, cssVar, transform = null) {
  if (val) element.style.setProperty(cssVar, transform ? transform(val) : String(val));
  else element.style.removeProperty(cssVar);
}

export function syncToCustomStates(element, stateMap) {
  if (!element._internals?.states) return;
  for (const [key, val] of Object.entries(stateMap)) {
    element._internals.states.toggle(key, Boolean(val));
  }
}

export function wire(element) {
  return {
    attr: (n) => ({
      toCSS: (v, t) => syncAttrToCSS(element, n, v, t),
    }),
    data: (v) => ({
      toDataAttr: (n, t) => syncToDataAttr(element, v, n, t),
      toCSSVar: (n, t) => syncToCSSVar(element, v, n, t),
    }),
    states: (m) => syncToCustomStates(element, m),
    value: (v) => ({
      toCSSVar: (n, t) => syncToCSSVar(element, v, n, t),
      toDataAttr: (n, t) => syncToDataAttr(element, v, n, t),
    }),
  };
}
