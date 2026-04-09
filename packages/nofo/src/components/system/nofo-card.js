import { NofoElement } from "../../index.js";

class NofoCard extends NofoElement {
  static props = {
    size: "3",
    variant: "surface",
    hoverable: false,
    interactive: false,
    loading: false,
    selected: false,
  };

  onMount() {
    this.updateDataAttributes();
  }

  updateDataAttributes() {
    this.dataset.size = this.size;
    this.dataset.variant = this.variant;

    if (this.hoverable) {
      this.dataset.hoverable = "";
    }
    if (this.interactive) {
      this.dataset.interactive = "";
    }
    if (this.loading) {
      this.dataset.loading = "";
    }
    if (this.selected) {
      this.dataset.selected = "";
    }
  }

  getSizeStyles(size) {
    const sizes = {
      1: "0.5rem",
      2: "0.75rem",
      3: "1rem",
      4: "1.25rem",
      5: "1.5rem",
    };
    return sizes[size] || sizes["3"];
  }

  getVariantStyles(variant) {
    const variants = {
      surface: {
        backgroundColor: "var(--color-panel-solid)",
        border: "1px solid var(--gray-6)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      },
      classic: {
        backgroundColor: "var(--color-panel-solid)",
        border: "1px solid var(--gray-6)",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      },
      ghost: {
        backgroundColor: "transparent",
        border: "none",
        boxShadow: "none",
      },
    };
    return variants[variant] || variants["surface"];
  }

  template() {
    const padding = this.getSizeStyles(this.size);
    const variantStyles = this.getVariantStyles(this.variant);

    const styles = {
      ...variantStyles,
      borderRadius: "var(--radius)",
      overflow: "hidden",
      boxSizing: "border-box",
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <div class="card-container" style="display: flex; flex-direction: column; height: 100%;">
        <div class="card-content" style="padding: ${padding}; flex-grow: 1;">
          <slot></slot>
        </div>
      </div>
    `;
  }

  styles() {
    return `
      :host {
        display: block;
      }
    `;
  }
}

class NofoCardHeader extends NofoElement {
  template() {
    const card = this.closest("nofo-card");
    const size = card ? card.getAttribute("size") || "3" : "3";

    const sizes = {
      1: "0.5rem",
      2: "0.75rem",
      3: "1rem",
      4: "1.25rem",
      5: "1.5rem",
    };
    const padding = sizes[size] || sizes["3"];

    return `<slot></slot>`;
  }

  styles() {
    const card = this.closest("nofo-card");
    const size = card ? card.getAttribute("size") || "3" : "3";

    const sizes = {
      1: "0.5rem",
      2: "0.75rem",
      3: "1rem",
      4: "1.25rem",
      5: "1.5rem",
    };
    const padding = sizes[size] || sizes["3"];

    return `
      :host {
        padding: ${padding};
        border-bottom: 1px solid var(--gray-6);
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCardContent extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    const card = this.closest("nofo-card");
    const size = card ? card.getAttribute("size") || "3" : "3";

    const sizes = {
      1: "0.5rem",
      2: "0.75rem",
      3: "1rem",
      4: "1.25rem",
      5: "1.5rem",
    };
    const padding = sizes[size] || sizes["3"];

    return `
      :host {
        padding: ${padding};
        box-sizing: border-box;
      }
    `;
  }
}

class NofoCardFooter extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    const card = this.closest("nofo-card");
    const size = card ? card.getAttribute("size") || "3" : "3";

    const sizes = {
      1: "0.5rem",
      2: "0.75rem",
      3: "1rem",
      4: "1.25rem",
      5: "1.5rem",
    };
    const padding = sizes[size] || sizes["3"];

    return `
      :host {
        padding: ${padding};
        border-top: 1px solid var(--gray-6);
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-card", NofoCard);
customElements.define("nofo-card-header", NofoCardHeader);
customElements.define("nofo-card-content", NofoCardContent);
customElements.define("nofo-card-footer", NofoCardFooter);

export { NofoCard, NofoCardHeader, NofoCardContent, NofoCardFooter };
