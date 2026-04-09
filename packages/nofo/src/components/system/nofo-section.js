import { NofoElement } from "../../index.js";

class NofoSection extends NofoElement {
  static props = {
    size: { type: String, default: "2" },
  };

  getSizeStyles(size) {
    const sizes = {
      1: "1rem",
      2: "2rem",
      3: "3rem",
    };
    return sizes[size] || sizes["2"];
  }

  onMount() {}

  template() {
    const { size } = this;
    const padding = this.getSizeStyles(size);

    const styles = {
      paddingTop: padding,
      paddingBottom: padding,
    };

    const styleString = Object.entries(styles)
      .map(([key, value]) => `${key.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${value};`)
      .join(" ");

    return `
      <style>
        :host {
          ${styleString}
        }
      </style>
      <slot></slot>
    `;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-section", NofoSection);
export { NofoSection };
