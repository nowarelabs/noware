import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUISeparator extends NofoElement {
  static props = {
    orientation: "horizontal",
  };

  onMount() {
    const s = this.sync();
    s.attr("orientation").toDataAttr("orientation");
  }

  template() {
    return `
      <nofo-separator orientation="${this.state.orientation}"></nofo-separator>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host {
        display: block;
      }
      nofo-separator {
        display: block;
        background-color: var(--nofo-ui-border);
      }
      :host([data-orientation="horizontal"]) nofo-separator {
        width: 100%;
        height: 1px;
      }
      :host([data-orientation="vertical"]) nofo-separator {
        width: 1px;
        height: 100%;
      }
    `;
  }
}

customElements.define("nofo-ui-separator", NofoUISeparator);
export { NofoUISeparator };
