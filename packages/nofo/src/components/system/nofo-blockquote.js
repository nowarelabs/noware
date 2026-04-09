import { NofoElement } from "../../index.js";

class NofoBlockquote extends NofoElement {
  static props = {
    size: { type: String, default: "3" },
    weight: { type: String, default: "regular" },
    color: { type: String, default: "accent" },
    cite: { type: String, default: "" },
  };

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

  onMount() {}

  template() {
    const { size, weight, color, cite } = this;

    const fontSize = this.getSizeStyles(size);
    const fontWeight = this.getWeightStyles(weight);

    const styles = {
      fontSize,
      fontWeight,
      color: `var(--${color}-11)`,
      borderLeft: `3px solid var(--${color}-7)`,
      paddingLeft: "var(--space-4)",
      marginLeft: 0,
      marginRight: 0,
      fontStyle: "italic",
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    const citeAttr = cite ? `cite="${cite}"` : "";

    return `
      <style>
        :host {
          ${styleString}
          display: block;
        }
      </style>
      <blockquote ${citeAttr}><slot></slot></blockquote>
    `;
  }

  styles() {
    return `
      :host {
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-blockquote", NofoBlockquote);
export { NofoBlockquote };
