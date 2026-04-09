import { NofoElement } from "../../index.js";

class NofoContainer extends NofoElement {
  static props = {
    size: { type: String, default: "3" },
  };

  onMount() {
    const s = this.sync();
    s.attr("size", "data-size");
  }

  getSizeStyles(size) {
    const sizes = {
      1: "480px",
      2: "768px",
      3: "1024px",
      4: "1280px",
    };
    return sizes[size] || sizes["3"];
  }

  template() {
    return `
      <slot></slot>
    `;
  }

  styles() {
    const maxWidth = this.getSizeStyles(this.props.size);
    return `
      :host {
        max-width: ${maxWidth};
        margin-left: auto;
        margin-right: auto;
        padding-left: var(--space-4);
        padding-right: var(--space-4);
        box-sizing: border-box;
      }
    `;
  }
}

customElements.define("nofo-container", NofoContainer);
export { NofoContainer };
