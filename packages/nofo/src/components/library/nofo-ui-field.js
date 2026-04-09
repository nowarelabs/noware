import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIField extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: flex; flex-direction: column; gap: var(--nofo-ui-spacing-sm); width: 100%; }
    `;
  }
}

class NofoUIFieldDescription extends NofoElement {
  template() {
    return `
      <nofo-text size="1">
        <slot></slot>
      </nofo-text>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-text { font-size: var(--nofo-ui-font-size-xs); color: var(--nofo-ui-foreground-secondary); }
    `;
  }
}

class NofoUIFieldError extends NofoElement {
  template() {
    return `
      <nofo-text size="1">
        <slot></slot>
      </nofo-text>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; }
      nofo-text { font-size: var(--nofo-ui-font-size-xs); color: var(--nofo-ui-destructive, #ff0033); }
    `;
  }
}

customElements.define("nofo-ui-field", NofoUIField);
customElements.define("nofo-ui-field-description", NofoUIFieldDescription);
customElements.define("nofo-ui-field-error", NofoUIFieldError);

export { NofoUIField, NofoUIFieldDescription, NofoUIFieldError };
