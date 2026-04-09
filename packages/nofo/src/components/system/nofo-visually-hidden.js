import { NofoElement } from "../../index.js";

class NofoVisuallyHidden extends NofoElement {
  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
        box-sizing: border-box;
      }
      :host(:focus),
      :host(:focus-visible) {
        position: static;
        width: auto;
        height: auto;
        padding: inherit;
        margin: inherit;
        overflow: visible;
        clip: auto;
        white-space: normal;
      }
    `;
  }
}

customElements.define("nofo-visually-hidden", NofoVisuallyHidden);
export { NofoVisuallyHidden };
