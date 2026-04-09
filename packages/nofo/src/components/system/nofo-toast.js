import { NofoElement, useTimeout } from "../../index.js";

class NofoToastGroup extends NofoElement {
  static props = {
    position: "bottom-right",
  };

  onMount() {
    this.sync().attr("position").toDataAttr("position");
  }

  getPositionStyles(position) {
    const positions = {
      "top-left": { top: "1rem", left: "1rem" },
      "top-right": { top: "1rem", right: "1rem" },
      "top-center": { top: "1rem", left: "50%", transform: "translateX(-50%)" },
      "bottom-left": { bottom: "1rem", left: "1rem" },
      "bottom-right": { bottom: "1rem", right: "1rem" },
      "bottom-center": { bottom: "1rem", left: "50%", transform: "translateX(-50%)" },
    };
    return positions[position] || positions["bottom-right"];
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const positionStyles = this.getPositionStyles(this.state.position);
    return `
      :host {
        position: fixed;
        display: flex;
        flexDirection: column;
        gap: 0.5rem;
        z-index: 1000;
        pointer-events: none;
        box-sizing: border-box;
        ${Object.entries(positionStyles)
          .map(([k, v]) => `${k}: ${v};`)
          .join(" ")}
      }
      ::slotted(nofo-toast) {
        pointer-events: auto;
      }
    `;
  }
}

class NofoToast extends NofoElement {
  static props = {
    variant: "default",
    duration: 5000,
    open: false,
    defaultOpen: false,
  };

  #timer = useTimeout();

  onMount() {
    this.sync()
      .attr("variant")
      .toDataAttr("variant")
      .attr("open")
      .toDataAttr("state", (v) => (v ? "open" : "closed"));

    if (this.state.defaultOpen) {
      this.state.open = true;
    }

    if (this.state.open) {
      this.startTimer();
    }

    this.effect(() => {
      if (this.state.open) {
        this.startTimer();
      } else {
        this.#timer.clear();
      }
    });
  }

  onUnmount() {
    this.#timer.clear();
  }

  startTimer() {
    this.#timer.clear();
    if (this.state.duration > 0) {
      this.#timer.set(() => {
        this.state.open = false;
        this.dispatchEvent(
          new CustomEvent("open-change", {
            detail: { open: false },
            bubbles: true,
            composed: true,
          }),
        );
      }, this.state.duration);
    }
  }

  getVariantStyles(variant) {
    const variants = {
      default: {
        backgroundColor: "var(--color-panel-solid)",
        border: "1px solid var(--gray-6)",
        color: "var(--gray-12)",
      },
      success: {
        backgroundColor: "var(--green-3)",
        border: "1px solid var(--green-7)",
        color: "var(--green-11)",
      },
      error: {
        backgroundColor: "var(--red-3)",
        border: "1px solid var(--red-7)",
        color: "var(--red-11)",
      },
      warning: {
        backgroundColor: "var(--amber-3)",
        border: "1px solid var(--amber-7)",
        color: "var(--amber-11)",
      },
      info: {
        backgroundColor: "var(--blue-3)",
        border: "1px solid var(--blue-7)",
        color: "var(--blue-11)",
      },
    };
    return variants[variant] || variants["default"];
  }

  template() {
    return `
      <div class="toast-content">
        <slot></slot>
      </div>
      <button class="toast-close" aria-label="Close" on-click="handleClose">
        <nofo-icon name="cross"></nofo-icon>
      </button>
    `;
  }

  handleClose() {
    this.state.open = false;
    this.dispatchEvent(
      new CustomEvent("open-change", { detail: { open: false }, bubbles: true, composed: true }),
    );
  }

  styles() {
    const variantStyles = this.getVariantStyles(this.state.variant);
    return `
      :host {
        display: ${this.state.open ? "flex" : "none"};
        align-items: flex-start;
        gap: 0.75rem;
        padding: 1rem;
        border-radius: var(--radius);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        min-width: 300px;
        max-width: 400px;
        position: relative;
        box-sizing: border-box;
        ${Object.entries(variantStyles)
          .map(([k, v]) => `${k}: ${v};`)
          .join(" ")}
      }
      .toast-content { flex: 1; }
      .toast-close {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      .toast-close:hover { opacity: 1; }
    `;
  }
}

class NofoToastTitle extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        font-weight: 600;
        font-size: 0.875rem;
        line-height: 1.25rem;
        margin-bottom: 0.25rem;
        display: block;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoToastDescription extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        font-size: 0.875rem;
        line-height: 1.25rem;
        opacity: 0.9;
        display: block;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoToastAction extends NofoElement {
  static props = {
    "alt-text": "",
  };

  onMount() {
    this.addEventListener("click", () => {
      const toast = this.closest("nofo-toast");
      if (toast) toast.state.open = false;
    });
  }

  template() {
    return `
      <button type="button" aria-label="${this.state["alt-text"]}">
        <slot></slot>
      </button>
    `;
  }

  styles() {
    return `
      :host {
        margin-top: 0.5rem;
        padding: 0.5rem 0.75rem;
        border-radius: var(--radius);
        background-color: transparent;
        border: 1px solid currentColor;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.2s;
        display: inline-block;
        box-sizing: border-box;
      }
      :host(:hover) { opacity: 0.8; }
    `;
  }
}

class NofoToastClose extends NofoElement {
  onMount() {
    this.addEventListener("click", () => {
      const toast = this.closest("nofo-toast");
      if (toast) toast.state.open = false;
    });
  }

  template() {
    return "";
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

customElements.define("nofo-toast-group", NofoToastGroup);
customElements.define("nofo-toast", NofoToast);
customElements.define("nofo-toast-title", NofoToastTitle);
customElements.define("nofo-toast-description", NofoToastDescription);
customElements.define("nofo-toast-action", NofoToastAction);
customElements.define("nofo-toast-close", NofoToastClose);

export {
  NofoToastGroup,
  NofoToast,
  NofoToastTitle,
  NofoToastDescription,
  NofoToastAction,
  NofoToastClose,
};
