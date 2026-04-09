import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUIDataTable extends NofoElement {
  template() {
    return `
      <nofo-ui-table>
        <slot></slot>
      </nofo-ui-table>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: block; width: 100%; }
      
      nofo-ui-table {
        display: block;
        width: 100%;
      }
    `;
  }
}

customElements.define("nofo-ui-data-table", NofoUIDataTable);
export { NofoUIDataTable };
