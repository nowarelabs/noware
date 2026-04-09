import { NofoElement } from "../../index.js";

class NofoDivider extends NofoElement {
  static props = {
    orientation: { type: String, default: "horizontal" },
    size: { type: String, default: "1" },
    decorative: { type: Boolean, default: false },
  };

  onMount() {
    const s = this.sync();
    s.attr("orientation", "data-orientation");
    s.attr("size", "data-size");
  }

  getSizeStyles(size) {
    const sizes = {
      1: "1px",
      2: "2px",
      3: "3px",
      4: "4px",
    };
    return sizes[size] || sizes["1"];
  }

  template() {
    const roleAttr = this.props.decorative ? 'role="presentation"' : "";
    return `
      <hr ${roleAttr} />
    `;
  }

  styles() {
    const height = this.getSizeStyles(this.props.size);
    const isHorizontal = this.props.orientation === "horizontal";
    return `
      :host {
        background-color: var(--gray-6);
        border: none;
        box-sizing: border-box;
        display: block;
        flex-shrink: 0;
        width: ${isHorizontal ? "100%" : height};
        height: ${isHorizontal ? height : "100%"};
      }
    `;
  }
}

customElements.define("nofo-divider", NofoDivider);
export { NofoDivider };
