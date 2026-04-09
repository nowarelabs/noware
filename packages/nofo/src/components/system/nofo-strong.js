import { NofoElement } from "../../index.js";

class NofoStrong extends NofoElement {
  static props = {};

  onMount() {}

  template() {
    return `<strong><slot></slot></strong>`;
  }

  styles() {
    return `
      :host {
        font-weight: 600;
        display: inline;
      }
    `;
  }
}

customElements.define("nofo-strong", NofoStrong);
export { NofoStrong };
