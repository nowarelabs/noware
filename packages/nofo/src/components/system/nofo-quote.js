import { NofoElement } from "../../index.js";

class NofoQuote extends NofoElement {
  template() {
    return `
      <q>
        <slot></slot>
      </q>
    `;
  }

  styles() {
    return `
      :host {
        display: inline;
        box-sizing: border-box;
      }
      :host q {
        quotes: '"' '"' "'" "'";
      }
      :host q::before {
        content: open-quote;
      }
      :host q::after {
        content: close-quote;
      }
    `;
  }
}

customElements.define("nofo-quote", NofoQuote);
export { NofoQuote };
