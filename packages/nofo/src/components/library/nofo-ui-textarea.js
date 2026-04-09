import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUITextarea extends NofoElement {
  static props = {
    placeholder: "",
    value: "",
    disabled: false,
    error: "",
    helperText: "",
    label: "",
    name: "",
    required: false,
    rows: "4",
  };

  template() {
    const { placeholder, value, disabled, error, helperText, label, name, required, rows } =
      this.state;

    return `
      <nofo-text-area
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
        rows="${rows}"
        ?invalid="${!!error}"
      >
        <slot></slot>
      </nofo-text-area>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-text-area { display: block; width: 100%; }
      
      :host {
        --nofo-field-bg: var(--nofo-ui-background-secondary);
        --nofo-field-border: var(--nofo-ui-border);
        --nofo-field-radius: var(--nofo-ui-radius);
      }
    `;
  }
}

customElements.define("nofo-ui-textarea", NofoUITextarea);
export { NofoUITextarea };
