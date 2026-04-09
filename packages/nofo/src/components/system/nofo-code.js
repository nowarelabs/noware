import { NofoElement } from "../../index.js";

class NofoCode extends NofoElement {
  static props = {
    size: { type: String, default: "2" },
    variant: { type: String, default: "soft" },
    color: { type: String, default: "accent" },
    weight: { type: String, default: "regular" },
    highContrast: { type: Boolean, default: false },
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
    return sizes[size] || sizes["2"];
  }

  getVariantStyles(variant, color) {
    const variants = {
      solid: {
        backgroundColor: `var(--${color}-9)`,
        color: "var(--gray-1)",
        padding: "0.125rem 0.375rem",
      },
      soft: {
        backgroundColor: `var(--${color}-3)`,
        color: `var(--${color}-11)`,
        padding: "0.125rem 0.375rem",
      },
      outline: {
        backgroundColor: "transparent",
        color: `var(--${color}-11)`,
        border: `1px solid var(--${color}-7)`,
        padding: "0.125rem 0.375rem",
      },
      ghost: {
        backgroundColor: "transparent",
        color: `var(--${color}-11)`,
        padding: "0.125rem 0.375rem",
      },
    };
    return variants[variant] || variants["soft"];
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
    const { size, variant, color, weight, highContrast } = this;

    const fontSize = this.getSizeStyles(size);
    const variantStyles = this.getVariantStyles(variant, color);
    const fontWeight = this.getWeightStyles(weight);

    let styles = {
      ...variantStyles,
      fontSize,
      fontWeight,
      fontFamily: "monospace",
      borderRadius: "var(--radius)",
      display: "inline-block",
    };

    if (highContrast) {
      styles.color = "var(--gray-12)";
      if (variant === "solid") {
        styles.backgroundColor = "var(--gray-12)";
        styles.color = "var(--gray-1)";
      }
    }

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
        }
      </style>
      <code><slot></slot></code>
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

customElements.define("nofo-code", NofoCode);
export { NofoCode };
