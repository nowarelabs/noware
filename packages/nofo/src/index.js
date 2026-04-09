import { createNofoRpc } from "./rpc.js";
import { createStore, effect } from "./signals.js";
import { wire } from "./sync.js";

export { createNofoRpc } from "./rpc.js";
export { createStore, effect } from "./signals.js";
export { wire } from "./sync.js";

// ============================================================================
// NOFO CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  rpc: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    persist: true, // sessionStorage persistence
    timeout: 30000, // 30 seconds
    retries: 0, // no automatic retries
    retryDelay: 1000, // 1 second between retries
  },
  url: {
    sync: "replace", // 'replace' | 'push' | 'none'
    debounce: 0, // ms to debounce URL updates
  },
  loading: {
    minDisplay: 0, // minimum ms loading state is shown
    indicator: true, // auto-track loading state
  },
  error: {
    autoDisplay: true, // auto-track error state
    maxMessageLength: 200, // truncate long error messages
  },
  render: {
    debounce: 0, // ms to debounce re-renders
  },
};

const NOFO_CONFIG = { ...DEFAULT_CONFIG };

export const Nofo = {
  get config() {
    return NOFO_CONFIG;
  },

  configure(overrides) {
    const merge = (target, source) => {
      for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          target[key] = target[key] || {};
          merge(target[key], value);
        } else {
          target[key] = value;
        }
      }
    };
    merge(NOFO_CONFIG, overrides);
    return Nofo;
  },

  reset() {
    Object.keys(NOFO_CONFIG).forEach((key) => {
      NOFO_CONFIG[key] = { ...DEFAULT_CONFIG[key] };
    });
    return Nofo;
  },

  getRpcOptions(overrides = {}) {
    const { rpc } = NOFO_CONFIG;
    return { ...rpc, ...overrides };
  },

  getUrlOptions(overrides = {}) {
    const { url } = NOFO_CONFIG;
    return { ...url, ...overrides };
  },
};

export {
  useToggle,
  useClickOutside,
  useDebounce,
  useThrottle,
  useMediaQuery,
  BREAKPOINTS,
  useIntersectionObserver,
  useLocalStorage,
  useAsync,
  useClipboard,
  useMounted,
  useTimeout,
  useInterval,
  createSignal,
  createEffect,
} from "./composables/index.js";

export const setTheme = (themeVars = {}) => {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(themeVars)) {
    const varName = key.startsWith("--") ? key : `--${key}`;
    root.style.setProperty(varName, value);
  }
};

export const setNofoTheme = (themeName) => {
  const themes = {
    light: {
      "--nofo-background": "#ffffff",
      "--nofo-foreground": "#000000",
      "--nofo-border": "#e5e7eb",
      "--nofo-accent": "#3b82f6",
    },
    dark: {
      "--nofo-background": "#000000",
      "--nofo-foreground": "#ffffff",
      "--nofo-border": "#374151",
      "--nofo-accent": "#60a5fa",
    },
    nofo: {
      "--nofo-background": "#0a0a0a",
      "--nofo-foreground": "#00ff41",
      "--nofo-border": "#00ff4133",
      "--nofo-accent": "#00ff41",
    },
    neon: {
      "--nofo-background": "#0d0d0d",
      "--nofo-foreground": "#ff00ff",
      "--nofo-border": "#ff00ff66",
      "--nofo-accent": "#ff00ff",
    },
  };

  const theme = themes[themeName] || themes.dark;
  setTheme(theme);
  document.body?.setAttribute("data-theme", themeName);
};

export const getTheme = () => {
  const vars = {};
  const style = getComputedStyle(document.documentElement);
  const prefixes = ["--nofo-", "--nofo-ui-"];
  prefixes.forEach((prefix) => {
    ["background", "foreground", "border", "accent", "radius", "spacing"].forEach((name) => {
      const val = style.getPropertyValue(`${prefix}${name}`).trim();
      if (val) vars[`${prefix}${name}`] = val;
    });
  });
  return vars;
};

