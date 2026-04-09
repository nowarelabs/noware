import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUISonner extends NofoElement {
  static template() {
    return `
      <style>
        ${nofoUIStyles}
        
        :host {
          display: contents;
        }
      </style>
      <nofo-ui-toast-provider>
        <slot></slot>
      </nofo-ui-toast-provider>
    `;
  }

  static styles() {
    return "";
  }

  onMount() {}
}

customElements.define("nofo-ui-sonner", NofoUISonner);
