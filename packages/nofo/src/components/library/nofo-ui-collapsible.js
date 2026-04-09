import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUICollapsible extends NofoElement {
  static props = {
    open: false,
    defaultOpen: false,
  };

  onMount() {
    this.sync().attr("open").toDataAttr("open").attr("defaultOpen").toDataAttr("defaultOpen");
  }

  template() {
    return `
      <nofo-collapsible 
        ${this.state.open ? "open" : ""} 
        ${this.state.defaultOpen ? "defaultOpen" : ""}
      >
        <slot></slot>
      </nofo-collapsible>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      nofo-collapsible { display: block; width: 100%; }
    `;
  }
}

class NofoUICollapsibleTrigger extends NofoElement {
  template() {
    return `
      <nofo-collapsible-trigger>
        <slot></slot>
      </nofo-collapsible-trigger>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: contents; }
    `;
  }
}

class NofoUICollapsibleContent extends NofoElement {
  template() {
    return `
      <nofo-collapsible-content>
        <slot></slot>
      </nofo-collapsible-content>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: block;
        margin-top: var(--nofo-ui-spacing-md);
      }
      nofo-collapsible-content {
        padding: var(--nofo-ui-spacing-lg);
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: var(--nofo-ui-radius);
        color: var(--nofo-ui-foreground);
        animation: slideDown 0.2s ease;
      }
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
  }
}

customElements.define("nofo-ui-collapsible", NofoUICollapsible);
customElements.define("nofo-ui-collapsible-trigger", NofoUICollapsibleTrigger);
customElements.define("nofo-ui-collapsible-content", NofoUICollapsibleContent);

export { NofoUICollapsible, NofoUICollapsibleTrigger, NofoUICollapsibleContent };
