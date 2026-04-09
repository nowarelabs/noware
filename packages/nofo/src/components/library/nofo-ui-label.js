import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUILabel extends NofoElement {
  static props = {
    for: "",
  };

  template() {
    const forAttr = this.state.for;
    return `
      <label ${forAttr ? `for="${forAttr}"` : ""}>
        <slot></slot>
      </label>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: block;
      }
      label {
        font-size: var(--nofo-ui-font-size-sm);
        font-weight: 500;
        color: var(--nofo-ui-foreground);
        margin-bottom: var(--nofo-ui-spacing-sm);
        display: block;
        cursor: pointer;
      }
      label:has(input[required])::after {
        content: ' *';
        color: var(--nofo-ui-destructive, #ff0033);
      }
    `;
  }
}

customElements.define("nofo-ui-label", NofoUILabel);
export { NofoUILabel };
