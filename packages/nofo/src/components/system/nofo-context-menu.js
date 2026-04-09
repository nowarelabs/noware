import { NofoElement, useClickOutside } from "../../index.js";

class NofoContextMenu extends NofoElement {
  static props = {
    open: false,
    x: 0,
    y: 0,
  };

  #clickOutsideCleanup = null;

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (v) => (v ? "open" : "closed"));

    this.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.state.open) {
        this.state.open = false;
      }
    });

    this.effect(() => {
      const content = this.querySelector("nofo-context-menu-content");
      if (content) {
        if (this.state.open) {
          const { bind } = useClickOutside();
          this.#clickOutsideCleanup = bind(content, () => {
            if (this.state.open) {
              this.state.open = false;
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

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoContextMenuTrigger extends NofoElement {
  onMount() {
    this.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const root = this.closest("nofo-context-menu");
      if (root) {
        root.state.x = e.clientX;
        root.state.y = e.clientY;
        root.state.open = true;
      }
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoContextMenuContent extends NofoElement {
  onMount() {
    const root = this.closest("nofo-context-menu");
    if (root) {
      this.effect(() => {
        this.setAttribute("data-state", root.state.open ? "open" : "closed");
        if (root.state.open) {
          this.style.left = `${root.state.x}px`;
          this.style.top = `${root.state.y}px`;
        }
      });
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const root = this.closest("nofo-context-menu");
    const isOpen = root && root.state.open;

    return `
      :host {
        position: fixed;
        background-color: var(--color-panel-solid);
        border-radius: 0.375rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        padding: 0.5rem;
        min-width: 160px;
        z-index: 100;
        display: ${isOpen ? "flex" : "none"};
        flex-direction: column;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoContextMenuItem extends NofoElement {
  static props = {
    shortcut: "",
    color: "",
  };

  onMount() {
    this.sync().attr("color").toDataAttr("color");
  }

  handleClick() {
    const root = this.closest("nofo-context-menu");
    if (root) root.state.open = false;
  }

  template() {
    return `
      <div class="item-inner" on-click="handleClick">
        <slot></slot>
        ${this.state.shortcut ? `<span class="shortcut">${this.state.shortcut}</span>` : ""}
      </div>
    `;
  }

  styles() {
    const color = this.state.color;
    return `
      :host { display: block; width: 100%; box-sizing: border-box; }
      .item-inner {
        display: flex;
        align-items: center;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.875rem;
        line-height: 1.25rem;
        color: ${color ? `var(--${color}-11)` : "var(--gray-12)"};
        gap: 0.5rem;
        transition: background-color 0.2s;
      }
      .item-inner:hover { background-color: var(--gray-3); }
      .shortcut { margin-left: auto; color: var(--gray-10); font-size: 0.75rem; }
    `;
  }
}

class NofoContextMenuSeparator extends NofoElement {
  template() {
    return ``;
  }

  styles() {
    return `
      :host {
        display: block;
        height: 1px;
        background-color: var(--gray-6);
        margin: 0.25rem 0;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoContextMenuSub extends NofoElement {
  static props = {
    open: false,
  };

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (v) => (v ? "open" : "closed"));
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; position: relative; }`;
  }
}

class NofoContextMenuSubTrigger extends NofoElement {
  handleMouseEnter() {
    const sub = this.closest("nofo-context-menu-sub");
    if (sub) sub.state.open = true;
  }

  template() {
    return `
      <div class="item-inner" on-mouseenter="handleMouseEnter">
        <slot></slot>
        <slot name="suffix"></slot>
      </div>
    `;
  }

  styles() {
    return `
      :host { display: block; width: 100%; box-sizing: border-box; }
      .item-inner {
        display: flex;
        align-items: center;
        padding: 0.5rem 0.75rem;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.875rem;
        line-height: 1.25rem;
        color: var(--gray-12);
        gap: 0.5rem;
        transition: background-color 0.2s;
      }
      .item-inner:hover { background-color: var(--gray-3); }
    `;
  }
}

class NofoContextMenuSubContent extends NofoElement {
  onMount() {
    const sub = this.closest("nofo-context-menu-sub");
    if (sub) {
      this.effect(() => {
        this.setAttribute("data-state", sub.state.open ? "open" : "closed");
      });
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const sub = this.closest("nofo-context-menu-sub");
    const isOpen = sub && sub.state.open;

    return `
      :host {
        position: absolute;
        left: 100%;
        top: 0;
        background-color: var(--color-panel-solid);
        border-radius: 0.375rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        padding: 0.5rem;
        min-width: 120px;
        z-index: 110;
        display: ${isOpen ? "flex" : "none"};
        flex-direction: column;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-context-menu", NofoContextMenu);
customElements.define("nofo-context-menu-trigger", NofoContextMenuTrigger);
customElements.define("nofo-context-menu-content", NofoContextMenuContent);
customElements.define("nofo-context-menu-item", NofoContextMenuItem);
customElements.define("nofo-context-menu-separator", NofoContextMenuSeparator);
customElements.define("nofo-context-menu-sub", NofoContextMenuSub);
customElements.define("nofo-context-menu-sub-trigger", NofoContextMenuSubTrigger);
customElements.define("nofo-context-menu-sub-content", NofoContextMenuSubContent);

export {
  NofoContextMenu,
  NofoContextMenuTrigger,
  NofoContextMenuContent,
  NofoContextMenuItem,
  NofoContextMenuSeparator,
  NofoContextMenuSub,
  NofoContextMenuSubTrigger,
  NofoContextMenuSubContent,
};
