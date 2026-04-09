import { NofoElement } from "../../index.js";

class NofoBanner extends NofoElement {
  static props = {
    variant: { type: String, default: "info" },
    dismissible: { type: Boolean, default: false },
    open: { type: Boolean, default: true },
  };

  getVariantStyles(variant) {
    const variants = {
      info: {
        backgroundColor: "var(--blue-2)",
        borderBottom: "2px solid var(--blue-7)",
        color: "var(--blue-11)",
      },
      success: {
        backgroundColor: "var(--green-2)",
        borderBottom: "2px solid var(--green-7)",
        color: "var(--green-11)",
      },
      warning: {
        backgroundColor: "var(--amber-2)",
        borderBottom: "2px solid var(--amber-7)",
        color: "var(--amber-11)",
      },
      error: {
        backgroundColor: "var(--red-2)",
        borderBottom: "2px solid var(--red-7)",
        color: "var(--red-11)",
      },
    };
    return variants[variant] || variants["info"];
  }

  onMount() {
    const variantStyles = this.getVariantStyles(this.props.variant);

    this.setAttribute("data-variant", this.props.variant);
    this.setAttribute("data-state", this.props.open ? "open" : "closed");

    const styles = {
      ...variantStyles,
      display: this.props.open ? "flex" : "none",
      alignItems: "center",
      gap: "0.75rem",
      padding: "1rem",
      position: "relative",
      width: "100%",
      boxSizing: "border-box",
    };

    return styles;
  }

  setupEventListeners() {
    const closeBtn = this.shadowRoot?.querySelector(".banner-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (this.props.dismissible) {
          this.props.open = false;
          this.dispatchEvent(
            new CustomEvent("open-change", {
              detail: { open: false },
              bubbles: true,
              composed: true,
            }),
          );
        }
      });
    }
  }

  template() {
    return `
      <slot name="icon"></slot>
      <div class="banner-content">
        <slot></slot>
      </div>
      ${this.props.dismissible ? '<button class="banner-close" aria-label="Close"><nofo-icon name="cross"></nofo-icon></button>' : ""}
    `;
  }

  styles() {
    const variantStyles = this.getVariantStyles(this.props.variant);
    return `
      :host {
        display: ${this.props.open ? "flex" : "none"};
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        position: relative;
        width: 100%;
        box-sizing: border-box;
        ${Object.entries(variantStyles)
          .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
          .join(" ")}
      }
      .banner-content {
        flex: 1;
      }
      .banner-close {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
        flex-shrink: 0;
      }
      .banner-close:hover {
        opacity: 1;
      }
    `;
  }
}

class NofoBannerContent extends NofoElement {
  onMount() {
    const styles = {
      flex: 1,
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
        flex: 1;
        box-sizing: border-box;
      }
    `;
  }
}

class NofoBannerClose extends NofoElement {
  onMount() {
    const styles = {
      display: "contents",
      boxSizing: "border-box",
    };
    return styles;
  }

  setupEventListeners() {
    this.addEventListener("click", () => {
      const banner = this.closest("nofo-banner");
      if (banner) {
        banner.props.open = false;
      }
    });
  }

  template() {
    return ``;
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

customElements.define("nofo-banner", NofoBanner);
customElements.define("nofo-banner-content", NofoBannerContent);
customElements.define("nofo-banner-close", NofoBannerClose);

export { NofoBanner, NofoBannerContent, NofoBannerClose };
