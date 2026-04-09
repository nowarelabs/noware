import { NofoElement, useClickOutside } from "../../index.js";

class NofoDropdownMenu extends NofoElement {
  static props = {
    open: false,
  };

  #clickOutsideCleanup = null;

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (val) => (val ? "open" : "closed"));

    this.addEventListener("nofo-dropdown-toggle", () => {
      this.state.open = !this.state.open;
    });

    this.addEventListener("nofo-dropdown-close", () => {
      this.state.open = false;
    });

    this.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.state.open) {
        this.state.open = false;
      }
    });

    this.effect(() => {
      const content = this.querySelector("nofo-dropdown-menu-content");
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
    return `:host { display: contents; box-sizing: border-box; }`;
  }
}

class NofoDropdownMenuTrigger extends NofoElement {
  handleClick(e) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("nofo-dropdown-toggle", { bubbles: true, composed: true }));
  }
  template() {
    return `<div on-click="handleClick"><slot></slot></div>`;
  }
  styles() {
    return `:host { display: contents; box-sizing: border-box; } div { display: contents; }`;
  }
}

class NofoDropdownMenuContent extends NofoElement {
  static props = {
    align: "start",
    side: "bottom",
    "side-offset": 5,
  };

  onMount() {
    this.sync().attr("align").toDataAttr("align").attr("side").toDataAttr("side");

    const root = this.closest("nofo-dropdown-menu");
    if (root) {
      this.effect(() => {
        this.setAttribute("data-state", root.state.open ? "open" : "closed");
      });
    }
  }

  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        position: absolute;
        background-color: var(--color-panel-solid);
        border-radius: 0.375rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        padding: 0.5rem;
        min-width: 160px;
        z-index: 50;
        display: none;
        flex-direction: column;
        box-sizing: border-box;
      }
      :host([data-state="open"]) { display: flex; }
      
      :host([data-side="top"]) { bottom: calc(100% + 5px); }
      :host([data-side="bottom"]) { top: calc(100% + 5px); }
      :host([data-side="left"]) { right: calc(100% + 5px); }
      :host([data-side="right"]) { left: calc(100% + 5px); }

      :host([data-align="start"]) { align-items: flex-start; }
      :host([data-align="center"]) { align-items: center; }
      :host([data-align="end"]) { align-items: flex-end; }
    `;
  }
}

class NofoDropdownMenuItem extends NofoElement {
  static props = {
    shortcut: "",
  };

  handleClick() {
    this.dispatchEvent(new CustomEvent("nofo-dropdown-close", { bubbles: true, composed: true }));
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
      .shortcut { margin-left: auto; color: var(--gray-10); font-size: 0.75rem; }
    `;
  }
}

class NofoDropdownMenuSeparator extends NofoElement {
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

class NofoDropdownMenuLabel extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        display: block;
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--gray-10);
        text-transform: uppercase;
        letter-spacing: 0.025em;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoDropdownMenuSub extends NofoElement {
  static props = {
    open: false,
  };

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (val) => (val ? "open" : "closed"));

    this.addEventListener("nofo-dropdown-sub-toggle", (e) => {
      e.stopPropagation();
      this.state.open = !this.state.open;
    });

    this.addEventListener("nofo-dropdown-sub-close", (e) => {
      e.stopPropagation();
      this.state.open = false;
    });
  }

  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `:host { display: contents; position: relative; }`;
  }
}