export class NofoElement extends HTMLElement {
  #stateStore;
  #loadingStore;
  #errorStore;
  #renderQueued = false;
  #blueprints = new Map();
  #contextStore = new Map();
  #rpc = null;
  #internals;
  #cleanups = new Set();
  #testMode = false;
  #refs = {};
  #cachedTemplate = null;
  #cachedTemplateString = "";

  static props = {};
  static refs = [];
  static computed = {};
  static debug = false;
  static tracks = null; // null = track all, array = track specific paths

  static get observedAttributes() {
    return Object.keys(this.props || {});
  }

  static rpc = {
    baseUrl: "",
    endpoints: [],
    options: {},
  };

  static testMode = false;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.#internals = this.attachInternals();
    this.#stateStore = createStore({});
    this.state = this.#stateStore.proxy;
    this.#loadingStore = createStore({});
    this.loading = this.#loadingStore.proxy;
    this.#errorStore = createStore({});
    this.error = this.#errorStore.proxy;

    const props = this.constructor.props || {};
    for (const [key, defaultValue] of Object.entries(props)) {
      Object.defineProperty(this, key, {
        get: () => {
          const attrVal = this.attr(key);
          if (typeof defaultValue === "boolean") return this.has(key);
          if (Array.isArray(defaultValue) || typeof defaultValue === "object") {
            try {
              return attrVal ? JSON.parse(attrVal) : defaultValue;
            } catch {
              return defaultValue;
            }
          }
          return attrVal !== null ? attrVal : defaultValue;
        },
        set: (val) => {
          this.attr(key, typeof val === "object" ? JSON.stringify(val) : val);
          if (key === "variant") this.dataset.variant = val;
        },
      });
    }

