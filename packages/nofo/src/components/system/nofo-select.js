import { NofoElement, useClickOutside } from "../../index.js";

class NofoSelect extends NofoElement {
  static props = {
    value: null,
    defaultValue: null,
    name: "",
    required: false,
    disabled: false,
    size: "2",
    variant: "surface",
    color: "accent",
    radius: "medium",
    open: false,
  };

  #clickOutsideCleanup = null;

  onMount() {
    this.sync()
      .attr("size")
      .toDataAttr("size")
      .attr("variant")
      .toDataAttr("variant")
      .attr("open")
      .toDataAttr("state", (val) => (val ? "open" : "closed"))
      .attr("disabled")
      .toDataAttr("disabled");

    if (this.state.value === null && this.state.defaultValue !== null) {
      this.state.value = this.state.defaultValue;
    }

    this.addEventListener("nofo-select-toggle", () => {
      if (!this.state.disabled) {
        this.state.open = !this.state.open;
      }
    });

    this.addEventListener("nofo-select-item-select", (e) => {
      const { value } = e.detail;
      this.state.value = value;
      this.state.open = false;

      this.dispatchEvent(
        new CustomEvent("value-change", {
          detail: { value },
          bubbles: true,
          composed: true,
        }),
      );
    });

    this.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.state.open) {
        this.state.open = false;
      }
    });

    this.effect(() => {
      const content = this.querySelector("nofo-select-content");
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
    return `
      :host {
        display: inline-block;
        position: relative;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoSelectTrigger extends NofoElement {
  static props = {
    placeholder: "",
  };

  onMount() {
    const select = this.closest("nofo-select");
    if (select) {
      this.sync().dataAttr("size").from(select, "size").dataAttr("variant").from(select, "variant");
    }
  }

  handleClick() {
    this.dispatchEvent(
      new CustomEvent("nofo-select-toggle", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    return `
      <div class="trigger-inner" on-click="handleClick">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
      }
      .trigger-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius);
        border: 1px solid var(--gray-6);
        background-color: var(--color-panel-solid);
        cursor: pointer;
        min-width: 120px;
        transition: border-color 0.2s;
      }
      .trigger-inner:hover { border-color: var(--gray-8); }
    `;
  }
}

class NofoSelectValue extends NofoElement {
  onMount() {
    const select = this.closest("nofo-select");
    if (select) {
      this.effect(() => {
        const value = select.state.value;
        const selectedItem = select.querySelector(`nofo-select-item[value="${value}"]`);
        if (selectedItem) {
          const text = selectedItem.querySelector("nofo-select-item-text");
          this.shadowRoot.querySelector(".value-text").textContent = text
            ? text.textContent
            : selectedItem.textContent.trim();
        } else {
          const trigger = select.querySelector("nofo-select-trigger");
          this.shadowRoot.querySelector(".value-text").textContent = trigger
            ? trigger.state.placeholder
            : "";
        }
      });
    }
  }

  template() {
    return `<span class="value-text"></span><slot style="display:none"></slot>`;
  }

  styles() {
    return `
      :host { flex: 1; box-sizing: border-box; }
      .value-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `;
  }
}

class NofoSelectIcon extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        margin-left: var(--space-2);
        box-sizing: border-box;
      }
    `;
  }
}

class NofoSelectContent extends NofoElement {
  static props = {
    position: "popper",
    side: "bottom",
    align: "start",
  };

  onMount() {
    this.sync().attr("side").toDataAttr("side").attr("align").toDataAttr("align");

    const select = this.closest("nofo-select");
    if (select) {
      this.effect(() => {
        this.setAttribute("data-state", select.state.open ? "open" : "closed");
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
        border-radius: var(--radius);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        padding: 0.5rem;
        min-width: 160px;
        max-height: 300px;
        overflow-y: auto;
        z-index: 50;
        display: none;
        box-sizing: border-box;
      }
      :host([data-state="open"]) { display: block; }
      
      :host([data-side="top"]) { bottom: calc(100% + 5px); }
      :host([data-side="bottom"]) { top: calc(100% + 5px); }
      :host([data-side="left"]) { right: calc(100% + 5px); }
      :host([data-side="right"]) { left: calc(100% + 5px); }
    `;
  }
}

class NofoSelectGroup extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `:host { display: block; box-sizing: border-box; }`;
  }
}

class NofoSelectLabel extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--gray-10);
        text-transform: uppercase;
        letter-spacing: 0.025em;
        box-sizing: border-box;
        display: block;
      }
    `;
  }
}

class NofoSelectItem extends NofoElement {
  static props = {
    value: null,
    disabled: false,
  };

  onMount() {
    this.sync().attr("disabled").toDataAttr("disabled");

    const select = this.closest("nofo-select");
    if (select) {
      this.effect(() => {
        const isSelected = select.state.value === this.state.value;
        this.setAttribute("data-state", isSelected ? "checked" : "unchecked");
      });
    }
  }

  handleSelect() {
    if (this.state.disabled) return;
    this.dispatchEvent(
      new CustomEvent("nofo-select-item-select", {
        detail: { value: this.state.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  template() {
    return `<div class="item-inner" on-click="handleSelect"><slot></slot></div>`;
  }

  styles() {
    return `
      :host { display: block; box-sizing: border-box; }
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
      :host([data-disabled]) .item-inner { cursor: not-allowed; color: var(--gray-8); }
      :host(:not([data-disabled]):hover) .item-inner { background-color: var(--gray-3); }
      :host([data-state="checked"]) .item-inner { background-color: var(--accent-3); color: var(--accent-11); }
    `;
  }
}

class NofoSelectItemText extends NofoElement {
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `:host { flex: 1; box-sizing: border-box; }`;
  }
}

class NofoSelectItemIndicator extends NofoElement {
  onMount() {
    const item = this.closest("nofo-select-item");
    if (item) {
      this.effect(() => {
        this.style.display = item.getAttribute("data-state") === "checked" ? "flex" : "none";
      });
    }
  }
  template() {
    return `<slot></slot>`;
  }
  styles() {
    return `
      :host {
        display: none;
        align-items: center;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoSelectSeparator extends NofoElement {
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

customElements.define("nofo-select", NofoSelect);
customElements.define("nofo-select-trigger", NofoSelectTrigger);
customElements.define("nofo-select-value", NofoSelectValue);
customElements.define("nofo-select-icon", NofoSelectIcon);
customElements.define("nofo-select-content", NofoSelectContent);
customElements.define("nofo-select-group", NofoSelectGroup);
customElements.define("nofo-select-label", NofoSelectLabel);
customElements.define("nofo-select-item", NofoSelectItem);
customElements.define("nofo-select-item-text", NofoSelectItemText);
customElements.define("nofo-select-item-indicator", NofoSelectItemIndicator);
customElements.define("nofo-select-separator", NofoSelectSeparator);

export {
  NofoSelect,
  NofoSelectTrigger,
  NofoSelectValue,
  NofoSelectIcon,
  NofoSelectContent,
  NofoSelectGroup,
  NofoSelectLabel,
  NofoSelectItem,
  NofoSelectItemText,
  NofoSelectItemIndicator,
  NofoSelectSeparator,
};
