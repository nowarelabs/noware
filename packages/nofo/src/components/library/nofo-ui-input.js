import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIInput extends NofoElement {
  static props = {
    type: "text",
    placeholder: "",
    value: "",
    disabled: false,
    error: "",
    helperText: "",
    label: "",
    name: "",
    required: false,
  };

  template() {
    const { type, placeholder, value, disabled, error, helperText, label, name, required } =
      this.state;

    return `
      <nofo-text-field
        type="${type}"
        variant="surface"
        size="2"
        placeholder="${placeholder}"
        .value="${value}"
        ?disabled="${disabled}"
        error="${error}"
        helperText="${helperText}"
        label="${label}"
        name="${name}"
        ?required="${required}"
        ?invalid="${!!error}"
      >
        <slot></slot>
      </nofo-text-field>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-text-field { display: block; width: 100%; }
      
      /* Theming the nofo-text-field via CSS variables or parts if supported */
      :host {
        --nofo-field-bg: var(--nofo-ui-background-secondary);
        --nofo-field-border: var(--nofo-ui-border);
        --nofo-field-radius: var(--nofo-ui-radius);
      }
    `;
  }
}

customElements.define("nofo-ui-input", NofoUIInput);
export { NofoUIInput };
