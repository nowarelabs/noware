import { NofoElement } from "../../index.js";

class NofoKbd extends NofoElement {
  static props = {
    size: { type: String, default: "2" },
  };

  onMount() {
    const s = this.sync();
    s.attr("size", "data-size");
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
    return sizes[size] || sizes["2"];
  }

  template() {
    const fontSize = this.getSizeStyles(this.props.size);
    return `
      <kbd>
        <slot></slot>
      </kbd>
    `;
  }

  styles() {
    const fontSize = this.getSizeStyles(this.props.size);
    return `
      :host {
        font-size: ${fontSize};
        font-family: monospace;
        background-color: var(--gray-3);
        color: var(--gray-11);
        padding: 0.125rem 0.375rem;
        border-radius: var(--radius);
        border: 1px solid var(--gray-6);
        box-shadow: 0 1px 0 rgba(0,0,0,0.1);
        display: inline-block;
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-kbd", NofoKbd);
export { NofoKbd };
