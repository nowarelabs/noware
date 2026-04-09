import { NofoElement } from "../../index.js";

class NofoTagGroup extends NofoElement {
  onMount() {
    this.setAttribute("data-tag-group", "true");

    const styles = {
      display: "flex",
      flexWrap: "wrap",
      gap: "var(--space-2)",
      alignItems: "center",
      boxSizing: "border-box",
    };
    return styles;
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: center;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoTag extends NofoElement {
  static props = {
    variant: { type: String, default: "default" },
    size: { type: String, default: "md" },
    dismissible: { type: Boolean, default: false },
  };

  getVariantStyles(variant) {
    const variants = {
      default: {
        backgroundColor: "var(--gray-3)",
        color: "var(--gray-11)",
        border: "1px solid var(--gray-6)",
      },
      primary: {
        backgroundColor: "var(--accent-3)",
        color: "var(--accent-11)",
        border: "1px solid var(--accent-7)",
      },
      success: {
        backgroundColor: "var(--green-3)",
        color: "var(--green-11)",
        border: "1px solid var(--green-7)",
      },
      warning: {
        backgroundColor: "var(--amber-3)",
        color: "var(--amber-11)",
        border: "1px solid var(--amber-7)",
      },
      error: {
        backgroundColor: "var(--red-3)",
        color: "var(--red-11)",
        border: "1px solid var(--red-7)",
      },
    };
    return variants[variant] || variants["default"];
  }

  getSizeStyles(size) {
    const sizes = {
      sm: { padding: "0.25rem 0.5rem", fontSize: "0.75rem" },
      md: { padding: "0.375rem 0.75rem", fontSize: "0.875rem" },
      lg: { padding: "0.5rem 1rem", fontSize: "1rem" },
    };
    return sizes[size] || sizes["md"];
  }

  onMount() {
    this.setAttribute("data-variant", this.props.variant);
    this.setAttribute("data-size", this.props.size);

    if (this.props.dismissible) {
      this.setAttribute("data-dismissible", "");
    } else {
      this.removeAttribute("data-dismissible");
    }

    const variantStyles = this.getVariantStyles(this.props.variant);
    const sizeStyles = this.getSizeStyles(this.props.size);

    const styles = {
      ...variantStyles,
      ...sizeStyles,
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-1)",
      borderRadius: "var(--radius)",
      fontWeight: "500",
      lineHeight: "1",
      boxSizing: "border-box",
    };
    return styles;
  }

  setupEventListeners() {
    const removeBtn = this.querySelector("nofo-tag-remove");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        const event = new CustomEvent("tag-dismiss", {
          detail: { tag: this },
          bubbles: true,
          composed: true,
        });
        this.dispatchEvent(event);
        this.remove();
      });
    }
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    const variantStyles = this.getVariantStyles(this.props.variant);
    const sizeStyles = this.getSizeStyles(this.props.size);
    return `
      :host {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        border-radius: var(--radius);
        font-weight: 500;
        line-height: 1;
        box-sizing: border-box;
        ${Object.entries(variantStyles)
          .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
          .join(" ")}
        ${Object.entries(sizeStyles)
          .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
          .join(" ")}
      }
    `;
  }
}

class NofoTagRemove extends NofoElement {
  onMount() {
    const styles = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "1rem",
      height: "1rem",
      borderRadius: "50%",
      cursor: "pointer",
      transition: "all 0.2s",
      marginLeft: "var(--space-1)",
      boxSizing: "border-box",
    };
    return styles;
  }

  template() {
    return `
      <button type="button" aria-label="Remove tag">
        <nofo-icon name="cross" size="sm"></nofo-icon>
      </button>
    `;
  }

  styles() {
    return `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.2s;
        margin-left: var(--space-1);
        box-sizing: border-box;
      }
      :host(:hover) {
        background-color: rgba(0, 0, 0, 0.1);
      }
    `;
  }
}

customElements.define("nofo-tag-group", NofoTagGroup);
customElements.define("nofo-tag", NofoTag);
customElements.define("nofo-tag-remove", NofoTagRemove);

export { NofoTagGroup, NofoTag, NofoTagRemove };