    this.#initRefs();
    this.#initComputed();
    this.#initRpc();
    this.#initUrlState();
  }

  #initRefs() {
    const refs = this.constructor.refs || [];
    for (const refName of refs) {
      this.#refs[refName] = null;
    }
  }

  #initComputed() {
    const computed = this.constructor.computed || {};
    for (const [key, computeFn] of Object.entries(computed)) {
      Object.defineProperty(this, key, {
        get: () => computeFn.call(this),
        enumerable: true,
        configurable: true,
      });
    }
  }

  #initUrlState() {
    const props = this.constructor.props || {};
    const urlParams = new URLSearchParams(window.location.search);
    const updates = {};

    for (const [key, def] of Object.entries(props)) {
      if (def && typeof def === "object" && def.url) {
        const raw = urlParams.get(key);
        if (raw !== null) {
          updates[key] = def.parse ? def.parse(raw) : raw;
        } else {
          updates[key] = def.default;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      Object.assign(this.state, updates);
    }
  }

  #pushUrlState() {
    const urlConfig = Nofo.getUrlOptions();
    if (urlConfig.sync === "none") return;

    const props = this.constructor.props || {};
    const params = new URLSearchParams(window.location.search);

    for (const [key, def] of Object.entries(props)) {
      if (def && typeof def === "object" && def.url) {
        const value = this.state[key];
        const defaultValue = def.default;
        if (value !== undefined && value !== defaultValue) {
          params.set(key, String(value));
        } else {
          params.delete(key);
        }
      }
    }

    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    if (window.location.search !== query) {
      if (urlConfig.sync === "push") {
        history.pushState(null, "", newUrl);
      } else {
        history.replaceState(null, "", newUrl);
      }
    }
  }

  #bindUrlState() {
    window.addEventListener("popstate", () => {
      const props = this.constructor.props || {};
      const urlParams = new URLSearchParams(window.location.search);
      const updates = {};

      for (const [key, def] of Object.entries(props)) {
        if (def && typeof def === "object" && def.url) {
          const raw = urlParams.get(key);
          if (raw !== null) {
            updates[key] = def.parse ? def.parse(raw) : raw;
          } else {
            updates[key] = def.default;
          }
        }
      }

      Object.assign(this.state, updates);
    });
  }

  get refs() {
    return this.#refs;
  }

  setRef(name, element) {
    if (name in this.#refs || this.constructor.refs?.includes(name)) {
      this.#refs[name] = element;
    }
    return this;
  }

  #initRpc() {
    const { baseUrl, endpoints, options } = this.constructor.rpc || {};
    if (endpoints?.length) {
      const globalOptions = Nofo.getRpcOptions(options);
      this.#rpc = createNofoRpc(baseUrl || "", globalOptions);
      this.#rpc.configure(endpoints);
    }
  }

  get rpc() {
    return this.#rpc?.api || null;
  }

  get rpcClient() {
    return this.#rpc?.getClient() || null;
  }

  get _internals() {
    return this.#internals;
  }

  get $testId() {
    return this.getAttribute("data-testid") || this.tagName.toLowerCase().replace(/-/g, "_");
  }

  get $state() {
    if (!this.#isTestMode()) return null;
    return this.state;
  }

  get $methods() {
    if (!this.#isTestMode()) return null;
    const methods = {};
    const proto = Object.getPrototypeOf(this);
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key !== "constructor" && typeof this[key] === "function" && !key.startsWith("_")) {
        methods[key] = this[key].bind(this);
      }
    }
    return methods;
  }

  get $props() {
    if (!this.#isTestMode()) return null;
    const props = {};
    for (const key of Object.keys(this.constructor.props || {})) {
      props[key] = this[key];
    }
    return props;
  }

  #isTestMode() {
    return this.constructor.testMode || this.#testMode || this.hasAttribute("test-mode");
  }

  enableTestMode(enabled = true) {
    this.#testMode = enabled;
    if (enabled) {
      this.setAttribute("data-testid", this.$testId);
      this.dispatchEvent(
        new CustomEvent(`${this.tagName.toLowerCase()}:testModeEnabled`, {
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  emit(eventName, detail = {}) {
    const fullEventName = `${this.tagName.toLowerCase()}:${eventName}`;
    this.dispatchEvent(new CustomEvent(fullEventName, { detail, bubbles: true, composed: true }));
    return fullEventName;
  }

  async waitFor(conditionFn, timeout = 1000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (conditionFn()) return true;
      await new Promise((r) => setTimeout(r, 10));
    }
    return false;
  }

  async fetch(endpoint, method, dataOrId, data) {
    if (!this.#rpc) return { data: null, error: "RPC not configured" };
    try {
      if (!this.#rpc.api[endpoint]) throw new Error(`Endpoint ${endpoint} not found`);
      const api = this.#rpc.api[endpoint];
      return await (method === "update" ? api.update(dataOrId, data) : api[method](dataOrId));
    } catch (err) {
      return { data: null, error: err.message || err };
    }
  }

  commit(key, mutationFn) {
    this.state[key] = mutationFn(this.state[key]);
  }

  /**
   * Declarative data / state wiring utility
   */
  sync() {
    return wire(this);
  }

  /**
   * Reactive side effect
   */
  effect(callback) {
    const cleanup = effect(callback);
    this.#cleanups.add(cleanup);
    return cleanup;
  }

  registerActions(actionMap, allowedTags = []) {
    const bound = {};
    for (const [name, fn] of Object.entries(actionMap)) bound[name] = fn.bind(this);
    this.provide("actions", bound, allowedTags);
  }

  provide(key, value, allowedTags = []) {
    this.#contextStore.set(key, { value, allowedTags });
    this.addEventListener("nofo-context-request", (e) => {
      const ctx = this.#contextStore.get(e.detail.key);
      if (ctx && (ctx.allowedTags.length === 0 || ctx.allowedTags.includes(e.detail.tag))) {
        e.stopPropagation();
        e.detail.callback(ctx.value);
      }
    });
  }

  inject(key) {
    let res = null;
    this.dispatchEvent(
      new CustomEvent("nofo-context-request", {
        detail: { key, tag: this.tagName.toLowerCase(), callback: (v) => (res = v) },
        bubbles: true,
        composed: true,
      }),
    );
    return res;
  }

  #bindEvents() {
    this.shadowRoot.querySelectorAll("*").forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (attr.name.startsWith("on-")) {
          const event = attr.name.slice(3);
          const handler = attr.value;
          el.addEventListener(event, (e) => {
            const actionSource = this.inject("actions") || {};
            const fn = this[handler] || actionSource[handler];
            if (typeof fn === "function") fn.call(this, e);
          });
          el.removeAttribute(attr.name);
        }

        if (attr.name === "ref" && this.constructor.refs?.includes(attr.value)) {
          this.#refs[attr.value] = el;
          el.removeAttribute("ref");
        }
      });
    });
  }

  #registerBlueprints() {
    this.querySelectorAll("template[slot]").forEach((t) => {
      const slot = t.slot;
      const name = slot.startsWith("blueprint-") ? slot.slice(10) : slot;
      this.#blueprints.set(name, t);
    });
  }

  #getNestedValue(obj, path) {
    return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : ""), obj);
  }

  #interpolate(html, data) {
    if (!data) return html;
    let result = html;

    // 1. Value replacement: {{key}} or {{nested.key}}
    result = result.replace(
      /\{\{(\w+(?:\.\w+)*)\}\}/g,
      (_, k) => this.#getNestedValue(data, k) ?? "",
    );

    // 2. Conditional text: {{key ? truthy : falsy}}
    result = result.replace(
      /\{\{\s*(\w+(?:\.\w+)*)\s*\?\s*([^:}]+)\s*:\s*([^}]+)\s*\}\}/g,
      (_, k, truthy, falsy) => {
        const value = this.#getNestedValue(data, k);
        return value ? truthy.trim() : falsy.trim();
      },
    );

    // 3. nofo-selected="key" — match option value against data key
    result = result.replace(/nofo-selected="(\w+(?:\.\w+)*)"/g, (_, k) => {
      const actual = this.#getNestedValue(data, k);
      return `nofo-selected-match="${actual}"`;
    });

    // 4. nofo-class:name="key" — add class if truthy
    result = result.replace(/nofo-class:(\S+)="(\w+(?:\.\w+)*)"/g, (_, cls, k) => {
      const value = this.#getNestedValue(data, k);
      return value ? cls : "";
    });

    // 5. nofo-disabled, nofo-checked, nofo-hidden, nofo-readonly, nofo-required — boolean attrs
    result = result.replace(
      /nofo-(disabled|checked|hidden|readonly|required)="(\w+(?:\.\w+)*)"/g,
      (_, attr, k) => {
        const value = this.#getNestedValue(data, k);
        return value ? attr : "";
      },
    );

    // 6. nofo-attr:name="key" — conditional attribute
    result = result.replace(/nofo-attr:(\S+)="(\w+(?:\.\w+)*)"/g, (_, attr, k) => {
      const value = this.#getNestedValue(data, k);
      return value ? `${attr}="${value}"` : "";
    });

    // 7. nofo-if="key" — conditional element (wrap in marker, resolve after DOM parse)
    result = result.replace(
      /<(\w[\w-]*)([^>]*)\snofo-if="(\w+(?:\.\w+)*)"([^>]*)>/g,
      (match, tag, before, k, after) => {
        const value = this.#getNestedValue(data, k);
        if (!value) return `<!--nofo-if-false--><${tag}${before}${after}>`;
        return `<${tag}${before}${after}>`;
      },
    );

    // 8. nofo-else="id" — else block (standalone element shown when sibling nofo-if is false)
    result = result.replace(/nofo-else="([^"]*)"/g, (_, id) => {
      return `nofo-else-target="${id}"`;
    });

    // 9. nofo-each="key" on <template> — loop placeholder (handled by renderList)

    // 10. Clean up nofo-selected-match
    result = result.replace(
      /<option([^>]*)nofo-selected-match="([^"]*)"([^>]*)>/g,
      (_, before, match, after) => {
        const valMatch = before.match(/value="([^"]*)"/) || after.match(/value="([^"]*)"/);
        if (valMatch && valMatch[1] === match) {
          return `<option${before}selected${after}>`;
        }
        return `<option${before}${after}>`;
      },
    );

    return result;
  }

  #cloneBlueprint(name) {
    const t = this.#blueprints.get(name);
    if (!t) return null;
    const cloned = t.content.cloneNode(true);
    const div = document.createElement("div");
    div.appendChild(cloned);
    return div;
  }

  hasBlueprint(name) {
    return this.#blueprints.has(name);
  }

  getBlueprint(name) {
    return this.#blueprints.get(name) || null;
  }

  blueprintNames() {
    return Array.from(this.#blueprints.keys());
  }

  list(data, callback) {
    if (!Array.isArray(data)) return "";
    return data.map((item, index) => callback(item, index)).join("");
  }

  renderList(data, slot, options = {}) {
    if (!Array.isArray(data) || data.length === 0) {
      if (options.empty) {
        return typeof options.empty === "function" ? options.empty() : options.empty;
      }
      return "";
    }

    const { branch } = options;
    return data
      .map((item, index) => {
        if (branch) {
          for (const { test, slot: branchSlot } of branch) {
            if (test(item, index)) {
              return this.renderItem(item, branchSlot);
            }
          }
        }
        return this.renderItem(item, slot);
      })
      .join("");
  }

  renderItem(item, slot) {
    const div = this.#cloneBlueprint(slot);
    if (!div) return "";
    return this.#interpolate(div.innerHTML, item);
  }

  renderForm(slot, data = {}) {
    const div = this.#cloneBlueprint(slot);
    if (!div) return "";
    return this.#interpolate(div.innerHTML, data);
  }

  renderPartial(slot, data = {}) {
    const div = this.#cloneBlueprint(slot);
    if (!div) return "";
    return this.#interpolate(div.innerHTML, data);
  }

  syncResponse(data) {
    if (!data || typeof data !== "object") return;
    const updates = {};
    const props = this.constructor.props || {};
    for (const [key, value] of Object.entries(data)) {
      if (key in props || key in this.state) {
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length > 0) {
      Object.assign(this.state, updates);
    }
  }

  async withLoading(key, fn) {
    this.loading[key] = true;
    this.error[key] = undefined;
    try {
      const result = await fn();
      if (result?.error) {
        this.error[key] = result.error;
      } else {
        this.error[key] = undefined;
      }
      return result;
    } catch (err) {
      this.error[key] = err.message || String(err);
      throw err;
    } finally {
      this.loading[key] = false;
    }
  }

  #enqueueRender() {
    if (this.#renderQueued) return;
    this.#renderQueued = true;
    queueMicrotask(() => {
      this.render();
      this.#renderQueued = false;
    });
  }

  connectedCallback() {
    if (this.variant) this.dataset.variant = this.variant;

    if (this.#isTestMode()) {
      this.setAttribute("data-testid", this.$testId);
    }

    // Auto-render when state changes
    this.effect(() => {
      const tracks = this.constructor.tracks;

      if (tracks === null) {
        this.#stateStore.root.get();
      } else if (Array.isArray(tracks)) {
        for (const path of tracks) {
          const value = this.#getNestedValue(this.#stateStore.root.get(), path);
        }
      }

      this.#enqueueRender();
    });

    // Sync URL when url-props change
    let lastUrlState = window.location.search;
    this.effect(() => {
      const props = this.constructor.props || {};
      for (const [key, def] of Object.entries(props)) {
        if (def && typeof def === "object" && def.url) {
          this.state[key];
        }
      }
      this.#pushUrlState();
      if (window.location.search !== lastUrlState) {
        lastUrlState = window.location.search;
        queueMicrotask(() => this.onUrlChange?.());
      }
    });

    this.#bindUrlState();

    if (this.#isTestMode()) {
      this.$emit("mounted", { testId: this.$testId });
    }

    this.onMount?.();
  }

  disconnectedCallback() {
    this.#cleanups.forEach((cleanup) => cleanup());
    this.#cleanups.clear();

    if (this.#isTestMode()) {
      this.$emit("unmounted", { testId: this.$testId });
    }

    this.onUnmount?.();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal !== newVal) {
      if (this.#isTestMode() && name !== "data-testid" && name !== "test-mode") {
        this.$emit("attributeChanged", { attribute: name, oldValue: oldVal, newValue: newVal });
      }
      this.#enqueueRender();
    }
  }

  render() {
    const globalStyles = window.nofoUIStyles || "";
    const componentStyles = this.styles?.() || "";
    const rawTemplate = this.template();

    // Cache template - only re-render if template code changed
    if (rawTemplate !== this.#cachedTemplateString) {
      this.#cachedTemplateString = rawTemplate;
      this.#cachedTemplate = null;
    }

    // If we have cached nodes, do diffing update instead of full innerHTML
    if (this.#cachedTemplate) {
      this.#updateFromCache();
    } else {
      // Full render - cache for next time
      this.shadowRoot.innerHTML = `<style>${globalStyles}${componentStyles}</style>${rawTemplate}`;
      const tpl = document.createElement("template");
      tpl.innerHTML = `<style>${globalStyles}${componentStyles}</style>${rawTemplate}`;
      this.#cachedTemplate = tpl.content;
      this.#registerBlueprints();
      this.#bindEvents();
    }

    if (this.#isTestMode()) {
      this.$emit("rendered", { testId: this.$testId });
    }
  }

  #updateFromCache() {
    // Fine-grained: only update text nodes and attributes, don't rebuild DOM
    const oldRoot = this.shadowRoot;
    const newRoot = this.#cachedTemplate.cloneNode(true);

    // Update text content in text nodes
    this.#diffTextNodes(oldRoot, newRoot);
  }

  #diffTextNodes(oldNode, newNode) {
    const oldChildren = oldNode.childNodes;
    const newChildren = newNode.childNodes;

    for (let i = 0; i < newChildren.length; i++) {
      const oldChild = oldChildren[i];
      const newChild = newChildren[i];

      if (!oldChild || !newChild) continue;

      if (newChild.nodeType === Node.TEXT_NODE) {
        if (oldChild.textContent !== newChild.textContent) {
          oldChild.textContent = newChild.textContent;
        }
      } else if (newChild.nodeType === Node.ELEMENT_NODE) {
        // Recursively diff element children
        if (oldChild.nodeType === Node.ELEMENT_NODE) {
          this.#diffAttributes(oldChild, newChild);
          this.#diffTextNodes(oldChild, newChild);
        }
      }
    }
  }

  #diffAttributes(oldEl, newEl) {
    const newAttrs = newEl.attributes;
    const oldAttrs = oldEl.attributes;

    // Set new/changed attributes
    for (let i = 0; i < newAttrs.length; i++) {
      const attr = newAttrs[i];
      if (oldEl.getAttribute(attr.name) !== attr.value) {
        oldEl.setAttribute(attr.name, attr.value);
      }
    }

    // Remove old attributes
    for (let i = 0; i < oldAttrs.length; i++) {
      const attr = oldAttrs[i];
      if (!newEl.hasAttribute(attr.name)) {
        oldEl.removeAttribute(attr.name);
      }
    }
  }

  template() {
    return "";
  }
  styles() {
    return "";
  }

  attr(n, v) {
    if (v === undefined) return this.getAttribute(n);
    v === null || v === false ? this.removeAttribute(n) : this.setAttribute(n, v === true ? "" : v);
    return null;
  }
  has(n) {
    return this.hasAttribute(n);
  }

  query(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  queryAll(selector) {
    return Array.from(this.shadowRoot.querySelectorAll(selector));
  }

  click() {
    const button =
      this.shadowRoot.querySelector("button") ||
      this.shadowRoot.querySelector("[tabindex]") ||
      this;
    button?.click?.() || this.click?.();
    if (this.#isTestMode()) {
      this.emit("clicked", { testId: this.$testId });
    }
    return this;
  }

  focus() {
    const focusable =
      this.shadowRoot.querySelector("button, input, select, textarea, [tabindex]") || this;
    focusable?.focus?.();
    if (this.#isTestMode()) {
      this.emit("focused", { testId: this.$testId });
    }
    return this;
  }

  blur() {
    const focusable =
      this.shadowRoot.querySelector("button, input, select, textarea, [tabindex]") || this;
    focusable?.blur?.();
    if (this.#isTestMode()) {
      this.emit("blurred", { testId: this.$testId });
    }
    return this;
  }

  setProps(props) {
    for (const [key, value] of Object.entries(props)) {
      this[key] = value;
    }
    if (this.#isTestMode()) {
      this.emit("propsSet", { props });
    }
    return this;
  }

  trigger(eventName, detail = {}) {
    const event = new CustomEvent(eventName, { detail, bubbles: true, composed: true });
    this.dispatchEvent(event);
    if (this.#isTestMode()) {
      this.emit("eventTriggered", { event: eventName, detail });
    }
    return this;
  }

  css(cssProperty, value) {
    if (cssProperty && typeof cssProperty === "object" && value === undefined) {
      for (const [prop, val] of Object.entries(cssProperty)) {
        this.style.setProperty(prop.startsWith("--") ? prop : `--${prop}`, val);
      }
      if (this.#isTestMode()) {
        this.$emit("stylesChanged", { styles: cssProperty });
      }
      return this;
    }
    if (value === undefined) {
      return getComputedStyle(this).getPropertyValue(cssProperty).trim();
    }
    this.style.setProperty(cssProperty.startsWith("--") ? cssProperty : `--${cssProperty}`, value);
    if (this.#isTestMode()) {
      this.$emit("styleChanged", { property: cssProperty, value });
    }
    return this;
  }

  cssVar(varName, value) {
    if (varName && typeof varName === "object" && value === undefined) {
      for (const [name, val] of Object.entries(varName)) {
        const prefix = name.startsWith("--") ? "" : "--";
        this.style.setProperty(`${prefix}${name}`, val);
      }
      if (this.#isTestMode()) {
        this.$emit("cssVarsChanged", { vars: varName });
      }
      return this;
    }
    const prefix = varName.startsWith("--") ? "" : "--";
    return this.css(prefix + varName, value);
  }

  theme() {
    return this.#getThemeVars();
  }

  #getThemeVars() {
    const vars = {};
    const rootStyles = getComputedStyle(this);
    const knownVars = [
      "background",
      "background-color",
      "foreground",
      "border",
      "radius",
      "accent-primary",
      "accent-secondary",
      "spacing",
      "shadow",
      "font-family",
      "font-size",
      "z-tooltip",
      "z-modal",
      "success",
      "warning",
      "destructive",
    ];
    knownVars.forEach((v) => {
      const val = rootStyles.getPropertyValue(`--nofo-ui-${v}`).trim();
      if (val) vars[`nofo-ui-${v}`] = val;
      const nofoVal = rootStyles.getPropertyValue(`--nofo-${v}`).trim();
      if (nofoVal) vars[`nofo-${v}`] = nofoVal;
    });
    return vars;
  }

  setTheme(themeName) {
    this.setAttribute("theme", themeName);
    if (this.#isTestMode()) {
      this.$emit("themeChanged", { theme: themeName });
    }
    return this;
  }

  setTheme(themeName) {
    this.setAttribute("theme", themeName);
    if (this.#isTestMode()) {
      this.$emit("themeChanged", { theme: themeName });
    }
    return this;
  }

  toggleTheme() {
    const current = this.getAttribute("theme") || this.dataset.theme || "light";
    const next = current === "dark" ? "light" : "dark";
    return this.setTheme(next);
  }

  colorMode(mode) {
    this.setAttribute("color-mode", mode);
    if (this.#isTestMode()) {
      this.$emit("colorModeChanged", { mode });
    }
    return this;
  }

  size(size) {
    this.setAttribute("size", size);
    if (this.#isTestMode()) {
      this.$emit("sizeChanged", { size });
    }
    return this;
  }

  variant(variant) {
    this.setAttribute("variant", variant);
    if (this.#isTestMode()) {
      this.$emit("variantChanged", { variant });
    }
    return this;
  }

  disabled(disabled = true) {
    this.setAttribute("disabled", disabled ? "" : null);
    if (this.#isTestMode()) {
      this.$emit("disabledChanged", { disabled });
    }
    return this;
  }

  toggleDisabled() {
    const current = this.hasAttribute("disabled");
    return this.disabled(!current);
  }

  loading(loading = true) {
    this.setAttribute("loading", loading ? "" : null);
    if (this.#isTestMode()) {
      this.$emit("loadingChanged", { loading });
    }
    return this;
  }

  toggleLoading() {
    const current = this.hasAttribute("loading");
    return this.loading(!current);
  }

  is(state) {
    if (state === "disabled") return this.hasAttribute("disabled");
    if (state === "loading") return this.hasAttribute("loading");
    if (state === "readonly" || state === "readonly") return this.hasAttribute("readonly");
    if (state === "checked") return this.hasAttribute("checked");
    if (state === "open") return this.hasAttribute("open");
    if (state === "active") return this.hasAttribute("active");
    if (state === "focused") return this === document.activeElement;
    if (state === "hidden") return this.hasAttribute("hidden") || this.style.display === "none";
    if (state === "theme:dark")
      return this.getAttribute("theme") === "dark" || this.dataset.theme === "dark";
    if (state === "theme:light")
      return this.getAttribute("theme") === "light" || this.dataset.theme === "light";
    return this.dataset[state] !== undefined;
  }

  hasTheme(themeName) {
    const theme =
      this.getAttribute("theme") || this.dataset.theme || this.getAttribute("color-mode");
    return theme === themeName;
  }

  transition(css = "all 0.2s ease") {
    this.style.transition = css;
    return this;
  }

  animate(animationName) {
    this.style.animation = `${animationName} 0.3s ease forwards`;
    if (this.#isTestMode()) {
      this.$emit("animated", { animation: animationName });
    }
    return this;
  }

  breakpoint(name) {
    const breakpoints = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280, "2xl": 1536 };
    return this.css("breakpoint", breakpoints[name]?.toString() || name);
  }

  mediaQuery(query) {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }

  getStyles() {
    return {
      element: this.style.cssText,
      computed: getComputedStyle(this),
      cssVars: this.#getThemeVars(),
      classList: Array.from(this.classList),
      dataset: { ...this.dataset },
      states: {
        disabled: this.is("disabled"),
        loading: this.is("loading"),
        focused: this.is("focused"),
        checked: this.is("checked"),
        open: this.is("open"),
        theme: this.getAttribute("theme") || this.dataset.theme,
      },
    };
  }

  log(...args) {
    if (this.constructor.debug || this.#isTestMode()) {
      console.log(`[${this.tagName}]`, ...args);
    }
    return this;
  }

  warn(...args) {
    console.warn(`[${this.tagName}]`, ...args);
    return this;
  }

  error(...args) {
    console.error(`[${this.tagName}]`, ...args);
    return this;
  }

  inspect() {
    if (this.#isTestMode()) {
      return {
        tag: this.tagName,
        props: this.$props,
        state: this.$state,
        methods: this.$methods,
        refs: this.#refs,
        dataset: { ...this.dataset },
        attributes: Array.from(this.attributes).map((a) => ({ name: a.name, value: a.value })),
        testId: this.$testId,
      };
    }
    return null;
  }
}
