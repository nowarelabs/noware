import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIH1 extends NofoElement {
  template() {
    return `
      <nofo-heading size="5" as="h1">
        <slot></slot>
      </nofo-heading>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}

      :host {
        display: block;
      }

      nofo-heading {
        font-size: var(--nofo-ui-font-size-xl);
        font-weight: 700;
        line-height: 1.2;
        color: var(--nofo-ui-foreground);
        margin: 0;
      }
    `;
  }
}

class NofoUIH2 extends NofoElement {
  template() {
    return `
      <nofo-heading size="4" as="h2">
        <slot></slot>
      </nofo-heading>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}

      :host {
        display: block;
      }

      nofo-heading {
        font-size: var(--nofo-ui-font-size-lg);
        font-weight: 600;
        line-height: 1.3;
        color: var(--nofo-ui-foreground);
        margin: 0;
      }
    `;
  }
}

class NofoUIH3 extends NofoElement {
  template() {
    return `
      <nofo-heading size="3" as="h3">
        <slot></slot>
      </nofo-heading>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}

      :host {
        display: block;
      }

      nofo-heading {
        font-size: var(--nofo-ui-font-size-base);
        font-weight: 600;
        line-height: 1.4;
        color: var(--nofo-ui-foreground);
        margin: 0;
      }
    `;
  }
}

class NofoUIH4 extends NofoElement {
  template() {
    return `
      <nofo-heading size="2" as="h4">
        <slot></slot>
      </nofo-heading>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}

      :host {
        display: block;
      }

      nofo-heading {
        font-size: var(--nofo-ui-font-size-sm);
        font-weight: 600;
        line-height: 1.5;
        color: var(--nofo-ui-foreground);
        margin: 0;
      }
    `;
  }
}

class NofoUIP extends NofoElement {
  template() {
    return `
      <nofo-text size="2" as="p">
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
        font-size: var(--nofo-ui-font-size-base);
        line-height: 1.6;
        color: var(--nofo-ui-foreground);
        margin: 0;
      }
    `;
  }
}

class NofoUIBlockquote extends NofoElement {
  template() {
    return `
      <nofo-blockquote>
        <slot></slot>
      </nofo-blockquote>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}

      :host {
        display: block;
      }

      nofo-blockquote {
        padding-left: var(--nofo-ui-spacing-lg);
        border-left: 3px solid var(--nofo-ui-accent-primary);
        color: var(--nofo-ui-foreground-secondary);
        font-style: italic;
        margin: 0;
      }
    `;
  }
}

class NofoUICode extends NofoElement {
  template() {
    return `
      <nofo-code>
        <slot></slot>
      </nofo-code>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}

      :host {
        display: inline-block;
      }

      nofo-code {
        font-family: var(--nofo-ui-font-family);
        font-size: 0.9em;
        padding: 0.125rem 0.375rem;
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: calc(var(--nofo-ui-radius) * 0.5);
        color: var(--nofo-ui-accent-primary);
      }
    `;
  }
}

customElements.define("nofo-ui-h1", NofoUIH1);
customElements.define("nofo-ui-h2", NofoUIH2);
customElements.define("nofo-ui-h3", NofoUIH3);
customElements.define("nofo-ui-h4", NofoUIH4);
customElements.define("nofo-ui-p", NofoUIP);
customElements.define("nofo-ui-blockquote", NofoUIBlockquote);
customElements.define("nofo-ui-code", NofoUICode);
