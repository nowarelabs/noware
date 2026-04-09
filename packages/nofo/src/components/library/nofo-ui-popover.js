import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIPopover extends NofoElement {
  template() {
    return `
      <nofo-popover>
        <slot></slot>
      </nofo-popover>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-popover {
        --popover-background: var(--nofo-ui-background-secondary);
        --popover-border: var(--nofo-ui-border);
      }
    `;
  }
}

class NofoUIPopoverTrigger extends NofoElement {
  template() {
    return `
      <nofo-popover-trigger>
        <slot></slot>
      </nofo-popover-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUIPopoverContent extends NofoElement {
  template() {
    return `
      <nofo-popover-content>
        <slot></slot>
      </nofo-popover-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
      nofo-popover-content {
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        box-shadow: var(--nofo-ui-shadow-lg);
        color: var(--nofo-ui-foreground);
        padding: var(--nofo-ui-spacing-lg);
        max-width: 20rem;
      }
    `;
  }
}

class NofoUIPopoverHeader extends NofoElement {
  template() {
    return `
      <div>
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: block;
        margin-bottom: var(--nofo-ui-spacing-md);
      }
    `;
  }
}

class NofoUIPopoverTitle extends NofoElement {
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

class NofoUIPopoverBody extends NofoElement {
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
      :host { display: block; }
      nofo-text {
        font-size: var(--nofo-ui-font-size-sm);
        color: var(--nofo-ui-foreground-secondary);
      }
    `;
  }
}

customElements.define("nofo-ui-popover", NofoUIPopover);
customElements.define("nofo-ui-popover-trigger", NofoUIPopoverTrigger);
customElements.define("nofo-ui-popover-content", NofoUIPopoverContent);
customElements.define("nofo-ui-popover-header", NofoUIPopoverHeader);
customElements.define("nofo-ui-popover-title", NofoUIPopoverTitle);
customElements.define("nofo-ui-popover-body", NofoUIPopoverBody);

export {
  NofoUIPopover,
  NofoUIPopoverTrigger,
  NofoUIPopoverContent,
  NofoUIPopoverHeader,
  NofoUIPopoverTitle,
  NofoUIPopoverBody,
};