class NofoDropdownMenuSubTrigger extends NofoElement {
  handleMouseEnter() {
    this.dispatchEvent(
      new CustomEvent("nofo-dropdown-sub-toggle", { bubbles: true, composed: true }),
    );
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

class NofoDropdownMenuSubContent extends NofoElement {
  onMount() {
    const sub = this.closest("nofo-dropdown-menu-sub");
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
        z-index: 60;
        display: none;
        flex-direction: column;
        box-sizing: border-box;
      }
      :host([data-state="open"]) { display: flex; }
    `;
  }
}

class NofoDropdownMenuCheckboxItem extends NofoElement {
  static props = {
    checked: false,
  };

  onMount() {
    this.sync()
      .attr("checked")
      .toDataAttr("state", (val) => (val ? "checked" : "unchecked"));
  }

  handleClick(e) {
    e.stopPropagation();
    this.state.checked = !this.state.checked;
    this.dispatchEvent(
      new CustomEvent("checked-change", {
        detail: { checked: this.state.checked },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    return `
      <div class="item-inner" on-click="handleClick">
        <slot name="indicator"></slot>
        <slot></slot>
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
      ::slotted([slot="indicator"]) { display: none; }
      :host([data-state="checked"]) ::slotted([slot="indicator"]) { display: flex; }
    `;
  }
}

class NofoDropdownMenuRadioGroup extends NofoElement {
  static props = {
    value: null,
  };

  onMount() {
    this.addEventListener("nofo-dropdown-radio-select", (e) => {
      e.stopPropagation();
      this.state.value = e.detail.value;
      this.dispatchEvent(
        new CustomEvent("value-change", {
          detail: { value: this.state.value },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoDropdownMenuRadioItem extends NofoElement {
  static props = {
    value: null,
  };

  onMount() {
    const group = this.closest("nofo-dropdown-menu-radio-group");
    if (group) {
      this.effect(() => {
        const isSelected = group.state.value === this.state.value;
        this.setAttribute("data-state", isSelected ? "checked" : "unchecked");
      });
    }
  }

  handleClick(e) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("nofo-dropdown-radio-select", {
        detail: { value: this.state.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    return `
      <div class="item-inner" on-click="handleClick">
        <slot name="indicator"></slot>
        <slot></slot>
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
      ::slotted([slot="indicator"]) { display: none; }
      :host([data-state="checked"]) ::slotted([slot="indicator"]) { display: flex; }
    `;
  }
}

class NofoDropdownMenuItemIndicator extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `:host { display: flex; align-items: center; box-sizing: border-box; }`;
  }
}

customElements.define("nofo-dropdown-menu", NofoDropdownMenu);
customElements.define("nofo-dropdown-menu-trigger", NofoDropdownMenuTrigger);
customElements.define("nofo-dropdown-menu-content", NofoDropdownMenuContent);
customElements.define("nofo-dropdown-menu-item", NofoDropdownMenuItem);
customElements.define("nofo-dropdown-menu-separator", NofoDropdownMenuSeparator);
customElements.define("nofo-dropdown-menu-label", NofoDropdownMenuLabel);
customElements.define("nofo-dropdown-menu-sub", NofoDropdownMenuSub);
customElements.define("nofo-dropdown-menu-sub-trigger", NofoDropdownMenuSubTrigger);
customElements.define("nofo-dropdown-menu-sub-content", NofoDropdownMenuSubContent);
customElements.define("nofo-dropdown-menu-checkbox-item", NofoDropdownMenuCheckboxItem);
customElements.define("nofo-dropdown-menu-radio-group", NofoDropdownMenuRadioGroup);
customElements.define("nofo-dropdown-menu-radio-item", NofoDropdownMenuRadioItem);
customElements.define("nofo-dropdown-menu-item-indicator", NofoDropdownMenuItemIndicator);

export {
  NofoDropdownMenu,
  NofoDropdownMenuTrigger,
  NofoDropdownMenuContent,
  NofoDropdownMenuItem,
  NofoDropdownMenuSeparator,
  NofoDropdownMenuLabel,
  NofoDropdownMenuSub,
  NofoDropdownMenuSubTrigger,
  NofoDropdownMenuSubContent,
  NofoDropdownMenuCheckboxItem,
  NofoDropdownMenuRadioGroup,
  NofoDropdownMenuRadioItem,
  NofoDropdownMenuItemIndicator,
};
