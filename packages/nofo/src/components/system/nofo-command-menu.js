import { NofoElement, useClickOutside } from "../../index.js";

class NofoCommandMenu extends NofoElement {
  static props = {
    open: false,
    defaultOpen: false,
  };

  #clickOutsideCleanup = null;
  #selectedIndex = -1;

  constructor() {
    super();
  }

  get _selectedIndex() {
    return this.#selectedIndex;
  }

  set _selectedIndex(val) {
    this.#selectedIndex = val;
  }

  onMount() {
    if (this.defaultOpen) {
      this.attr("open", "");
    }
    this.updateMenu();
    this.setupEventListeners();
  }

  setupEventListeners() {
    const trigger = this.querySelector("nofo-command-menu-trigger");
    if (trigger) {
      trigger.addEventListener("click", () => {
        this.toggle();
      });
    }

    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        this.attr("open", "");
      }

      if (e.key === "Escape" && this.has("open")) {
        this.removeAttribute("open");
      }

      if (this.has("open")) {
        const items = this.querySelectorAll("nofo-command-menu-item:not([disabled])");
        if (e.key === "ArrowDown") {
          e.preventDefault();
          this._selectedIndex = Math.min(this._selectedIndex + 1, items.length - 1);
          this.updateSelection();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          this._selectedIndex = Math.max(this._selectedIndex - 1, -1);
          this.updateSelection();
        } else if (e.key === "Enter" && this._selectedIndex >= 0) {
          e.preventDefault();
          items[this._selectedIndex].click();
        }
      }
    });

    const input = this.querySelector("nofo-command-menu-input");
    if (input) {
      input.addEventListener("input", (e) => {
        this.filterItems(e.target.value);
      });
    }

    this.effect(() => {
      const content = this.querySelector("nofo-command-menu-content");
      if (content) {
        if (this.has("open")) {
          const { bind } = useClickOutside();
          this.#clickOutsideCleanup = bind(content, () => {
            if (this.has("open")) {
              this.removeAttribute("open");
            }
          });
        } else if (this.#clickOutsideCleanup) {
          this.#clickOutsideCleanup();
          this.#clickOutsideCleanup = null;
        }
      }
    });
  }

  onUnmount() {
    if (this.#clickOutsideCleanup) {
      this.#clickOutsideCleanup();
    }
  }

  toggle() {
    if (this.has("open")) {
      this.removeAttribute("open");
    } else {
      this.attr("open", "");
    }
  }

  updateSelection() {
    const items = this.querySelectorAll("nofo-command-menu-item");
    items.forEach((item, index) => {
      if (index === this._selectedIndex) {
        item.setAttribute("data-selected", "");
        item.scrollIntoView({ block: "nearest" });
      } else {
        item.removeAttribute("data-selected");
      }
    });
  }

  filterItems(query) {
    const items = this.querySelectorAll("nofo-command-menu-item");
    const queryLower = query.toLowerCase();

    items.forEach((item) => {
      const text = item.textContent.toLowerCase();
      if (text.includes(queryLower)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });

    const visibleItems = Array.from(items).filter((item) => item.style.display !== "none");
    const empty = this.querySelector("nofo-command-menu-empty");
    if (empty) {
      empty.style.display = visibleItems.length === 0 ? "block" : "none";
    }
  }

  updateMenu() {
    const content = this.querySelector("nofo-command-menu-content");
    if (content) {
      if (this.open) {
        content.setAttribute("open", "");
        const input = this.querySelector("nofo-command-menu-input");
        if (input) {
          setTimeout(() => input.focus(), 0);
        }
      } else {
        content.removeAttribute("open");
      }
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: contents;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCommandMenuTrigger extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: contents;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCommandMenuContent extends NofoElement {
  static props = {
    open: false,
  };

  onMount() {
    this.updateDataAttributes();
  }

  updateDataAttributes() {
    const isOpen = this.has("open");
    this.dataset.state = isOpen ? "open" : "closed";
  }

  template() {
    const isOpen = this.has("open") || this.open;

    const styles = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "90vw",
      maxWidth: "640px",
      maxHeight: "85vh",
      backgroundColor: "var(--color-panel-solid)",
      borderRadius: "var(--radius)",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      border: "1px solid var(--gray-6)",
      zIndex: 1000,
      display: isOpen ? "flex" : "none",
      flexDirection: "column",
      overflow: "hidden",
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90vw;
        max-width: 640px;
        max-height: 85vh;
        background-color: var(--color-panel-solid);
        border-radius: var(--radius);
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        border: 1px solid var(--gray-6);
        z-index: 1000;
        display: none;
        flex-direction: column;
        overflow: hidden;
        box-sizing: border-box;
      }
      :host([open]) {
        display: flex;
      }
    `;
  }
}

class NofoCommandMenuInput extends NofoElement {
  static props = {
    placeholder: "Type a command...",
  };

  template() {
    return `<input type="text" placeholder="${this.placeholder}" />`;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
      }
      input {
        width: 100%;
        padding: 1rem;
        border: none;
        border-bottom: 1px solid var(--gray-6);
        background-color: transparent;
        font-size: 1rem;
        outline: none;
        color: var(--gray-12);
      }
    `;
  }
}

class NofoCommandMenuList extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
        overflow-y: auto;
        padding: 0.5rem;
        max-height: calc(85vh - 80px);
      }
    `;
  }
}

class NofoCommandMenuGroup extends NofoElement {
  static props = {
    heading: "",
  };

  template() {
    return `
      ${this.heading ? `<div style="padding: 0.5rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: var(--gray-10); text-transform: uppercase;">${this.heading}</div>` : ""}
      <slot></slot>
    `;
  }

  styles() {
    return `
      :host {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCommandMenuItem extends NofoElement {
  static props = {
    value: "",
    disabled: false,
  };

  onMount() {
    this.setupEventListeners();
    this.updateDataAttributes();
  }

  setupEventListeners() {
    this.addEventListener("click", () => {
      if (this.disabled) return;

      const commandMenu = this.closest("nofo-command-menu");
      if (commandMenu) {
        commandMenu.removeAttribute("open");
      }

      const event = new CustomEvent("select", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);
    });
  }

  updateDataAttributes() {
    if (this.disabled) {
      this.dataset.disabled = "";
    } else {
      delete this.dataset.disabled;
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius);
        cursor: pointer;
        font-size: 0.875rem;
        color: var(--gray-12);
        background-color: transparent;
        transition: all 0.15s;
        box-sizing: border-box;
      }
      :host([disabled]) {
        cursor: not-allowed;
        color: var(--gray-8);
      }
      :host(:not([disabled]):hover) {
        background-color: var(--gray-3);
      }
      :host([data-selected]) {
        background-color: var(--gray-3);
      }
    `;
  }
}

class NofoCommandMenuSeparator extends NofoElement {
  template() {
    return ``;
  }

  styles() {
    return `
      :host {
        height: 1px;
        background-color: var(--gray-6);
        margin: 0.5rem 0;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCommandMenuEmpty extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        padding: 2rem;
        text-align: center;
        color: var(--gray-10);
        font-size: 0.875rem;
        display: none;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-command-menu", NofoCommandMenu);
customElements.define("nofo-command-menu-trigger", NofoCommandMenuTrigger);
customElements.define("nofo-command-menu-content", NofoCommandMenuContent);
customElements.define("nofo-command-menu-input", NofoCommandMenuInput);
customElements.define("nofo-command-menu-list", NofoCommandMenuList);
customElements.define("nofo-command-menu-group", NofoCommandMenuGroup);
customElements.define("nofo-command-menu-item", NofoCommandMenuItem);
customElements.define("nofo-command-menu-separator", NofoCommandMenuSeparator);
customElements.define("nofo-command-menu-empty", NofoCommandMenuEmpty);

export {
  NofoCommandMenu,
  NofoCommandMenuTrigger,
  NofoCommandMenuContent,
  NofoCommandMenuInput,
  NofoCommandMenuList,
  NofoCommandMenuGroup,
  NofoCommandMenuItem,
  NofoCommandMenuSeparator,
  NofoCommandMenuEmpty,
};
