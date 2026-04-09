import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIButtonGroup extends NofoElement {
  static props = {
    orientation: "horizontal",
    attached: false,
    size: "",
    variant: "",
  };

  template() {
    const { orientation, attached, size, variant } = this.state;

    return `
      <nofo-button-group
        orientation="${orientation}"
        ?attached="${attached}"
        size="${size}"
        variant="${variant}"
      >
        <slot></slot>
      </nofo-button-group>
    `;
  }

  styles() {
    const { attached } = this.state;

    return `
      ${nofoUIStyles}
      
      :host {
        display: inline-flex;
      }
      
      nofo-button-group {
        display: inline-flex;
        gap: var(--nofo-ui-spacing-sm);
      }
      
      ${
        attached
          ? `:host([attached]) nofo-button-group {
        gap: 0;
      }`
          : ""
      }
    `;
  }
}

customElements.define("nofo-ui-button-group", NofoUIButtonGroup);
