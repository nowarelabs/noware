import { NofoElement, useClickOutside } from "../../index.js";

class NofoDialog extends NofoElement {
  static props = {
    open: false,
    closeOnOverlayClick: true,
    closeOnEscape: true,
  };

  #clickOutsideCleanup = null;

  onMount() {
    this.sync()
      .attr("open")
      .toDataAttr("state", (v) => (v ? "open" : "closed"));

    this.handleOpenChange(this.state.open);

    this.addEventListener("dialog-open", () => {
      this.state.open = true;
      this.dispatchEvent(
        new CustomEvent("open-change", { detail: { open: true }, bubbles: true, composed: true }),
      );
    });

    this.addEventListener("dialog-close", () => {
      this.state.open = false;
      this.dispatchEvent(
        new CustomEvent("open-change", { detail: { open: false }, bubbles: true, composed: true }),
      );
    });

    if (this.state.closeOnEscape) {
      this._handleEscape = (e) => {
        if (e.key === "Escape" && this.state.open) {
          this.state.open = false;
          this.dispatchEvent(
            new CustomEvent("open-change", {
              detail: { open: false },
              bubbles: true,
              composed: true,
            }),
          );
        }
      };
      document.addEventListener("keydown", this._handleEscape);
    }

    this.effect(() => {
      this.handleOpenChange(this.state.open);

      const content = this.querySelector("[dialog-content]");
      if (content) {
        if (this.state.open && this.state.closeOnOverlayClick) {
          const { bind } = useClickOutside();
          this.#clickOutsideCleanup = bind(content, () => {
            if (this.state.open) {
              this.state.open = false;
              this.dispatchEvent(
                new CustomEvent("open-change", {
                  detail: { open: false },
                  bubbles: true,
                  composed: true,
                }),
              );
            }
          });
        } else if (this.#clickOutsideCleanup) {
          this.#clickOutsideCleanup();
          this.#clickOutsideCleanup = null;
        }
      }
    });
  }

  handleOpenChange(isOpen) {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }

  onUnmount() {
    document.body.style.overflow = "";
    if (this.#clickOutsideCleanup) {
      this.#clickOutsideCleanup();
    }
    if (this._handleEscape) {
      document.removeEventListener("keydown", this._handleEscape);
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoDialogTrigger extends NofoElement {
  onMount() {
    this.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent("dialog-open", { bubbles: true, composed: true }));
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoDialogPortal extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

class NofoDialogOverlay extends NofoElement {
  onMount() {
    this.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("dialog-close", { bubbles: true, composed: true }));
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `;
  }
}

class NofoDialogContent extends NofoElement {
  static props = {
    size: "3",
  };

  onMount() {
    this.sync().attr("size").toDataAttr("size");
    this.setAttribute("dialog-content", "");
  }

  getSizeStyles(size) {
    const sizes = {
      1: { padding: "1rem", maxWidth: "300px" },
      2: { padding: "1.5rem", maxWidth: "400px" },
      3: { padding: "2rem", maxWidth: "500px" },
      4: { padding: "2.5rem", maxWidth: "600px" },
    };
    return sizes[size] || sizes["3"];
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const sizeStyles = this.getSizeStyles(this.state.size);
    return `
      :host {
        display: block;
        background-color: var(--color-panel-solid);
        border-radius: 0.5rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        padding: ${sizeStyles.padding};
        max-width: ${sizeStyles.maxWidth};
        width: 90vw;
        position: relative;
        z-index: 60;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoDialogTitle extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        font-size: 1.25rem;
        font-weight: 600;
        line-height: 1.5;
        margin-bottom: 0.5rem;
        color: var(--gray-12);
        display: block;
      }
    `;
  }
}

class NofoDialogDescription extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        font-size: 0.875rem;
        color: var(--gray-11);
        line-height: 1.5;
        margin-bottom: 1rem;
        display: block;
      }
    `;
  }
}

class NofoDialogClose extends NofoElement {
  onMount() {
    this.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent("dialog-close", { bubbles: true, composed: true }));
    });
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `:host { display: contents; }`;
  }
}

customElements.define("nofo-dialog", NofoDialog);
customElements.define("nofo-dialog-trigger", NofoDialogTrigger);
customElements.define("nofo-dialog-portal", NofoDialogPortal);
customElements.define("nofo-dialog-overlay", NofoDialogOverlay);
customElements.define("nofo-dialog-content", NofoDialogContent);
customElements.define("nofo-dialog-title", NofoDialogTitle);
customElements.define("nofo-dialog-description", NofoDialogDescription);
customElements.define("nofo-dialog-close", NofoDialogClose);

export {
  NofoDialog,
  NofoDialogTrigger,
  NofoDialogPortal,
  NofoDialogOverlay,
  NofoDialogContent,
  NofoDialogTitle,
  NofoDialogDescription,
  NofoDialogClose,
};
