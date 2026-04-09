import { NofoElement } from "../../index.js";

class NofoReset extends NofoElement {
  static props = {};

  onMount() {}

  template() {
    return `<slot></slot>`;
  }

  styles() {
    return `
      :host {
        display: block;
        box-sizing: border-box;
      }
      :host * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      :host h1, :host h2, :host h3, :host h4, :host h5, :host h6 {
        font-size: inherit;
        font-weight: inherit;
      }
      :host ul, :host ol {
        list-style: none;
      }
      :host a {
        text-decoration: none;
        color: inherit;
      }
      :host button {
        background: none;
        border: none;
        padding: 0;
        font: inherit;
        cursor: pointer;
      }
    `;
  }
}

customElements.define("nofo-reset", NofoReset);
export { NofoReset };
