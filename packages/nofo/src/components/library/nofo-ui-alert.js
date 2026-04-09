import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIAlert extends NofoElement {
  static props = {
    variant: "info",
    size: "2",
    dismissible: false,
    open: true,
  };

  template() {
    const { variant, size, dismissible, open } = this.state;

    return `
      <nofo-alert
        variant="${variant}"
        size="${size}"
        ?dismissible="${dismissible}"
        ?open="${open}"
      >
        <slot name="icon" slot="icon"></slot>
        <slot></slot>
      </nofo-alert>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-alert {
        --alert-bg: var(--nofo-ui-background-secondary);
        --alert-border: var(--nofo-ui-border);
        --alert-text: var(--nofo-ui-foreground);
      }
    `;
  }
}

class NofoUIAlertTitle extends NofoElement {
  template() {
    return `
      <nofo-heading size="3">
        <slot></slot>
      </nofo-heading>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}

      :host {
        display: block;
        margin-bottom: var(--nofo-ui-spacing-sm);
      }

      nofo-heading {
        font-size: var(--nofo-ui-font-size-base);
        font-weight: 600;
        color: var(--nofo-ui-foreground);
        margin: 0;
      }
    `;
  }
}

class NofoUIAlertDescription extends NofoElement {
  template() {
    return `
      <nofo-text size="2">
        <slot></slot>
      </nofo-text>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}

      :host {
        display: block;
      }

      nofo-text {
        font-size: var(--nofo-ui-font-size-sm);
        color: var(--nofo-ui-foreground-secondary);
      }
    `;
  }
}

customElements.define("nofo-ui-alert", NofoUIAlert);
customElements.define("nofo-ui-alert-title", NofoUIAlertTitle);
customElements.define("nofo-ui-alert-description", NofoUIAlertDescription);
