import { NofoElement } from "../../index.js";

class NofoIcon extends NofoElement {
  static props = {
    name: { type: String, default: "" },
    size: { type: String, default: "md" },
  };

  onMount() {
    const s = this.sync();
    s.attr("name", "data-icon");
    s.attr("size", "data-size");
  }

  getSizeStyles(size) {
    const sizes = {
      sm: "0.875rem",
      md: "1rem",
      lg: "1.25rem",
    };
    return sizes[size] || sizes["md"];
  }

  template() {
    return `
      <span aria-hidden="true"></span>
    `;
  }

  styles() {
    const fontSize = this.getSizeStyles(this.props.size);
    return `
      :host {
        display: inline-block;
        width: ${fontSize};
        height: ${fontSize};
        font-size: ${fontSize};
        line-height: 1;
        flex-shrink: 0;
        box-sizing: border-box;
      }
      :host::before {
        content: '';
        display: block;
        width: 100%;
        height: 100%;
        background-color: currentColor;
        mask-image: var(--icon-${this.props.name});
        -webkit-mask-image: var(--icon-${this.props.name});
      }
    `;
  }
}

customElements.define("nofo-icon", NofoIcon);
export { NofoIcon };
