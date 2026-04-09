import { NofoElement } from "../../index.js";
import { nofoUIStyles } from "./nofo-ui-styles.js";

class NofoUISpinner extends NofoElement {
  static props = {
    size: "md",
  };

  template() {
    const { size } = this.state;
    const sizeMap = { sm: "1", md: "2", lg: "3" };

    return `
      <nofo-spinner
        size="${sizeMap[size] || "2"}"
        loading="true"
      ></nofo-spinner>
    `;
  }

  styles() {
    return `
      ${nofoUIStyles}
      :host { display: inline-block; }
      nofo-spinner {
        color: var(--nofo-ui-accent-primary);
      }
    `;
  }
}

customElements.define("nofo-ui-spinner", NofoUISpinner);
export { NofoUISpinner };
