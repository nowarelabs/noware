import { NofoElement } from "../../index.js";

class NofoLink extends NofoElement {
  static props = {
    href: { type: String, default: "#" },
    size: { type: String, default: "3" },
    weight: { type: String, default: "regular" },
    color: { type: String, default: "accent" },
    underline: { type: String, default: "auto" },
    highContrast: { type: Boolean, default: false },
    target: { type: String, default: "" },
    rel: { type: String, default: "" },
  };

  onMount() {
    const s = this.sync();
    s.attr("href");
    s.attr("size", "data-size");
    s.attr("weight");
    s.attr("color", "data-color");
    s.attr("underline");
    s.boolAttr("high-contrast", "data-high-contrast");
    s.attr("target");
    s.attr("rel");
  }

  getSizeStyles(size) {
    const sizes = {
      1: "var(--font-size-1)",
      2: "var(--font-size-2)",
      3: "var(--font-size-3)",
      4: "var(--font-size-4)",
      5: "var(--font-size-5)",
      6: "var(--font-size-6)",
      7: "var(--font-size-7)",
      8: "var(--font-size-8)",
      9: "var(--font-size-9)",
    };
    return sizes[size] || sizes["3"];
  }

  getWeightStyles(weight) {
    const weights = {
      light: "300",
      regular: "400",
      medium: "500",
      bold: "700",
    };
    return weights[weight] || "400";
  }

  template() {
    const targetAttr = this.props.target ? `target="${this.props.target}"` : "";
    const relAttr = this.props.rel ? `rel="${this.props.rel}"` : "";
    return `
      <a href="${this.props.href}" ${targetAttr} ${relAttr}>
        <slot></slot>
      </a>
    `;
  }

  styles() {
    const fontSize = this.getSizeStyles(this.props.size);
    const fontWeight = this.getWeightStyles(this.props.weight);
    const color = this.props.highContrast ? "var(--gray-12)" : `var(--${this.props.color}-11)`;
    const textDecoration =
      this.props.underline === "always"
        ? "underline"
        : this.props.underline === "none"
          ? "none"
          : "auto";
    const hoverStyle =
      this.props.underline === "hover"
        ? `
      :host(:hover) a {
        text-decoration: underline;
      }
    `
        : "";
    return `
      :host {
        font-size: ${fontSize};
        font-weight: ${fontWeight};
        color: ${color};
        text-decoration: ${textDecoration};
        cursor: pointer;
        box-sizing: border-box;
        display: inline;
      }
      :host a {
        color: inherit;
        text-decoration: inherit;
      }
      ${hoverStyle}
    `;
  }
}

customElements.define("nofo-link", NofoLink);
export { NofoLink };
