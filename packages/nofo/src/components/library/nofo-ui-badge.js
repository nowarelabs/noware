import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIBadge extends NofoElement {
  static props = {
    variant: "solid",
    size: "2",
    color: "accent",
  };

  template() {
    const { variant, size, color } = this.state;

    return `
      <nofo-badge
        variant="${variant}"
        size="${size}"
        color="${color}"
      >
        <slot></slot>
      </nofo-badge>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: inline-flex; }
      nofo-badge {
        --badge-bg: var(--nofo-ui-accent-primary);
        --badge-text: #000; /* Contrast on primary */
      }
    `;
  }
}

customElements.define("nofo-ui-badge", NofoUIBadge);
export { NofoUIBadge };
