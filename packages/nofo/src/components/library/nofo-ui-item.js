import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIItem extends NofoElement {
  static props = {
    selected: false,
    disabled: false,
  };

  onMount() {
    this.sync();
  }

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      ${nofoUIStyles}
      
      :host {
        display: flex;
        align-items: center;
        padding: var(--nofo-ui-spacing-sm) var(--nofo-ui-spacing-md);
        border-radius: calc(var(--nofo-ui-radius) * 0.5);
        color: var(--nofo-ui-foreground);
        font-size: var(--nofo-ui-font-size-sm);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      
      :host(:hover) {
        background-color: var(--nofo-ui-hover);
      }
      
      :host([data-selected]) {
        background-color: var(--nofo-ui-accent-primary);
        color: var(--nofo-ui-background);
      }
      
      :host([data-disabled]) {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
    `;
  }
}

customElements.define("nofo-ui-item", NofoUIItem);
export { NofoUIItem };
