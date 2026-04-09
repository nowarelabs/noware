import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIButton extends NofoElement {
  static props = {
    variant: "default",
    size: "md",
    disabled: false,
    loading: false,
    type: "button",
  };

  #getVariantProps(variant) {
    const map = {
      default: { variant: "solid", color: "accent" },
      destructive: { variant: "solid", color: "red" },
      outline: { variant: "outline", color: "accent" },
      ghost: { variant: "ghost", color: "accent" },
      link: { variant: "ghost", color: "accent" },
    };
    return map[variant] || map.default;
  }

  #getSizeValue(size) {
    const map = { sm: "1", md: "2", lg: "3", icon: "2" };
    return map[size] || "2";
  }

  template() {
    const { variant, color } = this.#getVariantProps(this.state.variant);
    const size = this.#getSizeValue(this.state.size);

    return `
      <nofo-button
        variant="${variant}"
        color="${color}"
        size="${size}"
        ?disabled="${this.state.disabled}"
        ?loading="${this.state.loading}"
        type="${this.state.type}"
      >
        <slot></slot>
      </nofo-button>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: inline-block; }
      nofo-button { width: 100%; }
      :host([size="icon"]) nofo-button { width: 2.5rem; padding: 0; }
      :host([variant="link"]) nofo-button { text-decoration: underline; text-underline-offset: 4px; }
    `;
  }
}

customElements.define("nofo-ui-button", NofoUIButton);
export { NofoUIButton };
