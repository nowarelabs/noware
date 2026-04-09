import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIInputGroup extends NofoElement {
  template() {
    return `
      <div class="input-group">
        <slot></slot>
      </div>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: flex; align-items: stretch; width: 100%; }
      .input-group { display: flex; align-items: stretch; width: 100%; }
      ::slotted(nofo-ui-input-group-addon:first-child) {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        border-right: none;
      }
      ::slotted(nofo-ui-input-group-addon:last-child) {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        border-left: none;
      }
      ::slotted(nofo-ui-input) { border-radius: 0; }
      ::slotted(nofo-ui-input:not(:first-child)) { border-left: none; }
      ::slotted(nofo-ui-input:not(:last-child)) { border-right: none; }
      ::slotted(nofo-ui-input:first-child) {
        border-top-left-radius: var(--nofo-ui-radius);
        border-bottom-left-radius: var(--nofo-ui-radius);
      }
      ::slotted(nofo-ui-input:last-child) {
        border-top-right-radius: var(--nofo-ui-radius);
        border-bottom-right-radius: var(--nofo-ui-radius);
      }
    `;
  }
}

class NofoUIInputGroupAddon extends NofoElement {
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
        background-color: var(--nofo-ui-background-secondary);
        border: 1px solid var(--nofo-ui-border);
        color: var(--nofo-ui-foreground-secondary);
        font-size: var(--nofo-ui-font-size-sm);
        white-space: nowrap;
      }
      :host(:first-child) {
        border-top-left-radius: var(--nofo-ui-radius);
        border-bottom-left-radius: var(--nofo-ui-radius);
      }
      :host(:last-child) {
        border-top-right-radius: var(--nofo-ui-radius);
        border-bottom-right-radius: var(--nofo-ui-radius);
      }
    `;
  }
}

customElements.define("nofo-ui-input-group", NofoUIInputGroup);
customElements.define("nofo-ui-input-group-addon", NofoUIInputGroupAddon);

export { NofoUIInputGroup, NofoUIInputGroupAddon };
