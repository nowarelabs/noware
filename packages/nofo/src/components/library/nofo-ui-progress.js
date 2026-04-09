import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIProgress extends NofoElement {
  static props = {
    value: null,
    max: 100,
  };

  template() {
    const { value, max } = this.state;

    return `
      <nofo-progress
        .value="${value}"
        max="${max}"
        size="2"
      >
        <slot></slot>
      </nofo-progress>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-progress {
        --progress-bg: var(--nofo-ui-background-secondary);
        --progress-indicator: var(--nofo-ui-accent-primary);
      }
    `;
  }
}

customElements.define("nofo-ui-progress", NofoUIProgress);
export { NofoUIProgress };
