import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIKbd extends NofoElement {
  template() {
    return `
      <nofo-kbd>
        <slot></slot>
      </nofo-kbd>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      
      :host {
        display: inline-block;
      }
      
      nofo-kbd {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.125rem 0.375rem;
        font-family: var(--nofo-ui-font-family);
        font-size: var(--nofo-ui-font-size-xs);
        font-weight: 600;
        color: var(--nofo-ui-foreground);
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        border-radius: calc(var(--nofo-ui-radius) * 0.5);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }
    `;
  }
}

customElements.define("nofo-ui-kbd", NofoUIKbd);
export { NofoUIKbd };
