import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUICard extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
        }
        
        nofo-card {
          display: block;
          background-color: var(--nofo-ui-background-secondary);
          border: 1px solid var(--nofo-ui-border);
          border-radius: var(--nofo-ui-radius);
          transition: all 0.2s ease;
        }
        
        nofo-card:hover {
          border-color: var(--nofo-ui-accent-primary);
          box-shadow: var(--nofo-ui-shadow);
        }
      </style>
      <nofo-card>
        <slot></slot>
      </nofo-card>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {
    this._card = this.shadowRoot.querySelector("nofo-card");
    this.sync();
  }

  sync() {
    if (this._card) {
      this._card.setAttribute("variant", "surface");
      this._card.setAttribute("size", "3");
    }
  }
}

class NofoUICardHeader extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
        }
        
        nofo-card-header {
          display: flex;
          flex-direction: column;
          padding: var(--nofo-ui-spacing-xl);
          padding-bottom: var(--nofo-ui-spacing-lg);
        }
      </style>
      <nofo-card-header>
        <slot></slot>
      </nofo-card-header>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

class NofoUICardTitle extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
        }
        
        nofo-heading {
          font-size: var(--nofo-ui-font-size-xl);
          font-weight: 600;
          color: var(--nofo-ui-foreground);
          margin: 0;
        }
      </style>
      <nofo-heading size="4">
        <slot></slot>
      </nofo-heading>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

class NofoUICardDescription extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
          margin-top: var(--nofo-ui-spacing-sm);
        }
        
        nofo-text {
          font-size: var(--nofo-ui-font-size-sm);
          color: var(--nofo-ui-foreground-secondary);
        }
      </style>
      <nofo-text size="2">
        <slot></slot>
      </nofo-text>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

class NofoUICardContent extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
        }
        
        nofo-card-content {
          padding: var(--nofo-ui-spacing-xl);
          padding-top: var(--nofo-ui-spacing-lg);
        }
      </style>
      <nofo-card-content>
        <slot></slot>
      </nofo-card-content>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

class NofoUICardFooter extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: block;
        }
        
        nofo-card-footer {
          display: flex;
          align-items: center;
          padding: var(--nofo-ui-spacing-xl);
          padding-top: var(--nofo-ui-spacing-lg);
          border-top: 1px solid var(--nofo-ui-border);
        }
      </style>
      <nofo-card-footer>
        <slot></slot>
      </nofo-card-footer>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

customElements.define("nofo-ui-card", NofoUICard);
customElements.define("nofo-ui-card-header", NofoUICardHeader);
customElements.define("nofo-ui-card-title", NofoUICardTitle);
customElements.define("nofo-ui-card-description", NofoUICardDescription);
customElements.define("nofo-ui-card-content", NofoUICardContent);
customElements.define("nofo-ui-card-footer", NofoUICardFooter);
