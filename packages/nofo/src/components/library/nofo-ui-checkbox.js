import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUICheckbox extends NofoElement {
  static props = {
    checked: false,
    defaultChecked: false,
    disabled: false,
    name: "",
    required: false,
    value: "",
  };

  template() {
    const { checked, defaultChecked, disabled, name, required, value } = this.state;

    return `
      <nofo-checkbox
        ?checked="${checked}"
        ?defaultChecked="${defaultChecked}"
        ?disabled="${disabled}"
        name="${name}"
        ?required="${required}"
        value="${value}"
        size="2"
        variant="solid"
      >
        <slot></slot>
      </nofo-checkbox>
      <span class="label">
        <slot name="label"></slot>
      </span>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        cursor: pointer;
      }
      
      :host([disabled]) {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .label {
        font-size: 0.875rem;
        color: var(--nofo-ui-foreground);
        user-select: none;
      }
    `;
  }
}

customElements.define("nofo-ui-checkbox", NofoUICheckbox);
export { NofoUICheckbox };
