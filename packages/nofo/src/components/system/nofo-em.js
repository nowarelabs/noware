import { NofoElement } from "../../index.js";

class NofoEm extends NofoElement {
  static props = {};

  onMount() {}

  template() {
    return `<em><slot></slot></em>`;
  }

  styles() {
    return `
      :host {
        font-style: italic;
        display: inline;
      }
    `;
  }
}

customElements.define("nofo-em", NofoEm);
export { NofoEm };
