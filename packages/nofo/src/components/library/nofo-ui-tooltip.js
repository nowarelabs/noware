import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUITooltip extends NofoElement {
  template() {
    return `
      <nofo-tooltip>
        <slot></slot>
      </nofo-tooltip>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUITooltipTrigger extends NofoElement {
  template() {
    return `
      <nofo-tooltip-trigger>
        <slot></slot>
      </nofo-tooltip-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUITooltipContent extends NofoElement {
  template() {
    return `
      <nofo-tooltip-content>
        <slot></slot>
      </nofo-tooltip-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-tooltip-content {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        box-shadow: var(--nofo-ui-shadow-lg);
        color: var(--nofo-ui-foreground);
        padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
        font-size: var(--nofo-ui-font-size-xs);
        max-width: 16rem;
        z-index: var(--nofo-ui-z-tooltip);
      }
    `;
  }
}

customElements.define("nofo-ui-tooltip", NofoUITooltip);
customElements.define("nofo-ui-tooltip-trigger", NofoUITooltipTrigger);
customElements.define("nofo-ui-tooltip-content", NofoUITooltipContent);

export { NofoUITooltip, NofoUITooltipTrigger, NofoUITooltipContent };
