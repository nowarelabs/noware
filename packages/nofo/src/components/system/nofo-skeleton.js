import { NofoElement } from "../../index.js";

class NofoSkeleton extends NofoElement {
  static props = {
    width: { type: String, default: "100%" },
    height: { type: String, default: "1rem" },
    loading: { type: Boolean, default: true },
    variant: { type: String, default: "text" },
  };

  onMount() {
    this.sync();
  }

  sync() {
    const width = this.props.width || "100%";
    const height = this.props.height || "1rem";
    const loading = this.props.loading;
    const variant = this.props.variant || "text";

    this.dataset.loading = loading ? "true" : "false";
    this.dataset.variant = variant;

    this._skeletonStyles = {
      width: width,
      height: height,
      backgroundColor: "var(--gray-4)",
      borderRadius:
        variant === "circular" ? "50%" : variant === "rectangular" ? "0" : "var(--radius)",
      animation: "skeleton-pulse 1.5s ease-in-out infinite",
      display: loading ? "block" : "none",
    };
    this._loading = loading;
  }

  template() {
    const styleString = Object.entries(this._skeletonStyles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          display: block;
          box-sizing: border-box;
        }
        .skeleton {
          ${styleString}
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        ::slotted(*) {
          display: ${this._loading ? "none" : "block"};
        }
      </style>
      <div class="skeleton"></div>
      <slot></slot>
    `;
  }

  styles() {
    return ``;
  }
}

customElements.define("nofo-skeleton", NofoSkeleton);
export { NofoSkeleton };
